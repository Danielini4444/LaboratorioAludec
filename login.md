# Arquitectura de autenticación y permisos del QMS — contrato de diseño

> **Para quién es este documento:** cualquier persona o sesión de Claude que
> construya o evolucione el **sistema de laboratorio** (o cualquier otro sistema
> del QMS). Léelo antes de tocar auth. La meta es que cada sistema se construya
> **desde hoy** listo para enchufarse a un login central, sin reescribir su
> lógica de permisos cuando ese día llegue.

---

## 0. Vocabulario (leer primero — es donde se confunde todo)

Tres niveles, de mayor a menor:

| Nivel | Qué es | ¿Tiene middleware + RBAC propios? | Ejemplos |
|---|---|---|---|
| **QMS** | El sistema grande que agrupa todo | — | el conjunto completo |
| **Sistema** | Una aplicación con su propia BD, su **middleware** y su **RBAC**. Habrá ~16–20. | **Sí, cada uno el suyo** | **lab** (este), y otros que vayan saliendo |
| **Módulo** | Una pantalla/función **dentro** de un sistema, bajo las reglas de ese sistema | No, usa el RBAC del sistema | dentro de lab: registro de espesores, test de cromado, planes, imprimir por OF, **inyección, ensamble, esmaltado, pegado, pintura…** |

**Punto clave:** los procesos como **inyección, ensamble, esmaltado, pegado,
pintura** son **MÓDULOS del sistema lab**, no sistemas aparte. Van bajo el **mismo
middleware y el mismo RBAC de lab**. No tienen su propio middleware ni aparecen
por separado en el token.

La unidad que tiene middleware + RBAC + entra al panel de permisos central es el
**SISTEMA**. Este repo (`lab`) **es un sistema**, y va creciendo agregando módulos.

---

## 1. El objetivo final

El QMS tendrá ~16–20 **sistemas** y unos **5 administradores generales** que,
desde un panel central, asignan acceso así:

> "Tú **sí** entras a **este sistema** con **este rol**."

O sea: el panel administra la relación **Usuario × Sistema × Rol**. Lo que ese
rol puede hacer **dentro** del sistema (a qué módulos, qué acciones) lo **deriva**
el **RBAC interno del sistema** (ver §6), no el panel central.

| Concepto | Qué responde | Dónde vive en el QMS |
|---|---|---|
| **Autenticación (authN)** | *¿Quién eres?* | **Central** (un IdP / login padre) |
| **Autorización (authZ)** | *¿Qué puedes hacer en este sistema?* | **Local**, en cada sistema |

**Regla de oro:** la autenticación se centraliza; la autorización se queda en
cada sistema.

---

## 2. Principio que hace esto barato

En cada sistema, **toda la protección debe leer la identidad de un solo lugar**.
En lab ese lugar es `req.session.user`, y los middlewares `requireAuth` /
`requireRol` / `requireArea` (en `server/src/auth.js`) solo consultan ese objeto.

Si mañana ese objeto se llena **desde los claims de un JWT verificado** en vez de
una sesión local, **nada más cambia**. Se cambia la puerta, no la casa.

➡️ **Mandato:** nunca leas identidad/rol de otro lado que no sea `req.session.user`.
Nunca confíes en un rol que venga del cliente.

---

## 3. Los dos modos: `AUTH_MODE` (por sistema)

- **`AUTH_MODE=standalone`** (lo de hoy): login local usuario+contraseña, sesión
  con cookie, contraseñas en `usuarios`, force-change al primer ingreso.
- **`AUTH_MODE=sso`** (el futuro): el sistema **no tiene login propio**. Un
  middleware verifica el JWT del IdP central y arma `req.session.user`. Se
  **desactivan** login local, contraseñas, `debe_cambiar_password` y su gate.

Migración **incremental**: hoy todos en `standalone`; cuando el IdP exista, se
flipea sistema por sistema. No hace falta tener todos listos para empezar.

---

## 4. El contrato del token (estandarizar HOY)

- **Firma:** RS256. El IdP publica su llave pública vía **JWKS**. Los sistemas
  **solo verifican**; nunca hay secreto compartido (nada de HS256 entre servicios).

### 4.1 Recomendado: un token POR sistema (por audiencia), no un token "dios"

