/**
 * Lógica de negocio del estado de lectura (tabla lecturas_usuario):
 *  - Crea o actualiza la lectura del usuario para un libro.
 *  - Asigna puntos al completar un libro y los retira si deja de estar completado.
 *  - Evalúa las insignias nuevas tras completar una lectura.
 *
 * Debe ejecutarse dentro de una transacción (recibe la conexión).
 */
import { PoolConnection } from 'mysql2/promise';
import { env } from '../config/env';
import { execute, selectOne } from '../config/db';
import { EstadoLectura, InsigniaRow, LecturaRow } from '../types/models';
import { badRequest } from '../utils/httpError';
import { fechaHoy } from '../utils/sql';
import { evaluarInsignias } from './recompensas.service';

export interface CambioEstado {
  estado: EstadoLectura;
  calificacion?: number | null;
  fecha_inicio?: string | null;
  fecha_fin?: string | null;
}

export interface ResultadoCambioEstado {
  lectura: LecturaRow;
  puntos_ganados: number; // negativo si se retiraron puntos
  puntos_totales: number;
  nuevas_insignias: InsigniaRow[];
}

export async function cambiarEstadoLectura(
  conn: PoolConnection,
  idUsuario: number,
  idLibro: number,
  cambio: CambioEstado
): Promise<ResultadoCambioEstado> {
  const hoy = fechaHoy();

  // Bloquea la fila (si existe) para evitar doble asignación de puntos por peticiones simultáneas.
  const existente = await selectOne<LecturaRow>(
    'SELECT * FROM lecturas_usuario WHERE id_usuario = ? AND id_libro = ? FOR UPDATE',
    [idUsuario, idLibro],
    conn
  );

  const estadoPrevio = existente?.estado ?? null;

  // ---- Fechas y calificación según el nuevo estado ----
  let fechaInicio: string | null =
    cambio.fecha_inicio !== undefined ? cambio.fecha_inicio : existente?.fecha_inicio ?? null;
  let fechaFin: string | null = null;
  let calificacion: number | null = null;

  if (cambio.estado === 'pendiente') {
    fechaInicio = null;
  } else if (cambio.estado === 'en_lectura') {
    fechaInicio = fechaInicio ?? hoy;
    if (fechaInicio > hoy) throw badRequest('La fecha de inicio no puede estar en el futuro');
  } else {
    fechaFin = cambio.fecha_fin ?? hoy;
    fechaInicio = fechaInicio ?? fechaFin;
    if (fechaFin > hoy) throw badRequest('La fecha de fin no puede estar en el futuro');
    if (fechaInicio > fechaFin) {
      throw badRequest('La fecha de inicio no puede ser posterior a la fecha de fin');
    }
    calificacion = cambio.calificacion !== undefined ? cambio.calificacion : existente?.calificacion ?? null;
  }

  // ---- Puntos ----
  const eraCompletado = estadoPrevio === 'completado';
  const seraCompletado = cambio.estado === 'completado';
  let puntosOtorgados = existente?.puntos_otorgados ?? 0;
  let puntosGanados = 0;

  if (!eraCompletado && seraCompletado) {
    puntosOtorgados = env.puntosPorLibro;
    puntosGanados = env.puntosPorLibro;
  } else if (eraCompletado && !seraCompletado) {
    puntosGanados = -puntosOtorgados;
    puntosOtorgados = 0;
  }

  // ---- Inserta o actualiza la lectura ----
  let idLectura: number;
  if (existente) {
    idLectura = existente.id_lectura;
    await execute(
      `UPDATE lecturas_usuario
          SET estado = ?, fecha_inicio = ?, fecha_fin = ?, calificacion = ?, puntos_otorgados = ?
        WHERE id_lectura = ?`,
      [cambio.estado, fechaInicio, fechaFin, calificacion, puntosOtorgados, idLectura],
      conn
    );
  } else {
    const insercion = await execute(
      `INSERT INTO lecturas_usuario
         (id_usuario, id_libro, estado, fecha_inicio, fecha_fin, calificacion, puntos_otorgados)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [idUsuario, idLibro, cambio.estado, fechaInicio, fechaFin, calificacion, puntosOtorgados],
      conn
    );
    idLectura = insercion.insertId;
  }

  // ---- Actualiza el puntaje acumulado del usuario ----
  if (puntosGanados > 0) {
    await execute('UPDATE usuarios SET puntos_totales = puntos_totales + ? WHERE id_usuario = ?', [puntosGanados, idUsuario], conn);
  } else if (puntosGanados < 0) {
    await execute(
      'UPDATE usuarios SET puntos_totales = GREATEST(CAST(puntos_totales AS SIGNED) - ?, 0) WHERE id_usuario = ?',
      [-puntosGanados, idUsuario],
      conn
    );
  }

  // ---- Insignias: solo se evalúan cuando se completa un libro ----
  const nuevasInsignias = !eraCompletado && seraCompletado ? await evaluarInsignias(idUsuario, conn) : [];

  const lectura = (await selectOne<LecturaRow>('SELECT * FROM lecturas_usuario WHERE id_lectura = ?', [idLectura], conn))!;
  const usuario = await selectOne('SELECT puntos_totales FROM usuarios WHERE id_usuario = ?', [idUsuario], conn);

  return {
    lectura,
    puntos_ganados: puntosGanados,
    puntos_totales: Number(usuario?.puntos_totales ?? 0),
    nuevas_insignias: nuevasInsignias,
  };
}

/**
 * Elimina la lectura de un usuario para un libro, retirando los puntos
 * que había otorgado (si el libro estaba completado).
 */
export async function eliminarLecturaDeUsuario(
  conn: PoolConnection,
  idUsuario: number,
  idLibro: number
): Promise<void> {
  const lectura = await selectOne<LecturaRow>(
    'SELECT * FROM lecturas_usuario WHERE id_usuario = ? AND id_libro = ? FOR UPDATE',
    [idUsuario, idLibro],
    conn
  );
  if (!lectura) return;

  if (lectura.puntos_otorgados > 0) {
    await execute(
      'UPDATE usuarios SET puntos_totales = GREATEST(CAST(puntos_totales AS SIGNED) - ?, 0) WHERE id_usuario = ?',
      [lectura.puntos_otorgados, idUsuario],
      conn
    );
  }
  await execute('DELETE FROM lecturas_usuario WHERE id_lectura = ?', [lectura.id_lectura], conn);
}
