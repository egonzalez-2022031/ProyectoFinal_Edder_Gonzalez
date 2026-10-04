import { SqlParam } from '../config/db';

/**
 * Construye la cláusula "col1 = ?, col2 = ?" de un UPDATE dinámico.
 *
 * IMPORTANTE: las CLAVES del objeto deben ser nombres de columna escritos en
 * el código (literales), nunca provenir del cuerpo de la petición. Los VALORES
 * siempre viajan como parámetros preparados.
 *
 * Los campos con valor `undefined` se omiten. Devuelve null si no hay nada que actualizar.
 */
export function construirSet(
  campos: Record<string, SqlParam>
): { clausula: string; valores: SqlParam[] } | null {
  const entradas = Object.entries(campos).filter(([, valor]) => valor !== undefined);
  if (entradas.length === 0) return null;
  return {
    clausula: entradas.map(([columna]) => `${columna} = ?`).join(', '),
    valores: entradas.map(([, valor]) => valor),
  };
}

/** Escapa los comodines de LIKE (% _ \) para búsquedas literales. */
export function escaparLike(texto: string): string {
  return texto.replace(/[\\%_]/g, '\\$&');
}

/** Fecha local de hoy en formato YYYY-MM-DD. */
export function fechaHoy(): string {
  const d = new Date();
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mes}-${dia}`;
}
