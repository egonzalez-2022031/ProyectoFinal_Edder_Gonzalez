/**
 * Punto de entrada: verifica la base de datos y levanta el servidor HTTP.
 */
import app from './app';
import { pool, verificarConexion } from './config/db';
import { env } from './config/env';

async function iniciar(): Promise<void> {
  try {
    await verificarConexion();
    console.log(`✔ Conectado a MySQL (${env.db.host}:${env.db.port}/${env.db.database})`);
  } catch (error) {
    console.error('✘ No se pudo conectar a MySQL. Revisa las credenciales del archivo .env');
    console.error(error);
    process.exit(1);
  }

  const servidor = app.listen(env.port, () => {
    console.log(`✔ PassionBook API escuchando en http://localhost:${env.port}/api (modo ${env.nodeEnv})`);
  });

  // Cierre ordenado con Ctrl+C o al detener el proceso
  const apagar = (senal: string) => {
    console.log(`\n${senal} recibida: cerrando servidor...`);
    servidor.close(async () => {
      await pool.end();
      process.exit(0);
    });
  };
  process.on('SIGINT', () => apagar('SIGINT'));
  process.on('SIGTERM', () => apagar('SIGTERM'));
}

void iniciar();
