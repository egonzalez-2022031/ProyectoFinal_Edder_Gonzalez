/**
 * Módulo de metas de lectura (por mes o por año) con avance calculado
 * automáticamente en cada consulta.
 */
import { Request, Response } from 'express';
import { execute, selectOne } from '../config/db';
import { usuarioActual } from '../middlewares/auth.middleware';
import { listarMetasConProgreso } from '../services/metas.service';
import { TIPOS_PERIODO } from '../types/models';
import { badRequest, conflict, notFound } from '../utils/httpError';
import { enviar } from '../utils/respuesta';
import { parseEnteroQuery, parseId, Validador } from '../utils/validators';

const ANIO_MIN = 2000;
const ANIO_MAX = 2100;

async function buscarMeta(idMeta: number, idUsuario: number) {
  const [meta] = await listarMetasConProgreso(idUsuario, { idMeta });
  if (!meta) throw notFound('Meta no encontrada');
  return meta;
}

/** POST /api/metas — body: { tipo_periodo, anio, mes?, cantidad_objetivo } */
export async function crearMeta(req: Request, res: Response): Promise<void> {
  const { id } = usuarioActual(req);

  const v = new Validador(req.body);
  const tipo = v.enumRequerido('tipo_periodo', TIPOS_PERIODO);
  const anio = v.enteroRequerido('anio', { min: ANIO_MIN, max: ANIO_MAX });
  const cantidad = v.enteroRequerido('cantidad_objetivo', { min: 1, max: 1000 });
  const mesEnviado = v.enteroOpcional('mes', { min: 0, max: 12 });
  v.validar();

  // Las metas anuales se guardan con mes = 0; las mensuales exigen un mes de 1 a 12.
  let mes = 0;
  if (tipo === 'mensual') {
    if (!mesEnviado) throw badRequest('Datos inválidos', { mes: 'Es obligatorio para metas mensuales (1-12)' });
    mes = mesEnviado;
  }

  const duplicada = await selectOne(
    'SELECT id_meta FROM metas WHERE id_usuario = ? AND tipo_periodo = ? AND anio = ? AND mes = ?',
    [id, tipo, anio, mes]
  );
  if (duplicada) throw conflict('Ya tienes una meta definida para ese periodo. Edítala en lugar de crear otra');

  const resultado = await execute(
    'INSERT INTO metas (id_usuario, tipo_periodo, anio, mes, cantidad_objetivo) VALUES (?, ?, ?, ?, ?)',
    [id, tipo, anio, mes, cantidad]
  );
  enviar(res, await buscarMeta(resultado.insertId, id), 'Meta creada correctamente', 201);
}

/** GET /api/metas?anio=&tipo= — metas del usuario con su % de avance. */
export async function listarMetas(req: Request, res: Response): Promise<void> {
  const { id } = usuarioActual(req);
  const v = new Validador(req.query);
  const tipo = v.enumOpcional('tipo', TIPOS_PERIODO);
  v.validar();

  const anio =
    req.query.anio !== undefined && req.query.anio !== ''
      ? parseEnteroQuery(req.query.anio, 0, ANIO_MIN, ANIO_MAX, 'anio')
      : undefined;

  enviar(res, await listarMetasConProgreso(id, { anio, tipo }));
}

/** GET /api/metas/vigentes — meta del mes actual y del año actual (para el dashboard). */
export async function metasVigentes(req: Request, res: Response): Promise<void> {
  const { id } = usuarioActual(req);
  const hoy = new Date();
  const anio = hoy.getFullYear();
  const mes = hoy.getMonth() + 1;

  const delAnio = await listarMetasConProgreso(id, { anio });
  enviar(res, {
    anio,
    mes,
    mensual: delAnio.find((m) => m.tipo_periodo === 'mensual' && m.mes === mes) ?? null,
    anual: delAnio.find((m) => m.tipo_periodo === 'anual') ?? null,
  });
}

/** GET /api/metas/:id */
export async function obtenerMeta(req: Request, res: Response): Promise<void> {
  const { id } = usuarioActual(req);
  enviar(res, await buscarMeta(parseId(req.params.id), id));
}

/** PUT /api/metas/:id — solo se puede cambiar la cantidad objetivo. */
export async function actualizarMeta(req: Request, res: Response): Promise<void> {
  const { id } = usuarioActual(req);
  const idMeta = parseId(req.params.id);

  const v = new Validador(req.body);
  const cantidad = v.enteroRequerido('cantidad_objetivo', { min: 1, max: 1000 });
  v.validar();

  await buscarMeta(idMeta, id); // 404 si no existe o no es del usuario
  await execute('UPDATE metas SET cantidad_objetivo = ? WHERE id_meta = ? AND id_usuario = ?', [cantidad, idMeta, id]);
  enviar(res, await buscarMeta(idMeta, id), 'Meta actualizada correctamente');
}

/** DELETE /api/metas/:id */
export async function eliminarMeta(req: Request, res: Response): Promise<void> {
  const { id } = usuarioActual(req);
  const idMeta = parseId(req.params.id);

  const resultado = await execute('DELETE FROM metas WHERE id_meta = ? AND id_usuario = ?', [idMeta, id]);
  if (resultado.affectedRows === 0) throw notFound('Meta no encontrada');
  enviar(res, { id_meta: idMeta }, 'Meta eliminada correctamente');
}
