import { NextFunction, Request, RequestHandler, Response } from 'express';

/**
 * Envuelve un controlador async para que cualquier error (throw o promesa
 * rechazada) llegue al middleware global de errores mediante next(error).
 */
export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    fn(req, res, next).catch(next);
  };
