/**
 * Módulo de ranking: tabla de posiciones por puntos acumulados.
 */
import { Request, Response } from 'express';
import { select, selectOne } from '../config/db';
import { usuarioActual } from '../middlewares/auth.middleware';
import { enviar } from '../utils/respuesta';
import { parseEnteroQuery } from '../utils/validators';

// CTE con la posición de cada usuario. RANK() asigna la misma posición en caso de empate.
// (Requiere MySQL 8+). Nunca se expone el correo ni datos privados.
const RANKING_CTE = `
  WITH ranking AS (
    SELECT u.id_usuario, u.nombre, u.apellido, u.avatar_url, u.puntos_totales,
           (SELECT COUNT(*) FROM lecturas_usuario lu
             WHERE lu.id_usuario = u.id_usuario AND lu.estado = 'completado') AS libros_completados,
           (SELECT COUNT(*) FROM usuario_insignias ui
             WHERE ui.id_usuario = u.id_usuario) AS total_insignias,
           RANK() OVER (ORDER BY u.puntos_totales DESC) AS posicion
      FROM usuarios u
     WHERE u.activo = 1
  )`;

/** GET /api/ranking?limit=10 — top de usuarios y posición del usuario actual. */
export async function obtenerRanking(req: Request, res: Response): Promise<void> {
  const { id } = usuarioActual(req);
  const limite = parseEnteroQuery(req.query.limit, 10, 1, 100, 'limit');

  const top = await select(`${RANKING_CTE} SELECT * FROM ranking ORDER BY posicion ASC, nombre ASC LIMIT ${limite}`);
  const miPosicion = await selectOne(`${RANKING_CTE} SELECT * FROM ranking WHERE id_usuario = ?`, [id]);

  enviar(res, {
    ranking: top.map((fila) => ({ ...fila, es_usuario_actual: fila.id_usuario === id })),
    mi_posicion: miPosicion,
  });
}
