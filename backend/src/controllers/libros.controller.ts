/**
 * Módulo de libros: CRUD del catálogo, filtros por categoría/género,
 * lista personal del usuario y cambio de estado de lectura.
 *
 * Regla: el catálogo es compartido, pero solo quien registró un libro
 * puede editarlo o eliminarlo.
 */
import { Request, Response } from 'express';
import { execute, select, selectOne, SqlParam, withTransaction } from '../config/db';
import { usuarioActual } from '../middlewares/auth.middleware';
import { cambiarEstadoLectura, eliminarLecturaDeUsuario } from '../services/lecturas.service';
import { ESTADOS_LECTURA, LibroRow } from '../types/models';
import { badRequest, conflict, forbidden, notFound } from '../utils/httpError';
import { enviar } from '../utils/respuesta';
import { construirSet, escaparLike } from '../utils/sql';
import { parseId, parsePaginacion, Validador } from '../utils/validators';

const ANIO_MAXIMO = new Date().getFullYear() + 1;

// Columnas comunes de un libro con el nombre de su categoría.
const COLUMNAS_LIBRO = `
  l.id_libro, l.titulo, l.autor, l.isbn, l.num_paginas, l.anio_publicacion,
  l.sinopsis, l.portada_url, l.id_creador, l.id_categoria, c.nombre AS categoria`;

/** Obtiene un libro (con categoría y estado del usuario) o lanza 404. */
async function buscarLibro(idLibro: number, idUsuario: number) {
  const libro = await selectOne(
    `SELECT ${COLUMNAS_LIBRO},
            lu.estado AS mi_estado, lu.calificacion AS mi_calificacion,
            lu.fecha_inicio AS mi_fecha_inicio, lu.fecha_fin AS mi_fecha_fin,
            (SELECT COUNT(*) FROM lecturas_usuario x
              WHERE x.id_libro = l.id_libro AND x.estado = 'completado') AS total_lectores,
            (SELECT ROUND(AVG(x.calificacion), 2) FROM lecturas_usuario x
              WHERE x.id_libro = l.id_libro AND x.estado = 'completado') AS calificacion_promedio
       FROM libros l
       JOIN categorias c ON c.id_categoria = l.id_categoria
       LEFT JOIN lecturas_usuario lu ON lu.id_libro = l.id_libro AND lu.id_usuario = ?
      WHERE l.id_libro = ?`,
    [idUsuario, idLibro]
  );
  if (!libro) throw notFound('Libro no encontrado');
  return libro;
}

async function asegurarCategoria(idCategoria: number): Promise<void> {
  const categoria = await selectOne('SELECT id_categoria FROM categorias WHERE id_categoria = ?', [idCategoria]);
  if (!categoria) throw badRequest('La categoría indicada no existe');
}

/** GET /api/libros/categorias — lista de géneros para formularios y filtros. */
export async function listarCategorias(_req: Request, res: Response): Promise<void> {
  const categorias = await select(
    `SELECT c.id_categoria, c.nombre, c.descripcion,
            (SELECT COUNT(*) FROM libros l WHERE l.id_categoria = c.id_categoria) AS total_libros
       FROM categorias c
      ORDER BY c.nombre`
  );
  enviar(res, categorias);
}

/**
 * GET /api/libros — catálogo con filtros y paginación.
 * Query: categoria (id) | genero (nombre) | q (título/autor) | estado (mi estado) | page | limit
 */
export async function listarLibros(req: Request, res: Response): Promise<void> {
  const { id } = usuarioActual(req);
  const { page, limit, offset } = parsePaginacion(req.query as Record<string, unknown>);

  const condiciones: string[] = [];
  const params: SqlParam[] = [];

  if (req.query.categoria !== undefined && req.query.categoria !== '') {
    condiciones.push('l.id_categoria = ?');
    params.push(parseId(req.query.categoria, 'categoria'));
  }
  if (typeof req.query.genero === 'string' && req.query.genero.trim() !== '') {
    condiciones.push('c.nombre = ?');
    params.push(req.query.genero.trim());
  }
  if (typeof req.query.q === 'string' && req.query.q.trim() !== '') {
    const patron = `%${escaparLike(req.query.q.trim())}%`;
    condiciones.push('(l.titulo LIKE ? OR l.autor LIKE ?)');
    params.push(patron, patron);
  }
  const v = new Validador(req.query);
  const estado = v.enumOpcional('estado', ESTADOS_LECTURA);
  v.validar();
  if (estado) {
    condiciones.push('lu.estado = ?');
    params.push(estado);
  }

  const where = condiciones.length > 0 ? `WHERE ${condiciones.join(' AND ')}` : '';
  const desde = `
    FROM libros l
    JOIN categorias c ON c.id_categoria = l.id_categoria
    LEFT JOIN lecturas_usuario lu ON lu.id_libro = l.id_libro AND lu.id_usuario = ?`;

  const totalFila = await selectOne(`SELECT COUNT(*) AS total ${desde} ${where}`, [id, ...params]);
  const total = Number(totalFila?.total ?? 0);

  // LIMIT/OFFSET se interpolan porque ya son enteros validados (no vienen crudos del cliente).
  const libros = await select(
    `SELECT ${COLUMNAS_LIBRO}, lu.estado AS mi_estado, lu.calificacion AS mi_calificacion
     ${desde} ${where}
     ORDER BY l.titulo ASC
     LIMIT ${limit} OFFSET ${offset}`,
    [id, ...params]
  );

  enviar(res, {
    libros,
    paginacion: { page, limit, total, paginas: Math.max(1, Math.ceil(total / limit)) },
  });
}

