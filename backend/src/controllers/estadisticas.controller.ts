/**
 * Módulo de estadísticas: consultas agregadas del historial de lectura.
 */
import { Request, Response } from 'express';
import { usuarioActual } from '../middlewares/auth.middleware';
import {
  obtenerCumplimientoMetas,
  obtenerGenerosMasLeidos,
  obtenerLecturasPorMes,
  obtenerResumen,
} from '../services/estadisticas.service';
import { enviar } from '../utils/respuesta';
import { parseEnteroQuery } from '../utils/validators';

const ANIO_ACTUAL = () => new Date().getFullYear();

/** GET /api/estadisticas/resumen — total de libros leídos, en lectura, páginas, puntos... */
export async function resumen(req: Request, res: Response): Promise<void> {
  const { id } = usuarioActual(req);
  enviar(res, await obtenerResumen(id));
}

/** GET /api/estadisticas/lecturas-por-mes?anio=2026 */
export async function lecturasPorMes(req: Request, res: Response): Promise<void> {
  const { id } = usuarioActual(req);
  const anio = parseEnteroQuery(req.query.anio, ANIO_ACTUAL(), 2000, 2100, 'anio');
  enviar(res, await obtenerLecturasPorMes(id, anio));
}

/** GET /api/estadisticas/generos?limit=10 — géneros más leídos. */
export async function generosMasLeidos(req: Request, res: Response): Promise<void> {
  const { id } = usuarioActual(req);
  const limite = parseEnteroQuery(req.query.limit, 10, 1, 50, 'limit');
  enviar(res, await obtenerGenerosMasLeidos(id, limite));
}

/** GET /api/estadisticas/cumplimiento-metas?anio=2026 */
export async function cumplimientoMetas(req: Request, res: Response): Promise<void> {
  const { id } = usuarioActual(req);
  const anio =
    req.query.anio !== undefined && req.query.anio !== ''
      ? parseEnteroQuery(req.query.anio, 0, 2000, 2100, 'anio')
      : undefined;
  enviar(res, await obtenerCumplimientoMetas(id, anio));
}

/** GET /api/estadisticas/dashboard — todo lo anterior en una sola llamada. */
export async function dashboard(req: Request, res: Response): Promise<void> {
  const { id } = usuarioActual(req);
  const anio = parseEnteroQuery(req.query.anio, ANIO_ACTUAL(), 2000, 2100, 'anio');

  const [resumenGeneral, porMes, generos, metas] = await Promise.all([
    obtenerResumen(id),
    obtenerLecturasPorMes(id, anio),
    obtenerGenerosMasLeidos(id, 5),
    obtenerCumplimientoMetas(id, anio),
  ]);

  enviar(res, {
    resumen: resumenGeneral,
    lecturas_por_mes: porMes,
    generos_mas_leidos: generos,
    cumplimiento_metas: metas,
  });
}
