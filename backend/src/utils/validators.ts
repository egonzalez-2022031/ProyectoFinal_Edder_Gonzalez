/**
 * Validación sencilla de cuerpos de petición (sin librerías externas).
 * Acumula todos los errores y los lanza juntos con `validar()`.
 */
import { badRequest } from './httpError';

type Datos = Record<string, unknown>;

const REGEX_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const REGEX_FECHA = /^\d{4}-\d{2}-\d{2}$/;

export class Validador {
  private errores: Record<string, string> = {};
  private readonly datos: Datos;

  constructor(datos: unknown) {
    this.datos = datos !== null && typeof datos === 'object' ? (datos as Datos) : {};
  }

  private falta(campo: string): boolean {
    const v = this.datos[campo];
    return v === undefined || v === null || (typeof v === 'string' && v.trim() === '');
  }

  /** Texto obligatorio. */
  textoRequerido(campo: string, opciones: { min?: number; max?: number } = {}): string {
    const { min = 1, max = 255 } = opciones;
    const v = this.datos[campo];
    if (this.falta(campo)) {
      this.errores[campo] = 'Es obligatorio';
      return '';
    }
    if (typeof v !== 'string') {
      this.errores[campo] = 'Debe ser texto';
      return '';
    }
    const texto = v.trim();
    if (texto.length < min || texto.length > max) {
      this.errores[campo] = `Debe tener entre ${min} y ${max} caracteres`;
    }
    return texto;
  }

  /**
   * Texto opcional.
   * undefined = no se envió | null = se envió vacío (limpiar el valor) | string = valor.
   */
  textoOpcional(campo: string, opciones: { max?: number } = {}): string | null | undefined {
    const { max = 255 } = opciones;
    const v = this.datos[campo];
    if (v === undefined) return undefined;
    if (this.falta(campo)) return null;
    if (typeof v !== 'string') {
      this.errores[campo] = 'Debe ser texto';
      return undefined;
    }
    const texto = v.trim();
    if (texto.length > max) this.errores[campo] = `No puede superar ${max} caracteres`;
    return texto;
  }

  /** URL http(s) opcional. */
  urlOpcional(campo: string): string | null | undefined {
    const valor = this.textoOpcional(campo, { max: 255 });
    if (valor && !/^https?:\/\/\S+$/i.test(valor)) {
      this.errores[campo] = 'Debe ser una URL válida (http o https)';
    }
    return valor;
  }

  emailRequerido(campo: string): string {
    const texto = this.textoRequerido(campo, { max: 150 });
    if (texto && !REGEX_EMAIL.test(texto)) this.errores[campo] = 'Correo electrónico inválido';
    return texto.toLowerCase();
  }

  /** Contraseña: 8-72 caracteres (límite de bcrypt), con al menos una letra y un número. */
  passwordRequerido(campo: string): string {
    const v = this.datos[campo];
    if (typeof v !== 'string' || v === '') {
      this.errores[campo] = 'Es obligatoria';
      return '';
    }
    if (v.length < 8 || Buffer.byteLength(v, 'utf8') > 72) {
      this.errores[campo] = 'Debe tener entre 8 y 72 caracteres';
    } else if (!/[A-Za-z]/.test(v) || !/\d/.test(v)) {
      this.errores[campo] = 'Debe incluir al menos una letra y un número';
    }
    return v;
  }

  enteroRequerido(campo: string, opciones: { min?: number; max?: number } = {}): number {
    const { min = 1, max = Number.MAX_SAFE_INTEGER } = opciones;
    if (this.falta(campo)) {
      this.errores[campo] = 'Es obligatorio';
      return 0;
    }
    const n = Number(this.datos[campo]);
    if (!Number.isInteger(n) || n < min || n > max) {
      this.errores[campo] = `Debe ser un entero entre ${min} y ${max}`;
      return 0;
    }
    return n;
  }

  enteroOpcional(campo: string, opciones: { min?: number; max?: number } = {}): number | null | undefined {
    if (this.datos[campo] === undefined) return undefined;
    if (this.falta(campo)) return null;
    return this.enteroRequerido(campo, opciones);
  }

  enumRequerido<T extends string>(campo: string, valores: readonly T[]): T {
    const v = this.datos[campo];
    if (typeof v !== 'string' || !valores.includes(v as T)) {
      this.errores[campo] = `Debe ser uno de: ${valores.join(', ')}`;
      return valores[0];
    }
    return v as T;
  }

  enumOpcional<T extends string>(campo: string, valores: readonly T[]): T | undefined {
    if (this.falta(campo)) return undefined;
    return this.enumRequerido(campo, valores);
  }

  /** Fecha opcional en formato YYYY-MM-DD. */
  fechaOpcional(campo: string): string | null | undefined {
    if (this.datos[campo] === undefined) return undefined;
    if (this.falta(campo)) return null;
    const v = this.datos[campo];
    if (typeof v !== 'string' || !REGEX_FECHA.test(v) || Number.isNaN(Date.parse(`${v}T00:00:00Z`))) {
      this.errores[campo] = 'Debe tener formato AAAA-MM-DD';
      return undefined;
    }
    // Rechaza fechas inexistentes como 2026-02-31
    const comprobada = new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10);
    if (comprobada !== v) {
      this.errores[campo] = 'La fecha no existe en el calendario';
      return undefined;
    }
    return v;
  }

  /** Lanza 400 con todos los errores acumulados, si los hay. */
  validar(): void {
    if (Object.keys(this.errores).length > 0) {
      throw badRequest('Datos inválidos', this.errores);
    }
  }
}

/** Convierte un parámetro de ruta (/:id) en entero positivo o lanza 400. */
export function parseId(valor: unknown, nombre = 'id'): number {
  const n = Number(valor);
  if (!Number.isInteger(n) || n <= 0) throw badRequest(`El parámetro "${nombre}" debe ser un entero positivo`);
  return n;
}

/** Lee un entero de la query string con valor por defecto y límites. */
export function parseEnteroQuery(valor: unknown, porDefecto: number, min: number, max: number, nombre: string): number {
  if (valor === undefined || valor === '') return porDefecto;
  const n = Number(valor);
  if (!Number.isInteger(n) || n < min || n > max) {
    throw badRequest(`El parámetro "${nombre}" debe ser un entero entre ${min} y ${max}`);
  }
  return n;
}

/** Paginación: ?page=1&limit=20 */
export function parsePaginacion(query: Record<string, unknown>, limitePorDefecto = 20, limiteMaximo = 100) {
  const page = parseEnteroQuery(query.page, 1, 1, 100000, 'page');
  const limit = parseEnteroQuery(query.limit, limitePorDefecto, 1, limiteMaximo, 'limit');
  return { page, limit, offset: (page - 1) * limit };
}
