import { Router } from 'express';
import { evaluar, listarInsignias, misInsignias } from '../controllers/insignias.controller';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

router.get('/', asyncHandler(listarInsignias));
router.get('/mis-insignias', asyncHandler(misInsignias));
router.post('/evaluar', asyncHandler(evaluar));

export default router;
