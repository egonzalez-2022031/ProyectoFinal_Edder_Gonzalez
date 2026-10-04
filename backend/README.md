# PassionBook (Reto Lector) — Backend

API REST en **Node.js + Express + TypeScript** con **MySQL** (SQL puro con `mysql2/promise`, sin ORM)
y autenticación **JWT** + contraseñas con **bcrypt**.

## Requisitos
- Node.js 18 o superior
- MySQL 8.0.16 o superior (se usan `CHECK`, CTE y `RANK() OVER`)

## Puesta en marcha
```bash
cd backend
npm install
cp .env.example .env        # en Windows: copy .env.example .env  (luego edita DB_PASSWORD y JWT_SECRET)
```
1. Abre MySQL Workbench y ejecuta, en este orden: `database/01_schema.sql` y `database/02_seed.sql`.
2. Inicia el servidor:
```bash
npm run dev                  # desarrollo con recarga automática
npm run build && npm start   # producción
```
La API queda en `http://localhost:3000/api` (prueba `GET /api/health`).

## Usuarios de prueba
| Correo | Contraseña |
|---|---|
| admin@passionbook.com | Admin123! |
| carlos@passionbook.com | Lector123! |
| maria@passionbook.com | Maria123! |

## Formato de respuestas
- Éxito: `{ "ok": true, "mensaje"?: string, "data": ... }`
- Error: `{ "ok": false, "mensaje": string, "detalles"?: ... }`

Las rutas privadas requieren la cabecera `Authorization: Bearer <token>` (token obtenido en login/registro).

## Endpoints

### Autenticación — `/api/auth`
| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| POST | `/register` | Público | Registro. Body: `nombre, apellido, email, password` |
| POST | `/login` | Público | Login. Body: `email, password` → `{ token, usuario }` |
| GET | `/me` | Privado | Perfil con puntos, libros completados e insignias |
| PUT | `/me` | Privado | Edita `nombre, apellido, biografia, avatar_url` y/o cambia contraseña (`password_actual` + `password_nueva`) |

### Libros — `/api/libros`
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/categorias` | Lista de géneros |
| GET | `/?categoria=&genero=&q=&estado=&page=&limit=` | Catálogo con filtros y paginación (incluye mi estado) |
| GET | `/mis-libros?estado=` | Mi lista de lectura |
| GET | `/:id` | Detalle del libro |
| POST | `/` | Registrar libro. Opcional: `estado` para agregarlo a mi lista |
| PUT | `/:id` | Editar (solo quien lo registró; campos parciales) |
| DELETE | `/:id` | Eliminar (solo su creador y si nadie más lo tiene en su lista) |
| PATCH | `/:id/estado` | Cambiar estado: `pendiente`, `en_lectura`, `completado` (+ `calificacion`, `fecha_inicio`, `fecha_fin`) |

### Metas — `/api/metas`
| Método | Ruta | Descripción |
|---|---|---|
| POST | `/` | Crear meta. Body: `tipo_periodo` (`mensual`/`anual`), `anio`, `mes` (solo mensual), `cantidad_objetivo` |
| GET | `/?anio=&tipo=` | Mis metas con `% de avance` calculado en el momento |
| GET | `/vigentes` | Meta del mes actual y del año actual |
| GET | `/:id` | Una meta con su avance |
| PUT | `/:id` | Cambiar `cantidad_objetivo` |
| DELETE | `/:id` | Eliminar meta |

### Recomendaciones — `/api/recomendaciones`
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/?limit=` | Libros sugeridos (afinidad por género + popularidad) |
| GET | `/catalogo` | Catálogo agrupado por género |
| GET | `/genero/:idCategoria` | Libros de un género |

### Ranking e insignias
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/ranking?limit=` | Tabla de posiciones por puntos + mi posición |
| GET | `/api/insignias` | Catálogo de insignias con progreso y estado (obtenida o no) |
| GET | `/api/insignias/mis-insignias` | Solo las obtenidas |
| POST | `/api/insignias/evaluar` | Revisa y otorga insignias pendientes |

### Estadísticas — `/api/estadisticas`
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/resumen` | Libros leídos, en lectura, pendientes, páginas, puntos, calificación promedio |
| GET | `/lecturas-por-mes?anio=` | Libros completados por mes (12 meses) |
| GET | `/generos?limit=` | Géneros más leídos con porcentaje |
| GET | `/cumplimiento-metas?anio=` | Cumplimiento de metas |
| GET | `/dashboard?anio=` | Todo lo anterior en una sola llamada |

## Reglas de negocio
- Al marcar un libro como **completado** se suman `PUNTOS_POR_LIBRO` puntos (20 por defecto) **una sola vez** por libro.
- Si un libro deja de estar completado, esos puntos se retiran. Las insignias ya ganadas **no** se retiran.
- Las insignias se evalúan automáticamente al completar un libro (libros completados, puntos y metas cumplidas).
- El avance de una meta cuenta los libros completados cuya `fecha_fin` cae dentro del periodo de la meta.
- Las metas anuales se guardan con `mes = 0`.

## Estructura
```
backend/
├── database/            # 01_schema.sql, 02_seed.sql
└── src/
    ├── config/          # env.ts, db.ts (pool mysql2/promise + helpers)
    ├── middlewares/     # auth.middleware.ts (JWT), error.middleware.ts
    ├── controllers/     # auth, libros, metas, recomendaciones, ranking, insignias, estadisticas
    ├── routes/          # un router por módulo + index.ts
    ├── services/        # lecturas (estado y puntos), recompensas (insignias), metas, estadisticas
    ├── utils/           # HttpError, validadores, jwt, helpers SQL
    ├── types/           # tipos de filas MySQL
    ├── app.ts
    └── server.ts
```
