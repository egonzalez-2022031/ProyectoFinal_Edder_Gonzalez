/**
 * Pool de conexiones MySQL (mysql2/promise) y utilidades para ejecutar
 * SQL puro con sentencias preparadas (prepared statements).
 *
 * Todas las consultas usan `execute()`, que envía los valores por separado
 * del SQL, lo que previene inyección SQL.
 */
import mysql, { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { env } from './env';

/** Valores aceptados como parámetros de una consulta. */
export type SqlParam = string | number | boolean | null | undefined | Date;

/** Un Pool o una conexión (esta última se usa dentro de transacciones). */
export type Queryable = Pool | PoolConnection;

export const pool: Pool = mysql.createPool({
  host: env.db.host,
  port: env.db.port,
  user: env.db.user,
  password: env.db.password,
  database: env.db.database,
  waitForConnections: true,
  connectionLimit: env.db.connectionLimit,
  queueLimit: 0,
  charset: 'utf8mb4',
  // Las columnas DATE/TIMESTAMP se devuelven como texto ("2026-09-12"),
  // evitando desfases de zona horaria al serializar a JSON.
  dateStrings: true,
  // DECIMAL (AVG, SUM...) se devuelve como number en lugar de string.
  decimalNumbers: true,
});

/** mysql2 no acepta `undefined` como parámetro: se convierte en NULL. */
function normalizar(params: SqlParam[]): Array<string | number | boolean | null | Date> {
  return params.map((p) => (p === undefined ? null : p));
}

/** Ejecuta un SELECT y devuelve todas las filas. */
export async function select<T extends RowDataPacket = RowDataPacket>(
  sql: string,
  params: SqlParam[] = [],
  db: Queryable = pool
): Promise<T[]> {
  const [filas] = await db.execute<T[]>(sql, normalizar(params));
  return filas;
}

/** Ejecuta un SELECT y devuelve la primera fila (o null si no hay resultados). */
export async function selectOne<T extends RowDataPacket = RowDataPacket>(
  sql: string,
  params: SqlParam[] = [],
  db: Queryable = pool
): Promise<T | null> {
  const filas = await select<T>(sql, params, db);
  return filas.length > 0 ? filas[0] : null;
}

/** Ejecuta INSERT / UPDATE / DELETE y devuelve insertId, affectedRows, etc. */
export async function execute(
  sql: string,
  params: SqlParam[] = [],
  db: Queryable = pool
): Promise<ResultSetHeader> {
  const [resultado] = await db.execute<ResultSetHeader>(sql, normalizar(params));
  return resultado;
}

/**
 * Ejecuta `trabajo` dentro de una transacción.
 * Si lanza un error se hace ROLLBACK; si termina bien, COMMIT.
 */
export async function withTransaction<T>(
  trabajo: (conexion: PoolConnection) => Promise<T>
): Promise<T> {
  const conexion = await pool.getConnection();
  try {
    await conexion.beginTransaction();
    const resultado = await trabajo(conexion);
    await conexion.commit();
    return resultado;
  } catch (error) {
    await conexion.rollback();
    throw error;
  } finally {
    conexion.release();
  }
}

/** Verifica que la base de datos responda (se usa al arrancar y en /api/health). */
export async function verificarConexion(): Promise<void> {
  await pool.query('SELECT 1');
}
