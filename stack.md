# Stack técnico del QMS — contrato de stack

> **Para quién es este documento:** cualquier persona o sesión de Claude que
> construya o evolucione un **sistema** del QMS de ALUDEC. La meta es que los
> ~16–20 sistemas sigan **la misma línea de stack**: mismas tecnologías, misma
> estructura y mismas convenciones, para que quien abra un sistema nuevo lo
> construya igual que `lab` sin reinventar.
>
> Hermanos de este doc: **`login.md`** (autenticación y permisos) y **`README.md`**
> (qué hace este sistema). Aquí va **con qué se construye**.
>
> **Política:** *default fuerte, flexible.* El **core es obligatorio**; las
> desviaciones se permiten **solo si se justifican y se documentan** en el repo
> del sistema que se desvíe.

---

## 1. La línea, de un vistazo

| Capa | Tecnología | Versión (lab) | Nivel |
|---|---|---|---|
| Runtime | Node.js | `v24.x` (en uso 24.16) | **Obligatorio** |
| Lenguaje | JavaScript **o** TypeScript | JS plano | **Obligatorio** elegir uno (ambos oficiales) |
| Backend | Express | `^4.21` | **Obligatorio** |
| Base de datos | PostgreSQL (vía `pg`) | pg `^8.13` | **Obligatorio** |
| Sesión (standalone) | express-session + connect-pg-simple | `^1.18` / `^10.0` | **Obligatorio** (modo standalone) |
| Frontend | React + Vite + react-router-dom | `^18.3` / `^5.4` / `^6.26` | **Obligatorio** |
| Estilos | **Tailwind CSS** (v4, vía `@tailwindcss/vite`) | `^4.3` | **Obligatorio** |
| PDF | pdfkit (+ pdf-lib para unir) | `^0.15` / `^1.17` | Recomendado (si genera PDFs) |
| Subida de archivos | multer | `^2.1` | Recomendado (si recibe archivos) |
| Excel | xlsx | `^0.18` | Recomendado (si importa Excel) |
| Hashing | bcryptjs (claves) + `crypto` nativo | `^2.4` | **Obligatorio** (donde aplique) |
| Lint + formato | ESLint + Prettier | — | **Obligatorio** |
| Pruebas | Vitest | — | **Recomendado** |

> El core obligatorio: **Node + Express + PostgreSQL + React/Vite + Tailwind**.
> Lo demás depende de si el sistema lo necesita.

---

## 2. Runtime y lenguaje

- **Node.js**: línea **v24** (LTS). Hoy lab corre en `v24.16.0`. **Pin recomendado**
  por sistema con `.nvmrc` y `"engines": { "node": ">=24" }` en el `package.json`
  (hoy lab no lo tiene → es de los pendientes, §11).
- **Lenguaje — JS o TS, a elección del sistema (ambos oficiales):**
  - **JavaScript plano** (lo de lab): regla de módulos **CommonJS en el server**
    (`require` / `module.exports`) y **ESM en el client** (`import` / `export`,
    `"type": "module"`). No mezclar dentro de cada lado.
  - **TypeScript**, si el sistema lo elige. **No es barra libre** — para que dos
    sistemas en TS se vean iguales, baseline mínima:
    - `tsconfig` con **`strict: true`**.
    - Mismo split server/client; ESM en el client (Vite ya compila TS sin config),
      server compilado con `tsc` o ejecutado con `tsx`/`node --experimental-strip-types`.
    - Tipar las fronteras: handlers de Express, filas de `pg`, claims del token.
  - **No mezclar** JS y TS dentro del mismo sistema sin una razón documentada.
- `lab` queda como **ejemplo de referencia en JS**.

---

## 3. Backend (Express)

Estructura estándar (la de lab):

```
server/
├── src/
│   ├── index.js        ← entrada: middlewares, monta rutas, middleware de error, sirve client/dist
│   ├── db.js           ← Pool de pg + helper query
│   ├── auth.js         ← middlewares de permisos (requireAuth, requireRol, requireArea…)
│   ├── routes/         ← una ruta por recurso (auth, usuarios, clientes, registros, reportes…)
│   └── pdf/            ← generadores de PDF (uno por formato)
├── migrations/         ← *.sql numeradas
├── scripts/            ← migrate.js, seed.js, importadores
├── uploads/            ← archivos subidos (fuera de git)
└── .env
```

Reglas:
- **Acceso a BD: un solo `Pool` y un helper `query`** (`server/src/db.js`):
  ```js
  module.exports = { pool, query: (text, params) => pool.query(text, params) };
  ```
  Siempre **consultas parametrizadas** (`$1, $2…`), nunca interpolar SQL.
  Operaciones multi-paso → `pool.connect()` + `BEGIN/COMMIT/ROLLBACK`.
