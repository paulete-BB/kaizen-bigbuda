# Kaizen Bigbuda

Plataforma interna de mejora continua del área de Marketing de Bigbuda —
planificador de clientes, motor de scheduling y bitácora. Ver `CLAUDE.md`
para el brief completo del proyecto.

## Stack

- Next.js 16 (App Router) + TypeScript + Tailwind CSS v4
- Postgres directo vía `postgres.js` (`lib/db.ts`) — **no** vía
  `@supabase/supabase-js`: este entorno de desarrollo no tiene un proyecto
  Supabase real conectado, así que la app habla con Postgres por connection
  string (`DATABASE_URL`). Es exactamente lo que un proyecto Supabase real
  expone en producción (Settings → Database → Connection string), así que
  migrar es solo cambiar el valor de esa variable — no hay que tocar código.
- Auth propia por email (bcrypt + cookie de sesión firmada) mientras no hay
  Supabase Auth (GoTrue) conectado — ver `lib/auth/`.

## Estado (Fase 1 del brief)

Implementado y con datos reales (sin mocks):

- **Base de datos**: modelo completo de §4.2 en `supabase/migrations/`.
- **Auth** por email con roles `admin`/`miembro`.
- **Motor de scheduling** (`lib/scheduling/`, funciones puras + 17 tests
  vitest): reglas A (viernes SEO, máx. 2/viernes, estable mes a mes), B
  (bloque de Ads miércoles 16:00, Meta/Google como ítems separados) y D
  (reprogramación por feriado / detección de conflicto de ausencia).
- **6 pantallas** del export de Claude Design + la ficha de cliente ya
  reconectada a datos reales: Dashboard, Calendario (con drag & drop),
  Clientes, ficha de Cliente, BloqueMiercoles, RegistroSEO, Bitácora.

Fuera de alcance de esta ronda (Fase 2-4 del brief): integraciones externas
reales (ClickUp, GSC, GA4, Meta — quedan como puntos preparados en
`lib/clickup/stub.ts`), repositorio de prompts, flujo de aprobaciones
completo, offboarding completo, retrospectiva mensual, generador de
informes/PDF.

## Desarrollo local

Requiere Postgres 16 corriendo (`service postgresql start` si usas el
mismo Postgres local de este entorno) y `DATABASE_URL` apuntando a él.

```bash
cp .env.example .env.local   # completar DATABASE_URL y AUTH_SECRET
                              # (AUTH_SECRET: openssl rand -hex 32)

npm run db:migrate            # crea el esquema (idempotente)
npm run db:seed               # 3 clientes de prueba + calendario jul-sep 2026

npm run dev
```

Abrir [http://localhost:3000](http://localhost:3000) (redirige a `/login`).

**Login de prueba** (creado por `npm run db:seed`):

| Email | Password | Rol |
|---|---|---|
| `marcel@bigbuda.com` | `Bigbuda2026!` | admin |
| `andres@bigbuda.com` | `Bigbuda2026!` | miembro |
| `paulete@bigbuda.com` | `Bigbuda2026!` | miembro |

El seed genera el calendario de **julio a septiembre de 2026** con el motor
de scheduling real — septiembre incluye el feriado del 18 (Independencia
Nacional, cae viernes), que reprograma la optimización SEO de Provetec
Mining al 11 de septiembre respetando el límite de 2 clientes por viernes.

## Pruebas

```bash
npm run test    # motor de scheduling (vitest, sin DB)
npm run lint
npx tsc --noEmit
npm run build
```

## Estructura

```
app/                        App Router
  login/                     Login
  dashboard/                 KPIs, hoy/semana, alertas
  calendario/                Grilla mensual + drag&drop
  clientes/                  Listado + ficha de cliente + bitácora
  optimizaciones/bloque/     Bloque de Ads del miércoles
  optimizaciones/.../registro  Registro de optimización SEO
components/                Un subdirectorio por pantalla + layout/ (Sidebar)
lib/
  scheduling/                Motor de scheduling (puro, con tests)
  data/                      Queries + Server Actions por entidad
  auth/                      Sesión, hashing, Server Actions de login
  clickup/stub.ts            Punto de integración preparado (Fase 2)
  db.ts, dates.ts            Cliente Postgres y utilidades de fecha compartidas
scripts/
  migrate.ts                 Aplica supabase/migrations/*.sql (idempotente)
  seed.ts                    Datos de demo + corre el motor de scheduling
supabase/migrations/        Esquema SQL, listo para un proyecto Supabase real
proxy.ts                    Protección de rutas (redirige a /login sin sesión)
```
