/**
 * Error controlado de la API: lleva el código HTTP que se devolverá al cliente.
 * El middleware global (error.middleware.ts) lo convierte en una respuesta JSON.
 */
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly detalles?: unknown
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export const badRequest = (mensaje: string, detalles?: unknown) => new HttpError(400, mensaje, detalles);
export const unauthorized = (mensaje = 'No autenticado') => new HttpError(401, mensaje);
export const forbidden = (mensaje = 'No tienes permiso para realizar esta acción') => new HttpError(403, mensaje);
export const notFound = (mensaje = 'Recurso no encontrado') => new HttpError(404, mensaje);
export const conflict = (mensaje: string) => new HttpError(409, mensaje);