- **Sesión (modo standalone):** `express-session` + `connect-pg-simple`
  (`createTableIfMissing: true`), cookie con `maxAge`, secreto desde `.env`.
  En modo `sso` esto se reemplaza por el middleware JWT (ver `login.md`).
- **Subida de archivos:** `multer` con `diskStorage`, nombre `crypto.randomUUID()`,
  `limits` explícitos (lab: 10 MB, 10 archivos) y `fileFilter` por mimetype.
- **PDF:** `pdfkit` para generar; `pdf-lib` para unir/posprocesar.
- **Excel:** `xlsx`, en **scripts de importación** (`server/scripts/importar-*.js`),
  no en el hot path del API.
- **Hashing:** `bcryptjs` para contraseñas; `crypto` nativo para hashes de
  integridad (sha256 de evidencia) y UUIDs.
- **Manejo de errores: un único middleware de error** al final, que respeta
  `err.status`; las rutas hacen `try/catch` y `next(e)`:
  ```js
  app.use((err, req, res, next) => {
    if (err.status) return res.status(err.status).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: 'Error interno del servidor' });
  });
  ```
  Errores de Postgres mapeados donde importe (`23505` → 409, `23503` → 400).
- **Respuestas JSON** siempre con forma `{ error: '…' }` en fallos (el client lo lee así).

---

## 4. Base de datos (PostgreSQL)

- **Migraciones: archivos SQL numerados** en `server/migrations/` (`001_…`, `012_…`),
  aplicadas por `server/scripts/migrate.js`, que lleva control en la tabla
  `_migraciones` y corre **cada archivo en su transacción**. Idempotente: re-correr
  no re-aplica lo ya hecho.
  - Una migración = un cambio de esquema, **append-only** (no editar migraciones ya aplicadas; agregar una nueva).
- **Convención de nombres SQL: `snake_case`** (`registros_espesores`, `cliente_id`, `password_hash`).
- **Trazabilidad:** toda tabla con "quién hizo qué" usa **FK a `usuarios(id)`**
  (`realizado_por`, `aprobado_por`, `anulado_por`, `subida_por`). Esto es clave
  para auditoría IATF **y** para el futuro espejo de identidad del SSO (ver `login.md`).
- **Seed idempotente** (`server/scripts/seed.js`): no hace nada si ya hay datos.
- Conexión por `DATABASE_URL` (`.env`); nunca credenciales hardcodeadas.

---

## 5. Frontend (React + Vite)

- **React 18 + Vite 5 + react-router-dom 6.** ESM. Build con `vite build` → `client/dist`.
- Estructura estándar (la de lab):
  ```
  client/src/
  ├── main.jsx        ← createRoot + BrowserRouter
  ├── App.jsx         ← rutas + Context de auth + Layout
  ├── api.js          ← ÚNICO helper de fetch al API
  ├── styles.css      ← CSS plano con variables
  ├── pages/          ← una por pantalla (listado/detalle/forms)
  └── components/     ← reutilizables (modales, toast, carga de fotos, spinner…)
  ```
- **Fetch: un solo helper `api()`** (`client/src/api.js`) — centraliza `fetch`,
  cabeceras, manejo de `FormData` y de errores (lanza `Error` con `.status` y `.message`).
  No usar `fetch` suelto por las páginas.
- **Estado global: React Context** (p. ej. `useAuth`). **No** Redux/Zustand salvo
  que un sistema lo justifique y lo documente.
- **Dev:** Vite en `:5173` con **proxy `/api → :3000`** (`client/vite.config.js`),
  cookies de sesión por el mismo origen.

---

## 6. Estilos — Tailwind CSS

- **Tailwind CSS v4**, integrado con Vite vía **`@tailwindcss/vite`** (config
  CSS-first: `@import "tailwindcss";` + bloque `@theme` con la paleta). Utility-first.
- **Tema compartido del ecosistema:** la paleta/espaciados/sombras de ALUDEC se
  definen una vez (en `@theme`, como preset común) para que los 16–20 sistemas se
  vean de la **misma familia**. Tokens base (equivalentes a los de lab hoy):
  primario `#1d4ed8`, ok `#15803d`, mal `#b91c1c`, alerta `#b45309`, radio `10px`…
- **Sin CSS suelto** salvo el archivo base de Tailwind (`@import`, `@theme`) y, si
  hace falta, utilidades repetidas extraídas con `@apply`. Nada de hojas `.css`
  por componente ni estilos inline.