/** GET /api/libros/mis-libros?estado= — lista personal del usuario. */
export async function misLibros(req: Request, res: Response): Promise<void> {
  const { id } = usuarioActual(req);
  const v = new Validador(req.query);
  const estado = v.enumOpcional('estado', ESTADOS_LECTURA);
  v.validar();

  const params: SqlParam[] = [id];
  let filtro = '';
  if (estado) {
    filtro = 'AND lu.estado = ?';
    params.push(estado);
  }

  const lecturas = await select(
    `SELECT lu.id_lectura, lu.estado, lu.fecha_inicio, lu.fecha_fin, lu.calificacion, lu.puntos_otorgados,
            l.id_libro, l.titulo, l.autor, l.num_paginas, l.portada_url,
            c.id_categoria, c.nombre AS categoria
       FROM lecturas_usuario lu
       JOIN libros l     ON l.id_libro = lu.id_libro
       JOIN categorias c ON c.id_categoria = l.id_categoria
      WHERE lu.id_usuario = ? ${filtro}
      ORDER BY FIELD(lu.estado, 'en_lectura', 'pendiente', 'completado'), lu.fecha_registro DESC`,
    params
  );
  enviar(res, lecturas);
}

/** GET /api/libros/:id */
export async function obtenerLibro(req: Request, res: Response): Promise<void> {
  const { id } = usuarioActual(req);
  enviar(res, await buscarLibro(parseId(req.params.id), id));
}

