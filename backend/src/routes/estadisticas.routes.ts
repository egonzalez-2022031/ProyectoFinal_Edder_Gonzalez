import { Router } from 'express';
import {
  cumplimientoMetas,
  dashboard,
  generosMasLeidos,
  lecturasPorMes,
  resumen,
} from '../controllers/estadisticas.controller';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

router.get('/dashboard', asyncHandler(dashboard));
router.get('/resumen', asyncHandler(resumen));
router.get('/lecturas-por-mes', asyncHandler(lecturasPorMes));
router.get('/generos', asyncHandler(generosMasLeidos));
router.get('/cumplimiento-metas', asyncHandler(cumplimientoMetas));

export default router;