- **Sin otro framework** (Bootstrap) ni preprocesador (SCSS/Less): Tailwind cubre todo.

> ✅ **lab ya está en Tailwind.** `client/src/styles.css` es el ejemplo de
> referencia: `@import "tailwindcss"` + `@theme` (el tema compartido) + las clases
> de componentes en `@layer components`. Tómalo como plantilla del tema para los
> demás sistemas.

---

## 7. Despliegue y scripts

- **Producción: un solo proceso Node** sirve el API (`/api/*`) **y** el client
  compilado (`client/dist`, SPA fallback a `index.html`). Sin servidor web aparte.
- **Scripts (raíz)**, iguales en todos los sistemas:
  - `npm run dev` — server (`:3000`, `node --watch`) + client (Vite `:5173`) con `concurrently`.
  - `npm run build` — compila el client.
  - `npm start` — arranca el server (sirve API + dist).
  - `npm run migrate` — aplica migraciones pendientes.
  - `npm run seed` — datos iniciales (idempotente).
- **`.env`** (no en git): `DATABASE_URL`, `PORT`, `SESSION_SECRET`.
- **`.gitignore`** cubre: `node_modules/`, `client/dist/`, `server/.env`, `server/uploads/`.

---

## 8. Calidad de código

- **Obligatorio: ESLint + Prettier**, con **config compartida única** para todo el
  ecosistema (un paquete/preset común), para que los 16–20 sistemas se vean igual.
  En sistemas TS, sumar **`typescript-eslint`**.
- **Recomendado: Vitest** para pruebas (sirve para server y client). No bloqueante,
  pero esperado donde la lógica sea delicada (cálculos, validaciones, PDFs, auth).
- **Convenciones de nombres** (las de lab):

  | Ámbito | Convención | Ejemplo |
  |---|---|---|
  | Archivos JS | camelCase / corto | `registroPdf.js`, `auth.js` |
  | Componentes React | PascalCase | `CargaFotos.jsx` |
  | Variables/funciones JS | camelCase | `requireAuth`, `clienteId` |
  | Constantes JS | SCREAMING_SNAKE_CASE | `UPLOADS`, `EXTENSIONES` |
  | Tablas/columnas SQL | snake_case | `registros_espesores`, `cliente_id` |

- **Idioma: español** en nombres de dominio, comentarios y UI (tecnicismos en
  inglés cuando el formato lo use: `OF`, `S.T.E.P.`).

---

## 9. Compatibilidad con el QMS (no duplica `login.md`)

El stack ya está alineado con el futuro login central. Cada sistema debe nacer así
(detalle en `login.md`):
- Autorización leída **solo** de `req.session.user`.
- Tabla `usuarios` con `external_id` (espejo del `sub` del IdP) cuando se active SSO.
- FKs de trazabilidad a `usuarios(id)` (§4).
- Arranque conmutable por `AUTH_MODE = standalone | sso`.

Mismo stack ⇒ el día del SSO se cambia el middleware de sesión por el de JWT, no se reescribe el sistema.

---

## 10. Obligatorio vs flexible (la política en concreto)

- **Obligatorio e igual en todos:** Node 24, Express, PostgreSQL (`pg` + migraciones
  SQL + `_migraciones`), React/Vite/react-router, **Tailwind** (con el tema compartido),
  helper `api()` único, manejo de error centralizado, ESLint+Prettier, las convenciones de nombres.
- **A elección del sistema (sin imponer):** JavaScript **o** TypeScript (§2).
- **Según necesidad:** pdfkit/pdf-lib, multer, xlsx, Vitest.
- **Desviarse del core** (otra BD, otro framework, otro lenguaje de UI): permitido
  **solo** con justificación escrita en el `README` o un `DECISIONS.md` de ese
  sistema. Ante la duda, seguir la línea.

---

## 11. Pendientes a cerrar (no son parte de este documento)

- Extraer el **`@theme` de lab a un preset compartido** del ecosistema (hoy vive en `lab/client/src/styles.css`).
- Añadir **config compartida de ESLint + Prettier** y aplicarla a lab.
- **`.nvmrc` + `engines`** para fijar Node en cada repo.
- Setup de **Vitest** de referencia.
- **CI** opcional (lint + build + migraciones en seco).

---

## 12. En una frase

**Node 24 + Express + PostgreSQL (migraciones SQL) + React/Vite + Tailwind**, en
**JS o TS** (a elección, con baseline si es TS), con **ESLint+Prettier obligatorios**
y **Vitest recomendado**, un **proceso único** que sirve API + SPA, y todo alineado
con `login.md` para el SSO futuro. Core obligatorio; desviaciones, justificadas y escritas.
