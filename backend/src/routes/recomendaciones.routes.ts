import { Router } from 'express';
import { catalogoPorGeneros, librosPorGenero, sugerirLibros } from '../controllers/recomendaciones.controller';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

router.get('/', asyncHandler(sugerirLibros));
router.get('/catalogo', asyncHandler(catalogoPorGeneros));
router.get('/genero/:idCategoria', asyncHandler(librosPorGenero));

export default router;
