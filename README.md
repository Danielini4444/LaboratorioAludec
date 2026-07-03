# Sistema de Laboratorio — ALUDEC (alpha 0.1)

Software interno del laboratorio de **ALUDEC Automoción** (cromado de emblemas). Hecho **a la medida de los formatos en papel del laboratorio** — sin plantillas ni módulos configurables: cada formato es su propia pantalla, su propia tabla y su propio PDF.

Módulos:

1. **Registro de espesores y S.T.E.P.** (Químico) — formato FM-15-01-03.
2. **Test de cromado** (Metrología, folios `Ens_####`) — formato FM-15-30.
3. **Planes de prueba** (Metrología) — el plan de validación de cromado por cliente, que se precarga a los reportes.
4. **Imprimir por OF** — junta en un solo PDF lo capturado bajo una orden de fabricación.

---

## 1. Registro de espesores (Químico)

- El personal de **Químico** captura un registro conforme salen las piezas: cliente (su norma y límites se aplican solos), referencia/denominación (autocompletado del catálogo), OF, barra y fechas; y por cada pieza (HCD/LCD con posición de rack): puntos de medición **Cr / Ni total / Cu**, sección **STEP** (Ni SB, Ni Br, Ni MPS, dif. de potencial MP–Br y Br–SB) y **conteo de poros**.
- Los valores fuera de la especificación del cliente se marcan en rojo al capturar y el sistema sugiere el **PASS/FAIL**.
- **Editar**: mientras el registro **no esté aprobado**, Químico puede editarlo (botón *Editar* en el detalle) — cambia datos y mediciones, agrega o quita piezas. Las piezas se actualizan en su lugar, así que **no se pierden las fotos**.
- El **admin de Químico aprueba** cada registro; una vez aprobado queda inmutable (ya no se edita).
- **Fotos** JPG/PNG por sección: muestra (con puntos de medición), STEP (gráficas) y poros (microscopio). Se cargan desde el detalle, y al crear el registro también desde el formulario (ver *Carga de fotos*).
- El **PDF** sale en formato FM-15-01-03: página *THICKNESS TEST REPORT* + página *S.T.E.P. TEST REPORT*, con las especificaciones del cliente en los encabezados, fotos, conteos de poros y resultado.
- La lista de registros es el equivalente del Excel "Registro de espesores": filtrable por cliente, buscable por referencia/OF/barra.

## 2. Test de cromado (Metrología)

- El personal de **Metrología** crea el reporte y se le asigna un **folio único** (`Ens_2630`, `Ens_2631`… continúa el consecutivo del sistema viejo; se ajusta con `SELECT setval('ens_folio_seq', N);`).
- La cabecera lleva la identificación de la pieza (cliente, referencia/denominación con autocompletado, descripción del material, OF), área solicitante, proyecto, fecha de recepción y cantidad de piezas.
- **Precarga del plan de cromado**: si el cliente tiene un plan de validación, un clic carga sus pruebas con norma y criterios ya llenos (Stellantis tiene dos planes, PS.50014 y PS.50065 → un botón por plan). El analista las va **completando** conforme se terminan. Si el cliente **no tiene plan**, aparece un aviso con un enlace para **crear uno** (módulo de Planes de prueba).
- Las pruebas también se agregan/editan a mano: ensayo, norma + apartado, criterios de aceptación, **equipo con ID interno y calibración**, condiciones, fechas, resultado, tipo de falla y fotos.
- El **admin de Metrología aprueba** con la conclusión CUMPLE / NO CUMPLE → queda emitido y ya no se modifica.
- El **PDF FM-15-30 bilingüe** sale con las 8 secciones del procedimiento: datos generales, identificación de pieza, pruebas con su detalle y evidencia, y conclusión. Marca de agua BORRADOR si aún no está aprobado.

## 3. Planes de prueba (Metrología)

- Pantalla **Planes de prueba** (en el menú, solo Metrología/admin): el catálogo de planes de validación de cromado por cliente, que es lo que precargan los reportes.
- **Crear un plan**: se elige cliente, se escribe la norma del plan y se agregan sus pruebas (ensayo, norma/apartado, característica a evaluar). Se pueden agregar o quitar filas.
- Lista de **planes existentes** agrupados por cliente y norma, con su tabla de pruebas y opción de **borrar** (borrar un plan no afecta a los reportes ya creados).
- Los 16 planes iniciales se importaron del Excel de metrología (hoja CROMADO VAL); desde aquí se crean los que falten (p. ej. clientes sin plan).

## 4. Imprimir por OF

- Cualquier usuario busca una **OF** y ve todo lo capturado con ella en los dos módulos.
- Marca qué documentos imprimir — y dentro de cada test de cromado, **qué pruebas** — y sale **un solo PDF**: primero los informes FM-15-30, luego los registros FM-15-01-03 de anexo (como el paquete real Ens_2384).
- Smoke test manual del armado: `node server/scripts/prueba-of.js`.

---

## Carga de fotos

Dentro de los formularios (registro de espesores y pruebas de cromado) hay una **zona de carga**: se sueltan o se eligen fotos, **de a una o varias a la vez**, y se van **acumulando** (no se reemplaza la selección). Cada miniatura se puede quitar antes de guardar. Solo JPG/PNG (lo que el PDF puede incrustar); hasta 10 por envío.

## Firmas en los PDF

Ningún PDF sale **firmado por sí solo**:

- **FM-15-01-03** (thickness): muestra el **responsable** (ISSUED BY); APPROVED BY queda en blanco para firma a mano.
- **FM-15-30** (cromado): se conserva el **RESPONSABLE** de cada prueba (quién la ejecutó, con su equipo y tiempos) y la conclusión; **no** lleva bloque de firmas al final.

