/**
 * Consultas agregadas (COUNT / SUM / AVG + GROUP BY) para las estadísticas.
 * Todas cuentan únicamente lecturas con estado = 'completado'.
 */
import { select, selectOne } from '../config/db';
import { listarMetasConProgreso } from './metas.service';

const NOMBRES_MES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

/** Totales generales del usuario. */
export async function obtenerResumen(idUsuario: number) {
  const fila = await selectOne(
    `SELECT
        COUNT(CASE WHEN lu.estado = 'completado' THEN 1 END)  AS libros_leidos,
        COUNT(CASE WHEN lu.estado = 'en_lectura' THEN 1 END)  AS libros_en_lectura,
        COUNT(CASE WHEN lu.estado = 'pendiente'  THEN 1 END)  AS libros_pendientes,
        COALESCE(SUM(CASE WHEN lu.estado = 'completado' THEN l.num_paginas END), 0) AS paginas_leidas,
        ROUND(AVG(CASE WHEN lu.estado = 'completado' THEN lu.calificacion END), 2)  AS calificacion_promedio
       FROM lecturas_usuario lu
       JOIN libros l ON l.id_libro = lu.id_libro
      WHERE lu.id_usuario = ?`,
    [idUsuario]
  );
  const usuario = await selectOne('SELECT puntos_totales FROM usuarios WHERE id_usuario = ?', [idUsuario]);
  const insignias = await selectOne('SELECT COUNT(*) AS total FROM usuario_insignias WHERE id_usuario = ?', [idUsuario]);

  return {
    libros_leidos: Number(fila?.libros_leidos ?? 0),
    libros_en_lectura: Number(fila?.libros_en_lectura ?? 0),
    libros_pendientes: Number(fila?.libros_pendientes ?? 0),
    paginas_leidas: Number(fila?.paginas_leidas ?? 0),
    calificacion_promedio: fila?.calificacion_promedio ?? null,
    puntos_totales: Number(usuario?.puntos_totales ?? 0),
    total_insignias: Number(insignias?.total ?? 0),
  };
}

/** Libros completados por mes de un año (siempre devuelve los 12 meses). */
export async function obtenerLecturasPorMes(idUsuario: number, anio: number) {
  const filas = await select(
    `SELECT MONTH(fecha_fin) AS mes, COUNT(*) AS total
       FROM lecturas_usuario
      WHERE id_usuario = ? AND estado = 'completado'
        AND fecha_fin IS NOT NULL AND YEAR(fecha_fin) = ?
      GROUP BY MONTH(fecha_fin)`,
    [idUsuario, anio]
  );
  const porMes = new Map<number, number>(filas.map((f) => [Number(f.mes), Number(f.total)]));
  const meses = NOMBRES_MES.map((nombre, i) => ({
    mes: i + 1,
    nombre,
    total: porMes.get(i + 1) ?? 0,
  }));
  return {
    anio,
    total_anio: meses.reduce((suma, m) => suma + m.total, 0),
    meses,
  };
}

/** Géneros más leídos, de mayor a menor. */
export async function obtenerGenerosMasLeidos(idUsuario: number, limite: number) {
  const filas = await select(
    `SELECT c.id_categoria, c.nombre AS genero, COUNT(*) AS total
       FROM lecturas_usuario lu
       JOIN libros l      ON l.id_libro = lu.id_libro
       JOIN categorias c  ON c.id_categoria = l.id_categoria
      WHERE lu.id_usuario = ? AND lu.estado = 'completado'
      GROUP BY c.id_categoria, c.nombre
      ORDER BY total DESC, c.nombre ASC
      LIMIT ${Number(limite)}`,
    [idUsuario]
  );
  const totalGeneral = filas.reduce((suma, f) => suma + Number(f.total), 0);
  return filas.map((f) => ({
    id_categoria: f.id_categoria,
    genero: f.genero,
    total: Number(f.total),
    porcentaje: totalGeneral > 0 ? Math.round((Number(f.total) / totalGeneral) * 10000) / 100 : 0,
  }));
}

/** Cumplimiento de metas: detalle por meta y porcentaje global. */
export async function obtenerCumplimientoMetas(idUsuario: number, anio?: number) {
  const metas = await listarMetasConProgreso(idUsuario, { anio });
  const cumplidas = metas.filter((m) => m.cumplida).length;
  return {
    total_metas: metas.length,
    metas_cumplidas: cumplidas,
    porcentaje_cumplimiento: metas.length > 0 ? Math.round((cumplidas / metas.length) * 10000) / 100 : 0,
    metas,
  };
}
