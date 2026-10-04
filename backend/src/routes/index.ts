/**
 * Router principal: monta cada módulo bajo /api.
 * Todo excepto /auth/register, /auth/login y /health exige token JWT.
 */
import { Router } from 'express';
import { verificarConexion } from '../config/db';
import { autenticar } from '../middlewares/auth.middleware';
import { asyncHandler } from '../utils/asyncHandler';
import { enviar } from '../utils/respuesta';
import authRoutes from './auth.routes';
import estadisticasRoutes from './estadisticas.routes';
import insigniasRoutes from './insignias.routes';
import librosRoutes from './libros.routes';
import metasRoutes from './metas.routes';
import rankingRoutes from './ranking.routes';
import recomendacionesRoutes from './recomendaciones.routes';

const router = Router();

// Salud del servicio y de la base de datos (pública)
router.get(
  '/health',
  asyncHandler(async (_req, res) => {
    await verificarConexion();
    enviar(res, { servicio: 'PassionBook API', estado: 'operativo', fecha: new Date().toISOString() });
  })
);

router.use('/auth', authRoutes); // /register y /login públicas; /me protegida dentro del router

// Rutas privadas: el middleware valida el JWT antes de llegar al controlador
router.use('/libros', autenticar, librosRoutes);
router.use('/metas', autenticar, metasRoutes);
router.use('/recomendaciones', autenticar, recomendacionesRoutes);
router.use('/ranking', autenticar, rankingRoutes);
router.use('/insignias', autenticar, insigniasRoutes);
router.use('/estadisticas', autenticar, estadisticasRoutes);

export default router;