/** POST /api/libros — registra un libro (y opcionalmente lo agrega a mi lista con un estado). */
export async function crearLibro(req: Request, res: Response): Promise<void> {
  const { id } = usuarioActual(req);

  const v = new Validador(req.body);
  const titulo = v.textoRequerido('titulo', { min: 1, max: 200 });
  const autor = v.textoRequerido('autor', { min: 1, max: 150 });
  const idCategoria = v.enteroRequerido('id_categoria', { min: 1 });
  const isbn = v.textoOpcional('isbn', { max: 20 });
  const numPaginas = v.enteroOpcional('num_paginas', { min: 1, max: 65535 });
  const anio = v.enteroOpcional('anio_publicacion', { min: 1, max: ANIO_MAXIMO });
  const sinopsis = v.textoOpcional('sinopsis', { max: 5000 });
  const portadaUrl = v.urlOpcional('portada_url');
  const estado = v.enumOpcional('estado', ESTADOS_LECTURA);
  const calificacion = v.enteroOpcional('calificacion', { min: 1, max: 5 });
  const fechaInicio = v.fechaOpcional('fecha_inicio');
  const fechaFin = v.fechaOpcional('fecha_fin');
  v.validar();

  await asegurarCategoria(idCategoria);

  if (isbn) {
    const duplicado = await selectOne('SELECT id_libro FROM libros WHERE isbn = ?', [isbn]);
    if (duplicado) throw conflict('Ya existe un libro registrado con ese ISBN');
  }

  const resultado = await withTransaction(async (conn) => {
    const insercion = await execute(
      `INSERT INTO libros
         (titulo, autor, id_categoria, isbn, num_paginas, anio_publicacion, sinopsis, portada_url, id_creador)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [titulo, autor, idCategoria, isbn ?? null, numPaginas ?? null, anio ?? null, sinopsis ?? null, portadaUrl ?? null, id],
      conn
    );
    const idLibro = insercion.insertId;
    const cambio = estado
      ? await cambiarEstadoLectura(conn, id, idLibro, {
          estado,
          calificacion,
          fecha_inicio: fechaInicio,
          fecha_fin: fechaFin,
        })
      : null;
    return { idLibro, cambio };
  });

  const libro = await buscarLibro(resultado.idLibro, id);
  enviar(
    res,
    {
      libro,
      puntos_ganados: resultado.cambio?.puntos_ganados ?? 0,
      nuevas_insignias: resultado.cambio?.nuevas_insignias ?? [],
    },
    'Libro registrado correctamente',
    201
  );
}

/** PUT /api/libros/:id — edita un libro (solo su creador). Acepta campos parciales. */
export async function actualizarLibro(req: Request, res: Response): Promise<void> {
  const { id } = usuarioActual(req);
  const idLibro = parseId(req.params.id);

  const existente = await selectOne<LibroRow>('SELECT * FROM libros WHERE id_libro = ?', [idLibro]);
  if (!existente) throw notFound('Libro no encontrado');
  if (existente.id_creador !== id) throw forbidden('Solo quien registró el libro puede editarlo');

  const cuerpo = (req.body ?? {}) as Record<string, unknown>;
  const v = new Validador(cuerpo);
  const titulo = cuerpo.titulo !== undefined ? v.textoRequerido('titulo', { max: 200 }) : undefined;
  const autor = cuerpo.autor !== undefined ? v.textoRequerido('autor', { max: 150 }) : undefined;
  const idCategoria = cuerpo.id_categoria !== undefined ? v.enteroRequerido('id_categoria', { min: 1 }) : undefined;
  const isbn = v.textoOpcional('isbn', { max: 20 });
  const numPaginas = v.enteroOpcional('num_paginas', { min: 1, max: 65535 });
  const anio = v.enteroOpcional('anio_publicacion', { min: 1, max: ANIO_MAXIMO });
  const sinopsis = v.textoOpcional('sinopsis', { max: 5000 });
  const portadaUrl = v.urlOpcional('portada_url');
  v.validar();

  if (idCategoria !== undefined) await asegurarCategoria(idCategoria);
  if (isbn) {
    const duplicado = await selectOne('SELECT id_libro FROM libros WHERE isbn = ? AND id_libro <> ?', [isbn, idLibro]);
    if (duplicado) throw conflict('Ya existe otro libro registrado con ese ISBN');
  }

  const set = construirSet({
    titulo,
    autor,
    id_categoria: idCategoria,
    isbn,
    num_paginas: numPaginas,
    anio_publicacion: anio,
    sinopsis,
    portada_url: portadaUrl,
  });
  if (!set) throw badRequest('No se envió ningún campo para actualizar');

  await execute(`UPDATE libros SET ${set.clausula} WHERE id_libro = ?`, [...set.valores, idLibro]);
  enviar(res, await buscarLibro(idLibro, id), 'Libro actualizado correctamente');
}

/** DELETE /api/libros/:id — elimina un libro (solo su creador y si nadie más lo tiene en su lista). */
export async function eliminarLibro(req: Request, res: Response): Promise<void> {
  const { id } = usuarioActual(req);
  const idLibro = parseId(req.params.id);

  const existente = await selectOne<LibroRow>('SELECT * FROM libros WHERE id_libro = ?', [idLibro]);
  if (!existente) throw notFound('Libro no encontrado');
  if (existente.id_creador !== id) throw forbidden('Solo quien registró el libro puede eliminarlo');

  const otros = await selectOne(
    'SELECT COUNT(*) AS total FROM lecturas_usuario WHERE id_libro = ? AND id_usuario <> ?',
    [idLibro, id]
  );
  if (Number(otros?.total ?? 0) > 0) {
    throw conflict('No se puede eliminar: otros usuarios ya tienen este libro en su lista de lectura');
  }

  await withTransaction(async (conn) => {
    await eliminarLecturaDeUsuario(conn, id, idLibro); // retira puntos si estaba completado
    await execute('DELETE FROM libros WHERE id_libro = ?', [idLibro], conn);
  });
  enviar(res, { id_libro: idLibro }, 'Libro eliminado correctamente');
}

/**
 * PATCH /api/libros/:id/estado — cambia el estado de lectura del usuario.
 * Body: { estado, calificacion?, fecha_inicio?, fecha_fin? }
 * Al completar el libro se suman puntos y se evalúan las insignias.
 */
export async function cambiarEstado(req: Request, res: Response): Promise<void> {
  const { id } = usuarioActual(req);
  const idLibro = parseId(req.params.id);

  const v = new Validador(req.body);
  const estado = v.enumRequerido('estado', ESTADOS_LECTURA);
  const calificacion = v.enteroOpcional('calificacion', { min: 1, max: 5 });
  const fechaInicio = v.fechaOpcional('fecha_inicio');
  const fechaFin = v.fechaOpcional('fecha_fin');
  v.validar();

  const libro = await selectOne('SELECT id_libro FROM libros WHERE id_libro = ?', [idLibro]);
  if (!libro) throw notFound('Libro no encontrado');

  const resultado = await withTransaction((conn) =>
    cambiarEstadoLectura(conn, id, idLibro, {
      estado,
      calificacion,
      fecha_inicio: fechaInicio,
      fecha_fin: fechaFin,
    })
  );

  const mensaje =
    resultado.nuevas_insignias.length > 0
      ? '¡Estado actualizado! Ganaste nuevas insignias'
      : 'Estado de lectura actualizado';
  enviar(res, resultado, mensaje);
}
