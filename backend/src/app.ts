/**
 * Configuración de la aplicación Express (sin levantar el servidor).
 */
import cors from 'cors';
import express from 'express';
import { env } from './config/env';
import { manejarErrores, rutaNoEncontrada } from './middlewares/error.middleware';
import apiRouter from './routes';

const app = express();

app.disable('x-powered-by');
app.use(cors({ origin: env.corsOrigin }));
app.use(express.json({ limit: '1mb' }));

app.use('/api', apiRouter);

// Siempre al final: 404 y manejador global de errores
app.use(rutaNoEncontrada);
app.use(manejarErrores);

export default app;
