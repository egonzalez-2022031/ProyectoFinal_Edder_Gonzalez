/**
 * Manejo global de errores. Convierte cualquier error en una respuesta JSON:
 *   { ok: false, mensaje: string, detalles?: any }
 */
import { ErrorRequestHandler, NextFunction, Request, RequestHandler, Response } from 'express';
import { env } from '../config/env';
import { HttpError } from '../utils/httpError';

/** Se ejecuta cuando ninguna ruta coincide (404). */
export const rutaNoEncontrada: RequestHandler = (req, _res, next) => {
  next(new HttpError(404, `Ruta no encontrada: ${req.method} ${req.originalUrl}`));
};

interface ErrorMySql {
  code?: string;
  errno?: number;
  sqlMessage?: string;
}

/** Traduce los errores más comunes de MySQL a respuestas HTTP entendibles. */
function traducirErrorMySql(error: ErrorMySql): HttpError | null {
  switch (error.code) {
    case 'ER_DUP_ENTRY':
      return new HttpError(409, 'Ya existe un registro con esos datos (valor duplicado)');
    case 'ER_NO_REFERENCED_ROW_2':
      return new HttpError(400, 'Referencia inválida: el registro relacionado no existe');
    case 'ER_ROW_IS_REFERENCED_2':
      return new HttpError(409, 'No se puede eliminar porque tiene registros relacionados');
    case 'ER_DATA_TOO_LONG':
    case 'ER_WARN_DATA_OUT_OF_RANGE':
    case 'ER_CHECK_CONSTRAINT_VIOLATED':
      return new HttpError(400, 'Algún dato enviado no cumple las restricciones de la base de datos');
    default:
      return null;
  }
}

export const manejarErrores: ErrorRequestHandler = (
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
) => {
  let httpError: HttpError | null = null;

  if (err instanceof HttpError) {
    httpError = err;
  } else if (typeof err === 'object' && err !== null) {
    const e = err as { type?: string } & ErrorMySql;
    if (e.type === 'entity.parse.failed') {
      httpError = new HttpError(400, 'El cuerpo de la petición no es un JSON válido');
    } else if (e.type === 'entity.too.large') {
      httpError = new HttpError(413, 'El cuerpo de la petición es demasiado grande');
    } else if (typeof e.code === 'string') {
      httpError = traducirErrorMySql(e);
    }
  }

  if (httpError) {
    res.status(httpError.status).json({
      ok: false,
      mensaje: httpError.message,
      ...(httpError.detalles !== undefined ? { detalles: httpError.detalles } : {}),
    });
    return;
  }

  // Error inesperado: se registra en consola y se oculta el detalle en producción.
  console.error(`[ERROR] ${req.method} ${req.originalUrl}`, err);
  res.status(500).json({
    ok: false,
    mensaje: 'Error interno del servidor',
    ...(env.esProduccion ? {} : { detalles: err instanceof Error ? err.message : String(err) }),
  });
};