---

## Integridad y control de calidad (alpha 0.1x)

Endurecimiento pensado para que los registros aguanten una auditoría IATF:

- **Anulación con traza en vez de borrado.** Los registros y reportes **no se borran**: el admin los **anula con un motivo obligatorio**, y quedan **visibles y marcados ANULADO** (con quién y cuándo). El PDF sale con marca de agua *ANULADO / VOID*. Lo aprobado y lo anulado es inmutable (no se edita, no admite fotos).
- **Sello de aprobación completo.** Tanto reportes como registros guardan **quién aprobó y cuándo** (`aprobado_por` / `aprobado_en`).
- **Cambio de contraseña obligatorio** en el primer ingreso: los usuarios nacen con la contraseña por defecto conocida y el sistema **bloquea todo** hasta que la cambian.
- **Hash SHA-256 de la evidencia.** Cada foto guarda el hash de su archivo al subirse. El script `node server/scripts/verificar-evidencia.js` revisa que cada imagen exista en disco y no haya cambiado, y reporta faltantes o alteradas (rellena el hash de las imágenes antiguas).
- **Revisión del formato visible** en los PDF (FM-15-01-03 *REV. A*, FM-15-30 *Rev. A*) — para dejar claro que el formato es un documento controlado. Si metrología emite una revisión nueva, es un cambio de versión del software (constante `FORMATO_REV` en cada PDF), no configuración.

### Notas de comportamiento y operación

- **Folio `Ens_####`** usa una secuencia de Postgres: es seguro ante concurrencia, pero **puede dejar huecos** si una creación se aborta (p. ej. `Ens_2630 → Ens_2632`). Es ID de sistema, no un consecutivo garantizado sin saltos. El `reporte_no` del registro de espesores sí es `max+1` por cliente (sin huecos).
- **Respaldo:** la evidencia vive en `server/uploads/` (sistema de archivos) y los datos en PostgreSQL. **El backup debe cubrir AMBOS**; con solo la base, los registros quedarían sin sus fotos. El hash permite detectar después si un archivo se perdió o cambió.
- **Transporte:** en intranet el sistema corre en HTTP. Para registros de calidad conviene poner un certificado (aunque sea self-signed) y servir por HTTPS; es configuración de despliegue, no del código.

## Roles y permisos

| Área / rol | Puede |
|---|---|
| **Químico** (usuario) | Capturar y editar registros de espesores; subir/quitar fotos |
| **Químico** (admin de área) | Lo anterior + **aprobar** registros |
| **Metrología** (usuario) | Crear/editar reportes de cromado y sus pruebas; crear/borrar planes; fotos |
| **Metrología** (admin de área) | Lo anterior + **aprobar** reportes |
| **admin** (global) | Todo, incluido **anular** (con motivo) registros y reportes |
| **auditor / auditor admin** | Solo lectura (el segundo además ve Administración) |
| solicitante | Sin función en esta versión |

## Arrancar

```
npm run migrate   # aplica migraciones pendientes (solo tras cambios de esquema)
npm run seed      # datos iniciales (solo la primera vez; no hace nada si ya hay datos)
npm run build     # compila el cliente
npm start         # un solo proceso en http://localhost:3000 (sirve API + interfaz)
```

Para desarrollo con recarga automática: `npm run dev` (servidor en :3000, cliente en :5173).

Requiere PostgreSQL corriendo; la conexión se configura en `server/.env` (`DATABASE_URL`). Para la intranet, los demás equipos entran con `http://<IP-de-esta-máquina>:3000` (hay que permitir el puerto 3000 en el Firewall de Windows).

## Usuarios iniciales

Todos nacen con la contraseña `cambiar123` y el sistema **exige cambiarla en el primer ingreso**:

| Usuario | Rol |
|---|---|
| `admin` | Administrador (todo, incluye borrar) |
| `adminquimico` | Aprueba y captura registros |
| `usuarioquimico` | Captura registros de espesores |
| `adminmetrologia` | Aprueba reportes de cromado |
| `usuariometrologia` | Crea reportes y planes de cromado |
| `auditor` / `auditoradmin` | Solo lectura (el segundo ve Administración) |
| `solicitante` | Sin función en esta versión |

## Datos del dominio (se conservan entre versiones)

- **572 piezas** (referencia/denominación/cliente) de "referencias y denominaciones.xlsx".
- **Especificaciones por cliente y norma** (límites de Cr, Ni, Cu, STEP y poros) del Excel "Registro de espesores".
- **Clientes** reales (BMW, FORD, STELLANTIS, VW, TESLA…), **20 equipos** del Access viejo y **16 planes de cromado** del Excel de metrología.

```
node server/scripts/importar-piezas.js "referencias y denominaciones.xlsx"
node server/scripts/importar-especificaciones.js "Registro de espesores.xlsx"
node server/scripts/importar-planes.js "Información metrologia.xlsx"   # hoja CROMADO VAL
```

Los importadores son idempotentes. Para corregir un límite puntual, también se puede editar `especificaciones.limites` (JSON) directo en la base.

## Estructura

- `server/` — API Express + PostgreSQL. Migraciones en `server/migrations/`, PDFs en `server/src/pdf/` (`registroPdf.js`, `reportePdf.js`), rutas en `server/src/routes/`, fotos en `server/uploads/`.
- `client/` — interfaz React (Vite). El servidor sirve `client/dist/` compilado.
- `info reportes/` — formatos de referencia del laboratorio (FM-15-30, FM-15-01-03, sistema Access viejo).
