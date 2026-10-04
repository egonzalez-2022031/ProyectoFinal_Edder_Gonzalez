/**
 * Módulo de autenticación: registro, inicio de sesión y perfil del usuario.
 */
import bcrypt from 'bcrypt';
import { Request, Response } from 'express';
import { env } from '../config/env';
import { execute, selectOne } from '../config/db';
import { usuarioActual } from '../middlewares/auth.middleware';
import { UsuarioRow } from '../types/models';
import { badRequest, conflict, notFound, unauthorized } from '../utils/httpError';
import { firmarToken } from '../utils/jwt';
import { enviar } from '../utils/respuesta';
import { construirSet } from '../utils/sql';
import { Validador } from '../utils/validators';

// Hash válido (de otra contraseña) usado para que el login tarde lo mismo
// cuando el correo no existe, evitando revelar qué correos están registrados.
const HASH_FALSO = '$2b$10$CTAfWi7/vLgGBhY26oK4HO.rHpfLGaP14OL18BEm0it2jlHZgyk3C';

/** Perfil público del usuario con sus totales (nunca incluye password_hash). */
async function obtenerPerfil(idUsuario: number) {
  return selectOne(
    `SELECT u.id_usuario, u.nombre, u.apellido, u.email, u.avatar_url, u.biografia,
            u.puntos_totales, u.fecha_registro,
            (SELECT COUNT(*) FROM lecturas_usuario lu
              WHERE lu.id_usuario = u.id_usuario AND lu.estado = 'completado') AS libros_completados,
            (SELECT COUNT(*) FROM usuario_insignias ui
              WHERE ui.id_usuario = u.id_usuario) AS total_insignias
       FROM usuarios u
      WHERE u.id_usuario = ? AND u.activo = 1`,
    [idUsuario]
  );
}

/** POST /api/auth/register */
export async function registrar(req: Request, res: Response): Promise<void> {
  const v = new Validador(req.body);
  const nombre = v.textoRequerido('nombre', { min: 2, max: 100 });
  const apellido = v.textoRequerido('apellido', { min: 2, max: 100 });
  const email = v.emailRequerido('email');
  const password = v.passwordRequerido('password');
  v.validar();

  const existente = await selectOne('SELECT id_usuario FROM usuarios WHERE email = ?', [email]);
  if (existente) throw conflict('El correo electrónico ya está registrado');

  const passwordHash = await bcrypt.hash(password, env.bcryptRounds);
  const resultado = await execute(
    'INSERT INTO usuarios (nombre, apellido, email, password_hash) VALUES (?, ?, ?, ?)',
    [nombre, apellido, email, passwordHash]
  );

  const usuario = await obtenerPerfil(resultado.insertId);
  const token = firmarToken({ id: resultado.insertId, email });
  enviar(res, { token, usuario }, 'Usuario registrado correctamente', 201);
}

/** POST /api/auth/login */
export async function iniciarSesion(req: Request, res: Response): Promise<void> {
  const v = new Validador(req.body);
  const email = v.emailRequerido('email');
  const password = v.textoRequerido('password', { min: 1, max: 100 });
  v.validar();

  const fila = await selectOne<UsuarioRow>(
    'SELECT id_usuario, email, password_hash, activo FROM usuarios WHERE email = ?',
    [email]
  );

  const coincide = await bcrypt.compare(password, fila?.password_hash ?? HASH_FALSO);
  if (!fila || !fila.activo || !coincide) throw unauthorized('Correo o contraseña incorrectos');

  const usuario = await obtenerPerfil(fila.id_usuario);
  const token = firmarToken({ id: fila.id_usuario, email: fila.email });
  enviar(res, { token, usuario }, 'Inicio de sesión exitoso');
}

/** GET /api/auth/me */
export async function miPerfil(req: Request, res: Response): Promise<void> {
  const { id } = usuarioActual(req);
  const usuario = await obtenerPerfil(id);
  if (!usuario) throw notFound('Usuario no encontrado');
  enviar(res, usuario);
}

/** PUT /api/auth/me — edita datos del perfil y, opcionalmente, la contraseña. */
export async function actualizarPerfil(req: Request, res: Response): Promise<void> {
  const { id } = usuarioActual(req);
  const cuerpo = (req.body ?? {}) as Record<string, unknown>;

  const v = new Validador(cuerpo);
  const nombre = cuerpo.nombre !== undefined ? v.textoRequerido('nombre', { min: 2, max: 100 }) : undefined;
  const apellido = cuerpo.apellido !== undefined ? v.textoRequerido('apellido', { min: 2, max: 100 }) : undefined;
  const biografia = v.textoOpcional('biografia', { max: 500 });
  const avatarUrl = v.urlOpcional('avatar_url');

  const cambiaPassword = cuerpo.password_nueva !== undefined;
  const passwordActual = cambiaPassword ? v.textoRequerido('password_actual', { min: 1, max: 100 }) : '';
  const passwordNueva = cambiaPassword ? v.passwordRequerido('password_nueva') : '';
  v.validar();

  let passwordHash: string | undefined;
  if (cambiaPassword) {
    const fila = await selectOne<UsuarioRow>('SELECT password_hash FROM usuarios WHERE id_usuario = ?', [id]);
    if (!fila || !(await bcrypt.compare(passwordActual, fila.password_hash))) {
      throw unauthorized('La contraseña actual es incorrecta');
    }
    passwordHash = await bcrypt.hash(passwordNueva, env.bcryptRounds);
  }

  const set = construirSet({
    nombre,
    apellido,
    biografia,
    avatar_url: avatarUrl,
    password_hash: passwordHash,
  });
  if (!set) throw badRequest('No se envió ningún campo para actualizar');

  await execute(`UPDATE usuarios SET ${set.clausula} WHERE id_usuario = ?`, [...set.valores, id]);
  enviar(res, await obtenerPerfil(id), 'Perfil actualizado correctamente');
}