Cada sistema es un *client*/audience en el IdP. El shell pide un token **dirigido
al sistema destino**: `aud = SYSTEM_ID` y **solo el rol de ese sistema**. Es lo
natural en Keycloak (tokens por cliente) y da: token chico, **acotado a un
destino** (mínimo privilegio) y que **no crece** cuando el QMS suma sistemas.

```jsonc
{
  "iss": "https://qms.aludec/idp",
  "aud": "lab",                      // el SYSTEM_ID destino; cada sistema valida que sea el suyo
  "sub": "u_00123",                  // ID ESTABLE y único (nunca se reutiliza)
  "name": "Juan Pérez",
  "email": "juan.perez@aludec...",
  "iat": 1234567890,
  "exp": 1234568790,                 // access token corto (5–15 min)
  "role": "metrologia_admin"         // SOLO el rol de ESTE sistema
}
```

Cada sistema valida `iss`, `exp` **y `aud === SYSTEM_ID`**, y lee `role`. Sin
`aud` propio o sin `role` → **403**.

### 4.2 Alternativa consciente: token broker (uno para todo)

Un solo token con `roles: { "lab": "metrologia_admin", "otro": "viewer" }` y
`aud: "qms"`. Más simple para el shell, pero **dos costos**: **crece** con cada
sistema al que el usuario tenga acceso, y **no está acotado a un destino** (todos
los sistemas lo aceptan estructuralmente y solo niegan por su rebanada del mapa).
El daño está contenido (sin entrada para X → 403 en X), pero es superficie que
regalas. **Default recomendado: 4.1.** Elegir 4.2 solo a conciencia.

> El **panel de los 5 admins** administra las asignaciones `usuario × sistema ×
> rol` en el IdP; el IdP las usa para acuñar el token correcto por audiencia bajo
> demanda.

---

## 5. Identidad local y resolución (SIN write en el hot path)

**Problema:** en lab (y en cualquier sistema con trazabilidad de calidad) muchas
tablas tienen **FK a `usuarios(id)`**: `realizado_por`, `aprobado_por`,
`anulado_por`, `subida_por`. Eso es el audit trail IATF y no se puede tirar. El
`sub` del token **no es** un `usuarios.id` local.

**Solución — espejo con `external_id`, resuelto con caché y escritura solo si cambia:**

1. La **autorización** sale de los claims del **token verificado** — no necesita
   BD. La tabla `usuarios` local solo sirve para resolver el **`usuarios.id`** que
   usan los FK al **escribir** (atribuir quién hizo qué).
2. `usuarios` lleva una columna **`external_id`** (= el `sub` del IdP), única. Es
   un **espejo**, no la verdad.
3. En el request, el middleware resuelve `sub → usuarios.id` desde una **caché en
   proceso** (`sub → { id, nombre, rol }`, TTL corto, p. ej. unos minutos). En modo
   `sso` el `rol` del espejo es **denormalizado/informativo** (reportes, UI): la
   authZ **siempre** sale del token (punto 1), nunca de esta tabla. Lo único que el
   espejo aporta de verdad downstream es el **`usuarios.id`** para los FK.
4. **Miss de caché:** un `SELECT … WHERE external_id = sub`.
   - No existe → **INSERT** (única vez, primer encuentro) y se cachea.
   - Existe pero el token trae `name`/rol **distintos** → **UPDATE** y se cachea.
   - Existe e igual → **no se escribe**.
5. **Nunca un write por request** para usuarios sin cambios. El caso común
   (usuario ya visto, sin cambios) es **cero BD o un SELECT cacheado**.

> ⚠️ **No hagas UPSERT por request.** El JIT corre una vez (primer encuentro o
> miss de caché); las escrituras ocurren solo en alta o cuando el IdP cambió el
> nombre/rol. Un write por hit es un cuello de botella inútil y desgaste para nada.

Un usuario que el IdP deshabilite **nunca se borra** del espejo: se marca
inactivo. Sus filas históricas siguen siendo **válidas y atribuibles** — justo lo
que pide la auditoría.

```
JWT.sub ─► caché ─(miss)─► SELECT external_id ─(alta/cambio)─► INSERT/UPDATE ─► usuarios.id ─► FK
```

---

## 6. Rol del token → permisos finos (DERIVADO del rol, no estado local)

