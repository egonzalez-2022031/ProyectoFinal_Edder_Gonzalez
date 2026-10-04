/**
 * Middleware de autenticación: protege las rutas privadas verificando el
 * token JWT enviado en la cabecera  Authorization: Bearer <token>
 */
import { NextFunction, Request, Response } from 'express';
import { TokenExpiredError } from 'jsonwebtoken';
import { AuthPayload, verificarToken } from '../utils/jwt';
import { unauthorized } from '../utils/httpError';

// Agrega `req.usuario` al tipo Request de Express.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      usuario?: AuthPayload;
    }
  }
}

export function autenticar(req: Request, _res: Response, next: NextFunction): void {
  const cabecera = req.headers.authorization;
  if (!cabecera || !cabecera.startsWith('Bearer ')) {
    return next(unauthorized('Token no proporcionado. Usa la cabecera Authorization: Bearer <token>'));
  }

  const token = cabecera.slice(7).trim();
  try {
    req.usuario = verificarToken(token);
    next();
  } catch (error) {
    if (error instanceof TokenExpiredError) {
      return next(unauthorized('El token ha expirado, inicia sesión nuevamente'));
    }
    next(unauthorized('Token inválido'));
  }
}

/** Devuelve el usuario autenticado de la petición (o lanza 401 si no existe). */
export function usuarioActual(req: Request): AuthPayload {
  if (!req.usuario) throw unauthorized();
  return req.usuario;
}
