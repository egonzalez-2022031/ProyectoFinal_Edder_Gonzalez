/**
 * Módulo de insignias y logros.
 */
import { Request, Response } from 'express';
import { select } from '../config/db';
import { usuarioActual } from '../middlewares/auth.middleware';
import { evaluarInsignias, obtenerMetricas, valorMetrica } from '../services/recompensas.service';
import { enviar } from '../utils/respuesta';

/**
 * GET /api/insignias — catálogo completo indicando cuáles obtuvo el usuario
 * y su progreso actual hacia cada una.
 */
export async function listarInsignias(req: Request, res: Response): Promise<void> {
  const { id } = usuarioActual(req);

  const [filas, metricas] = await Promise.all([
    select(
      `SELECT i.id_insignia, i.codigo, i.nombre, i.descripcion, i.icono,
              i.criterio_tipo, i.criterio_valor, ui.fecha_obtenida
         FROM insignias i
         LEFT JOIN usuario_insignias ui ON ui.id_insignia = i.id_insignia AND ui.id_usuario = ?
        ORDER BY i.criterio_tipo, i.criterio_valor`,
      [id]
    ),
    obtenerMetricas(id),
  ]);

  const insignias = filas.map((f) => {
    const actual = valorMetrica(metricas, f.criterio_tipo);
    return {
      ...f,
      obtenida: f.fecha_obtenida !== null,
      progreso_actual: Math.min(actual, f.criterio_valor),
      porcentaje_progreso: Math.min(100, Math.round((actual / f.criterio_valor) * 100)),
    };
  });

  enviar(res, {
    total: insignias.length,
    obtenidas: insignias.filter((i) => i.obtenida).length,
    insignias,
  });
}

/** GET /api/insignias/mis-insignias — solo las insignias obtenidas. */
export async function misInsignias(req: Request, res: Response): Promise<void> {
  const { id } = usuarioActual(req);
  const insignias = await select(
    `SELECT i.id_insignia, i.codigo, i.nombre, i.descripcion, i.icono,
            i.criterio_tipo, i.criterio_valor, ui.fecha_obtenida
       FROM usuario_insignias ui
       JOIN insignias i ON i.id_insignia = ui.id_insignia
      WHERE ui.id_usuario = ?
      ORDER BY ui.fecha_obtenida DESC, i.id_insignia DESC`,
    [id]
  );
  enviar(res, insignias);
}

/**
 * POST /api/insignias/evaluar — revisa los logros del usuario y otorga las
 * insignias pendientes (también ocurre automáticamente al completar un libro).
 */
export async function evaluar(req: Request, res: Response): Promise<void> {
  const { id } = usuarioActual(req);
  const nuevas = await evaluarInsignias(id);
  enviar(
    res,
    { nuevas_insignias: nuevas },
    nuevas.length > 0 ? '¡Ganaste nuevas insignias!' : 'No hay insignias nuevas por otorgar'
  );
}