El token trae **un rol** para este sistema. El significado fino — **a qué módulos
y acciones** llega — se **DERIVA del rol** mediante un mapa de capacidades en lab
(un solo archivo). Mapeo del sistema lab, que internamente maneja `rol` +
`area_nombre`:

| Rol del token (para `lab`) | Rol local (`usuarios.rol`) | `area_nombre` |
|---|---|---|
| `admin` | `admin` | — |
| `quimico_admin` | `admin_area` | Químico |
| `quimico_user` | `usuario_area` | Químico |
| `metrologia_admin` | `admin_area` | Metrología |
| `metrologia_user` | `usuario_area` | Metrología |
| `auditor` | `auditor` | — |

### 6.1 Decisión: acceso a módulos derivado del rol (resuelve el hueco del JIT)

**El acceso a módulos se DERIVA del rol; lab NO guarda asignaciones
por-usuario-por-módulo.** Un usuario con rol `metrologia_admin` ve/usa exactamente
lo que ese rol implica **desde su primer ingreso (JIT)**, sin que nadie dentro de
lab tenga que asignarle módulos. Así **no hay estado local de permisos que pueda
faltar** — se elimina la contradicción "usuario nuevo sin asignaciones".

- **¿"Este sí inyección, no ensamble"?** Se modela como **roles distintos en el
  panel central** (p. ej. `inyeccion_user`, `ensamble_user`), o con el grano de
  área que lab ya tiene — **no** como toggles locales por usuario. El catálogo de
  roles lo administra el central.

  > **Trade aceptado:** el grano por-módulo se codifica como **roles en el catálogo
  > central**; eso hace que el catálogo de lab **crezca con sus procesos** y que el
  > central **conozca la granularidad de módulos de lab**. Matiz al "el módulo nunca
  > está en el token" de §0/§4: el módulo no es una *clave* del token, pero va
  > **codificado dentro del string del rol** (`inyeccion_user` es, de hecho, un
  > módulo). Se prefiere esto sobre mantener **toggles locales por usuario** (que
  > reintroducirían el hueco del JIT). Si la proliferación de roles se vuelve molesta
  > (~6 procesos × admin/user ⇒ 12+ roles, y cada módulo nuevo = roles nuevos en el
  > central), reconsiderar **grano por área** en vez de por módulo.

- **Default sin rol para lab** = **deny (403)**.
- **Bootstrap resuelto:** el primer admin de lab se otorga `admin` desde el panel
  central; no se necesita un admin sembrado localmente en modo `sso`.

Si algún día se quisiera grano fino administrado **dentro** de lab (no
recomendado para empezar), recién ahí habría que definir: default-deny + pantalla
local de asignaciones + quién las hace. Mientras sea **role-derived**, te ahorras
esa máquina y el hueco no existe.

---

## 7. Piezas de infraestructura del QMS (contexto)

- **IdP central (login padre).** Dueño único de usuarios, contraseñas, MFA,
  políticas y el panel `usuario × sistema × rol`. Emite los JWT. **Recomendación
  fuerte: NO escribirlo desde cero** — usar un IdP open-source on-prem que encaja
  con la intranet y con calidad: **Keycloak**, **Zitadel** o **Authentik**.
- **Gateway / proxy** delante de los sistemas: un solo dominio, ruteo por path
  (`/lab`, …), termina TLS, rechaza lo que no traiga token y comparte la sesión
  entre sistemas bajo el mismo dominio.
- **Shell / portal**: la UI con el login y el lanzador de sistemas; sostiene el
  token y pide el token por audiencia para el sistema que abres. El refresh lo
  maneja el shell/IdP.

### 7.1 Revocación (decisión explícita — la van a preguntar en auditoría)

Con JWT **stateless** y `exp` corto **no hay revocación inmediata**: un token
sigue válido hasta expirar. Para un despido en caliente hay una ventana = la vida
del token.

- **Default documentado:** stateless + `exp` corto (≤15 min) + **revocar el
  refresh en el IdP** al deshabilitar al usuario (el access muere en ≤ exp).
  Simple y suele bastar.
- **Si calidad exige corte inmediato:** añadir **lista de revocación / introspección
  en el gateway** (mata el token al instante, a costa de una verificación por
  request) y/o back-channel logout del IdP.

Se **documenta como decisión**, no se deja implícito.

---

## 8. Checklist para CADA sistema (que nazca compatible)

Aunque hoy se entregue en `standalone`, todo sistema del QMS debe cumplir:

