import { Router } from 'express';
import {
  actualizarMeta,
  crearMeta,
  eliminarMeta,
  listarMetas,
  metasVigentes,
  obtenerMeta,
} from '../controllers/metas.controller';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

router.get('/vigentes', asyncHandler(metasVigentes)); // antes de "/:id"
router.get('/', asyncHandler(listarMetas));
router.post('/', asyncHandler(crearMeta));
router.get('/:id', asyncHandler(obtenerMeta));
router.put('/:id', asyncHandler(actualizarMeta));
router.delete('/:id', asyncHandler(eliminarMeta));

export default router;
