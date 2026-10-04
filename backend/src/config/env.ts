/**
 * Carga y valida las variables de entorno una sola vez.
 * El resto de la aplicación importa `env` en lugar de leer process.env.
 */
import dotenv from 'dotenv';
import path from 'path';

// Funciona tanto en desarrollo (src/config) como compilado (dist/config).
dotenv.config({ path: path.resolve(__dirname, '../../.env'), quiet: true });

function obligatoria(nombre: string): string {
  const valor = process.env[nombre];
  if (!valor || !valor.trim()) {
    throw new Error(
      `Falta la variable de entorno obligatoria "${nombre}". Copia .env.example a .env y complétala.`
    );
  }
  return valor.trim();
}

function entero(nombre: string, porDefecto: number): number {
  const valor = process.env[nombre];
  if (valor === undefined || valor.trim() === '') return porDefecto;
  const numero = Number(valor);
  if (!Number.isInteger(numero) || numero < 0) {
    throw new Error(`La variable de entorno "${nombre}" debe ser un entero positivo.`);
  }
  return numero;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  esProduccion: process.env.NODE_ENV === 'production',
  port: entero('PORT', 3000),
  corsOrigin: (process.env.CORS_ORIGIN ?? 'http://localhost:4200')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),
  db: {
    host: process.env.DB_HOST ?? 'localhost',
    port: entero('DB_PORT', 3306),
    user: process.env.DB_USER ?? 'root',
    password: process.env.DB_PASSWORD ?? '',
    database: process.env.DB_NAME ?? 'passionbook',
    connectionLimit: entero('DB_CONNECTION_LIMIT', 10),
  },
  jwt: {
    secret: obligatoria('JWT_SECRET'),
    expiresIn: process.env.JWT_EXPIRES_IN ?? '1d',
  },
  bcryptRounds: entero('BCRYPT_ROUNDS', 10),
  puntosPorLibro: entero('PUNTOS_POR_LIBRO', 20),
} as const;
