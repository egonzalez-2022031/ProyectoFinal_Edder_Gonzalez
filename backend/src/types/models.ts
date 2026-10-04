/** Tipos de las filas de MySQL usadas por los controladores y servicios. */
import { RowDataPacket } from 'mysql2/promise';

export const ESTADOS_LECTURA = ['pendiente', 'en_lectura', 'completado'] as const;
export type EstadoLectura = (typeof ESTADOS_LECTURA)[number];

export const TIPOS_PERIODO = ['mensual', 'anual'] as const;
export type TipoPeriodo = (typeof TIPOS_PERIODO)[number];

export type CriterioInsignia = 'libros_completados' | 'puntos' | 'metas_cumplidas';

export interface UsuarioRow extends RowDataPacket {
  id_usuario: number;
  nombre: string;
  apellido: string;
  email: string;
  password_hash: string;
  avatar_url: string | null;
  biografia: string | null;
  puntos_totales: number;
  activo: number;
  fecha_registro: string;
}

export interface LibroRow extends RowDataPacket {
  id_libro: number;
  titulo: string;
  autor: string;
  id_categoria: number;
  isbn: string | null;
  num_paginas: number | null;
  anio_publicacion: number | null;
  sinopsis: string | null;
  portada_url: string | null;
  id_creador: number | null;
  fecha_registro: string;
}

export interface LecturaRow extends RowDataPacket {
  id_lectura: number;
  id_usuario: number;
  id_libro: number;
  estado: EstadoLectura;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  calificacion: number | null;
  puntos_otorgados: number;
  fecha_registro: string;
}

export interface InsigniaRow extends RowDataPacket {
  id_insignia: number;
  codigo: string;
  nombre: string;
  descripcion: string;
  icono: string | null;
  criterio_tipo: CriterioInsignia;
  criterio_valor: number;
}
