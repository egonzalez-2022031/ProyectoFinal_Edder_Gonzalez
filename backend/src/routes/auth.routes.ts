import { Router } from 'express';
import { actualizarPerfil, iniciarSesion, miPerfil, registrar } from '../controllers/auth.controller';
import { autenticar } from '../middlewares/auth.middleware';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

// Públicas
router.post('/register', asyncHandler(registrar));
router.post('/login', asyncHandler(iniciarSesion));

// Privadas (requieren token JWT)
router.get('/me', autenticar, asyncHandler(miPerfil));
router.put('/me', autenticar, asyncHandler(actualizarPerfil));

export default router;
