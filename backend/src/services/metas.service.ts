/**
 * Lógica compartida de metas de lectura: cálculo del % de avance en tiempo
 * de ejecución a partir de las lecturas completadas dentro del periodo.
 */
import { RowDataPacket } from 'mysql2/promise';
import { pool, Queryable, select, selectOne, SqlParam } from '../config/db';
import { TipoPeriodo } from '../types/models';

/** SELECT base: cada meta + cuántos libros completó el usuario en su periodo. */
const PROGRESO_SQL = `
  SELECT m.id_meta, m.id_usuario, m.tipo_periodo, m.anio, m.mes,
         m.cantidad_objetivo, m.fecha_creacion,
         (SELECT COUNT(*)
            FROM lecturas_usuario lu
           WHERE lu.id_usuario = m.id_usuario
             AND lu.estado = 'completado'
             AND lu.fecha_fin IS NOT NULL
             AND YEAR(lu.fecha_fin) = m.anio
             AND (m.tipo_periodo = 'anual' OR MONTH(lu.fecha_fin) = m.mes)
         ) AS libros_completados
    FROM metas m`;

export interface MetaConProgreso {
  id_meta: number;
  id_usuario: number;
  tipo_periodo: TipoPeriodo;
  anio: number;
  mes: number;
  cantidad_objetivo: number;
  fecha_creacion: string;
  libros_completados: number;
  libros_restantes: number;
  porcentaje_avance: number; // 0 - 100 (tope en 100)
  cumplida: boolean;
}

function calcularProgreso(fila: RowDataPacket): MetaConProgreso {
  const objetivo = Number(fila.cantidad_objetivo);
  const completados = Number(fila.libros_completados);
  const porcentaje = Math.min(100, Math.round((completados / objetivo) * 10000) / 100);
  return {
    id_meta: fila.id_meta,
    id_usuario: fila.id_usuario,
    tipo_periodo: fila.tipo_periodo,
    anio: fila.anio,
    mes: fila.mes,
    cantidad_objetivo: objetivo,
    fecha_creacion: fila.fecha_creacion,
    libros_completados: completados,
    libros_restantes: Math.max(objetivo - completados, 0),
    porcentaje_avance: porcentaje,
    cumplida: completados >= objetivo,
  };
}

export interface FiltrosMetas {
  idMeta?: number;
  anio?: number;
  tipo?: TipoPeriodo;
}

/** Lista las metas de un usuario con su progreso calculado al momento. */
export async function listarMetasConProgreso(
  idUsuario: number,
  filtros: FiltrosMetas = {},
  db: Queryable = pool
): Promise<MetaConProgreso[]> {
  const condiciones = ['m.id_usuario = ?'];
  const params: SqlParam[] = [idUsuario];

  if (filtros.idMeta !== undefined) {
    condiciones.push('m.id_meta = ?');
    params.push(filtros.idMeta);
  }
  if (filtros.anio !== undefined) {
    condiciones.push('m.anio = ?');
    params.push(filtros.anio);
  }
  if (filtros.tipo !== undefined) {
    condiciones.push('m.tipo_periodo = ?');
    params.push(filtros.tipo);
  }

  const filas = await select(
    `${PROGRESO_SQL}
      WHERE ${condiciones.join(' AND ')}
      ORDER BY m.anio DESC, m.mes DESC, m.tipo_periodo`,
    params,
    db
  );
  return filas.map(calcularProgreso);
}

/** Cantidad de metas que el usuario tiene actualmente cumplidas. */
export async function contarMetasCumplidas(idUsuario: number, db: Queryable = pool): Promise<number> {
  const fila = await selectOne(
    `SELECT COUNT(*) AS total
       FROM (${PROGRESO_SQL} WHERE m.id_usuario = ?) t
      WHERE t.libros_completados >= t.cantidad_objetivo`,
    [idUsuario],
    db
  );
  return Number(fila?.total ?? 0);
}
