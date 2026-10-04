import { Response } from 'express';

/**
 * Formato uniforme de respuestas exitosas:
 *   { ok: true, mensaje?: string, data: ... }
 * (Los errores usan { ok: false, mensaje, detalles? } desde error.middleware.ts)
 */
export function enviar<T>(res: Response, data: T, mensaje?: string, status = 200): Response {
  return res.status(status).json({ ok: true, ...(mensaje ? { mensaje } : {}), data });
}
