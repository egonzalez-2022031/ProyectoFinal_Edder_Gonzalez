/**
 * Sistema de recompensas: métricas del usuario y evaluación automática de
 * insignias. Se invoca cada vez que un usuario completa un libro.
 */
import { pool, Queryable, execute, select, selectOne } from '../config/db';
import { CriterioInsignia, InsigniaRow } from '../types/models';
import { contarMetasCumplidas } from './metas.service';

export interface MetricasUsuario {
  libros_completados: number;
  puntos: number;
  metas_cumplidas: number;
}

export async function obtenerMetricas(idUsuario: number, db: Queryable = pool): Promise<MetricasUsuario> {
  const fila = await selectOne(
    `SELECT
        (SELECT COUNT(*) FROM lecturas_usuario
          WHERE id_usuario = ? AND estado = 'completado') AS libros_completados,
        (SELECT puntos_totales FROM usuarios WHERE id_usuario = ?) AS puntos`,
    [idUsuario, idUsuario],
    db
  );
  return {
    libros_completados: Number(fila?.libros_completados ?? 0),
    puntos: Number(fila?.puntos ?? 0),
    metas_cumplidas: await contarMetasCumplidas(idUsuario, db),
  };
}

/** Valor actual de la métrica asociada al criterio de una insignia. */
export function valorMetrica(metricas: MetricasUsuario, criterio: CriterioInsignia): number {
  switch (criterio) {
    case 'libros_completados':
      return metricas.libros_completados;
    case 'puntos':
      return metricas.puntos;
    case 'metas_cumplidas':
      return metricas.metas_cumplidas;
  }
}

/**
 * Otorga todas las insignias que el usuario ya merece y aún no tiene.
 * Devuelve únicamente las insignias recién obtenidas.
 */
export async function evaluarInsignias(idUsuario: number, db: Queryable = pool): Promise<InsigniaRow[]> {
  const metricas = await obtenerMetricas(idUsuario, db);

  const pendientes = await select<InsigniaRow>(
    `SELECT i.*
       FROM insignias i
      WHERE NOT EXISTS (
              SELECT 1 FROM usuario_insignias ui
               WHERE ui.id_usuario = ? AND ui.id_insignia = i.id_insignia)
      ORDER BY i.id_insignia`,
    [idUsuario],
    db
  );

  const nuevas: InsigniaRow[] = [];
  for (const insignia of pendientes) {
    if (valorMetrica(metricas, insignia.criterio_tipo) >= insignia.criterio_valor) {
      // INSERT IGNORE: si dos peticiones coinciden, la segunda simplemente no inserta.
      const resultado = await execute(
        'INSERT IGNORE INTO usuario_insignias (id_usuario, id_insignia) VALUES (?, ?)',
        [idUsuario, insignia.id_insignia],
        db
      );
      if (resultado.affectedRows === 1) nuevas.push(insignia);
    }
  }
  return nuevas;
}
