import { Router } from 'express';
import {
  actualizarLibro,
  cambiarEstado,
  crearLibro,
  eliminarLibro,
  listarCategorias,
  listarLibros,
  misLibros,
  obtenerLibro,
} from '../controllers/libros.controller';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router(); // El middleware `autenticar` se aplica en routes/index.ts

// Rutas fijas primero, para que "/categorias" y "/mis-libros" no se confundan con "/:id"
router.get('/categorias', asyncHandler(listarCategorias));
router.get('/mis-libros', asyncHandler(misLibros));

router.get('/', asyncHandler(listarLibros));
router.post('/', asyncHandler(crearLibro));
router.get('/:id', asyncHandler(obtenerLibro));
router.put('/:id', asyncHandler(actualizarLibro));
router.delete('/:id', asyncHandler(eliminarLibro));
router.patch('/:id/estado', asyncHandler(cambiarEstado));

export default router;
