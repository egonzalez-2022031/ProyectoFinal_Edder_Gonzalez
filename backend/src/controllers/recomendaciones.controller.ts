/**
 * Módulo de recomendaciones: sugerencias sencillas basadas en los géneros
 * que el usuario más ha completado + popularidad, y catálogo agrupado por género.
 */
import { Request, Response } from 'express';
import { select, selectOne } from '../config/db';
import { usuarioActual } from '../middlewares/auth.middleware';
import { notFound } from '../utils/httpError';
import { enviar } from '../utils/respuesta';
import { parseEnteroQuery, parseId } from '../utils/validators';

/**
 * GET /api/recomendaciones?limit=10
 * Sugiere libros que el usuario aún no tiene en su lista, ordenados por:
 *   1) afinidad: cuántos libros del mismo género ha completado,
 *   2) popularidad: cuántos usuarios lo completaron,
 *   3) calificación promedio.
 * Sin historial, se muestran los más populares de la comunidad.
 */
export async function sugerirLibros(req: Request, res: Response): Promise<void> {
  const { id } = usuarioActual(req);
  const limite = parseEnteroQuery(req.query.limit, 10, 1, 50, 'limit');

  const filas = await select(
    `SELECT l.id_libro, l.titulo, l.autor, l.num_paginas, l.anio_publicacion,
            l.sinopsis, l.portada_url, c.id_categoria, c.nombre AS categoria,
            COALESCE(af.afinidad, 0)          AS afinidad,
            COALESCE(pop.total_lecturas, 0)   AS total_lecturas,
            pop.calificacion_promedio         AS calificacion_promedio
       FROM libros l
       JOIN categorias c ON c.id_categoria = l.id_categoria
       LEFT JOIN (
            SELECT id_libro, COUNT(*) AS total_lecturas, ROUND(AVG(calificacion), 2) AS calificacion_promedio
              FROM lecturas_usuario
             WHERE estado = 'completado'
             GROUP BY id_libro
       ) pop ON pop.id_libro = l.id_libro
       LEFT JOIN (
            SELECT li.id_categoria, COUNT(*) AS afinidad
              FROM lecturas_usuario lu
              JOIN libros li ON li.id_libro = lu.id_libro
             WHERE lu.id_usuario = ? AND lu.estado = 'completado'
             GROUP BY li.id_categoria
       ) af ON af.id_categoria = l.id_categoria
      WHERE NOT EXISTS (
             SELECT 1 FROM lecturas_usuario x
              WHERE x.id_usuario = ? AND x.id_libro = l.id_libro)
      ORDER BY afinidad DESC, total_lecturas DESC,
               COALESCE(pop.calificacion_promedio, 0) DESC, l.titulo ASC
      LIMIT ${limite}`,
    [id, id]
  );

  const recomendaciones = filas.map((f) => ({
    ...f,
    motivo: Number(f.afinidad) > 0 ? `Porque has leído libros de ${f.categoria}` : 'Popular en la comunidad',
  }));
  enviar(res, recomendaciones);
}

/**
 * GET /api/recomendaciones/catalogo
 * Catálogo completo organizado por género: [{ categoria, libros: [...] }]
 */
export async function catalogoPorGeneros(req: Request, res: Response): Promise<void> {
  const { id } = usuarioActual(req);

  const filas = await select(
    `SELECT c.id_categoria, c.nombre AS genero, c.descripcion AS genero_descripcion,
            l.id_libro, l.titulo, l.autor, l.num_paginas, l.anio_publicacion, l.portada_url,
            lu.estado AS mi_estado
       FROM categorias c
       LEFT JOIN libros l ON l.id_categoria = c.id_categoria
       LEFT JOIN lecturas_usuario lu ON lu.id_libro = l.id_libro AND lu.id_usuario = ?
      ORDER BY c.nombre ASC, l.titulo ASC`,
    [id]
  );

  interface Grupo {
    id_categoria: number;
    genero: string;
    descripcion: string | null;
    total_libros: number;
    libros: Array<Record<string, unknown>>;
  }
  const grupos = new Map<number, Grupo>();

  for (const f of filas) {
    let grupo = grupos.get(f.id_categoria);
    if (!grupo) {
      grupo = { id_categoria: f.id_categoria, genero: f.genero, descripcion: f.genero_descripcion, total_libros: 0, libros: [] };
      grupos.set(f.id_categoria, grupo);
    }
    if (f.id_libro !== null) {
      grupo.libros.push({
        id_libro: f.id_libro,
        titulo: f.titulo,
        autor: f.autor,
        num_paginas: f.num_paginas,
        anio_publicacion: f.anio_publicacion,
        portada_url: f.portada_url,
        mi_estado: f.mi_estado,
      });
      grupo.total_libros += 1;
    }
  }
  enviar(res, Array.from(grupos.values()));
}

/** GET /api/recomendaciones/genero/:idCategoria — libros de un género. */
export async function librosPorGenero(req: Request, res: Response): Promise<void> {
  const { id } = usuarioActual(req);
  const idCategoria = parseId(req.params.idCategoria, 'idCategoria');

  const categoria = await selectOne('SELECT id_categoria, nombre, descripcion FROM categorias WHERE id_categoria = ?', [idCategoria]);
  if (!categoria) throw notFound('Género no encontrado');

  const libros = await select(
    `SELECT l.id_libro, l.titulo, l.autor, l.num_paginas, l.anio_publicacion, l.sinopsis, l.portada_url,
            lu.estado AS mi_estado,
            (SELECT COUNT(*) FROM lecturas_usuario x
              WHERE x.id_libro = l.id_libro AND x.estado = 'completado') AS total_lectores
       FROM libros l
       LEFT JOIN lecturas_usuario lu ON lu.id_libro = l.id_libro AND lu.id_usuario = ?
      WHERE l.id_categoria = ?
      ORDER BY total_lectores DESC, l.titulo ASC`,
    [id, idCategoria]
  );
  enviar(res, { categoria, libros });
}
