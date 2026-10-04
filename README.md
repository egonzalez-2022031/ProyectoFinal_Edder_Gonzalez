# PassionBook (Reto Lector) — Proyecto Final Taller II

**Estudiante:** Edder González · **Carné:** 2022031 · **Sección:** IN5BM

Plataforma web para fomentar el hábito de la lectura: registro de libros, metas, recomendaciones,
ranking con puntos e insignias y estadísticas.

```
ProyectoFinal_Edder_Gonzalez/
├── backend/    API REST (Node.js + Express + TypeScript + MySQL + JWT)  → ver backend/README.md
└── Frontend/   Angular (generado con ng new) + Bootstrap
```

## Inicio rápido
```bash
# 1) Base de datos: ejecutar en MySQL Workbench
#    backend/database/01_schema.sql  y luego  backend/database/02_seed.sql

# 2) Backend
cd backend
npm install
cp .env.example .env     # editar DB_PASSWORD y JWT_SECRET
npm run dev              # http://localhost:3000/api

# 3) Frontend (en otra terminal)
cd Frontend
npm install
npm start                # http://localhost:4200
```

## Estructura del Frontend (`Frontend/src/app/`)
```
core/
  services/      auth, libros, metas, recomendaciones, ranking, estadisticas
  guards/        auth-guard.ts          (protege rutas privadas)
  interceptors/  auth-interceptor.ts    (agrega el token JWT a cada petición)
features/
  auth/          login, register, perfil
  dashboard/     dashboard
  catalogo/      catalogo, libro-form, mis-libros, recomendaciones
  metas/         metas
  ranking/       ranking, insignias
shared/
  navbar/
src/environments/  environment.ts y environment.development.ts (apiUrl del backend)
```
Cada servicio de `core/services` corresponde a un módulo del backend (`/api/auth`, `/api/libros`, ...).
Bootstrap y Bootstrap Icons ya están configurados en `angular.json`.