- [ ] Tabla `usuarios` local con columna **`external_id` única** (nullable para los
      usuarios seed de standalone).
- [ ] **Todos** los FK de "quién hizo qué" apuntan a `usuarios(id)`.
- [ ] La autorización lee **solo** de `req.session.user` (jamás del cliente).
- [ ] Un **`SYSTEM_ID` fijo** y un **único archivo de mapeo** rol_token → rol_local.
- [ ] El arranque respeta `AUTH_MODE` (`standalone` | `sso`). En `sso`: middleware
      que verifica JWT por **JWKS** (valida `iss`/`aud`/`exp`, con `aud === SYSTEM_ID`),
      resuelve `sub → usuarios.id` con **caché** y **escribe solo en alta/cambio** (§5).
- [ ] En `sso` se desactivan login local, contraseñas y force-change.
- [ ] Sin rol para el sistema en el token → **403**.
- [ ] El acceso por módulo se **deriva del rol** (§6.1), sin asignaciones locales por usuario.
- [ ] Frontend: en `sso` no muestra login; obtiene el token del shell y lo manda
      como `Authorization: Bearer` (o usa la cookie del dominio).

---

## 9. Estado de ESTE sistema (lab) frente al contrato

`lab` es **un sistema** del QMS (`SYSTEM_ID = "lab"`). Sus **módulos**:

- **Hoy:** registro de espesores (Químico), test de cromado (Metrología), planes
  de prueba, imprimir por OF.
- **Futuros (mismos sistema y RBAC):** inyección, ensamble, esmaltado, pegado,
  pintura y demás procesos — cada uno será **otro módulo de lab**, bajo el mismo
  middleware y el RBAC de §6.

**Ya cumple el contrato:**
- Autorización centralizada en `req.session.user` vía `server/src/auth.js`.
- FKs de trazabilidad a `usuarios(id)`: `realizado_por`, `aprobado_por`,
  `anulado_por`, `subida_por`.
- Modelo de roles local claro (mapeable según §6).
- Inmutabilidad post-aprobación + anulación con traza + hash SHA-256 de evidencia.

**Faltaría para `AUTH_MODE=sso` (no hacer hasta que exista el IdP):**
- `ALTER TABLE usuarios ADD COLUMN external_id text UNIQUE;`
- Middleware `verificarJWT` (lib `jsonwebtoken` + cliente JWKS) que, en `sso`,
  reemplace a `express-session`: verifica (incl. `aud`), resuelve identidad con
  caché y escribe solo en alta/cambio (§5).
- Archivo de mapeo `rolToken → { rol, area_nombre }` (tabla §6) y `SYSTEM_ID='lab'`.
- Cliente: saltar `Login.jsx` en modo sso y adjuntar el Bearer en `api.js`.
- CORS si el front lo sirve el shell desde otro origen.

> Hoy lab corre **standalone** y así se queda hasta que el IdP esté listo. El login
> local actual convive con el futuro `sso` sin bifurcar el código.

---

## 10. Decisiones abiertas (al arrancar el QMS)

- ¿IdP elegido? (Keycloak / Zitadel / Authentik / a medida). Recomendado: open-source on-prem.
- Vida del access token y del refresh (default propuesto: access ≤15 min).
- ¿Revocación inmediata (lista en el gateway) o basta con stateless + exp corto? (§7.1)
- ¿Cada sistema va embebido (iframe / micro-frontend) o enlazado desde el shell?
- TLS/HTTPS en la intranet (necesario para registros de calidad; es despliegue).

Ya **decididas** en este doc: token **por audiencia** (§4.1), acceso a módulos
**derivado del rol** (§6.1), identidad con **caché + escritura solo si cambia** (§5),
y revocación **stateless + exp corto + revocar refresh** como default (§7.1).

---

## 11. En una frase

**Login padre central (IdP) + un middleware/RBAC por sistema + espejo de usuario
por `sub` (resuelto con caché, escritura solo si cambia).** El panel de los 5
admins administra `usuario × sistema × rol`; cada **sistema** (como lab) **deriva**
de ese rol los permisos sobre **sus módulos** y deja traza con su `usuarios`
local. Token **por audiencia**, revocación **documentada**. Construye cada sistema
cumpliendo la §8 y el día del cambio será flipear un `AUTH_MODE`, no reescribir.
