import { Router } from 'express';
import { obtenerRanking } from '../controllers/ranking.controller';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

router.get('/', asyncHandler(obtenerRanking));

export default router;
