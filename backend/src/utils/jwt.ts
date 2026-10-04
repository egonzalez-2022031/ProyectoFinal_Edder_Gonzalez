import jwt, { SignOptions } from 'jsonwebtoken';
import { env } from '../config/env';

/** Datos que viajan dentro del token JWT. */
export interface AuthPayload {
  id: number;
  email: string;
}

export function firmarToken(payload: AuthPayload): string {
  return jwt.sign(payload, env.jwt.secret, {
    expiresIn: env.jwt.expiresIn as SignOptions['expiresIn'],
  });
}

/** Verifica firma y expiración. Lanza las excepciones de jsonwebtoken si es inválido. */
export function verificarToken(token: string): AuthPayload {
  const decodificado = jwt.verify(token, env.jwt.secret);
  if (
    typeof decodificado === 'string' ||
    typeof decodificado.id !== 'number' ||
    typeof decodificado.email !== 'string'
  ) {
    throw new jwt.JsonWebTokenError('Payload del token inválido');
  }
  return { id: decodificado.id, email: decodificado.email };
}
