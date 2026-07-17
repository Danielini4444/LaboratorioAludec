# Sistema de Laboratorio — ALUDEC (alpha 0.2)

Software interno del laboratorio de **ALUDEC Automoción** (cromado de emblemas). Hecho **a la medida de los formatos en papel del laboratorio** — sin plantillas ni módulos configurables: cada formato es su propia pantalla, su propia tabla y su propio PDF.

Módulos:

1. **Registro de espesores y S.T.E.P.** (Químico) — formato FM-15-01-03.
2. **Test de cromado** (Metrología, folios `Ens_####`) — formato FM-15-30.
3. **Ensayos inyección** (Metrología, folios `Iny_####`) — informes de ensayos de piezas inyectadas.
4. **Planes de prueba** (Metrología) — el plan de validación de cromado por cliente, que se precarga a los reportes.
5. **Imprimir por OF** — junta en un solo PDF lo capturado bajo una orden de fabricación.
6. **Administración** — usuarios, catálogo de piezas, normas por cliente, equipos y clientes, todo editable por fila.

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

## 3. Ensayos inyección (Metrología) — alpha 0.2

- El personal de **Metrología** crea el informe y se le asigna el **No. de ensayo** (`Iny_0001`, `Iny_0002`… consecutivo propio del módulo).
- La cabecera lleva cliente, referencia/denominación (autocompletado del mismo catálogo de piezas), **OF/lote opcional y múltiple** (se agregan varias, o ninguna cuando no aplica), solicitante e información previa.
- Los ensayos se capturan como filas: **Id, Ensayo-Descripción, Exigencia, Resultado, Característica, Observaciones y Conformidad (OK/NOK)**.
- **Apartado de fotos** del informe: se suben las que se necesiten y **cada foto lleva su descripción** (editable hasta que el informe se apruebe).
- El **admin de Metrología aprueba** con la **valoración final** (texto) → queda emitido e inmutable. Firma digital con QR y anulación con traza, igual que el resto de documentos.
- El **PDF** sale con datos generales, la tabla de ensayos, la valoración final y las fotos con su descripción al pie (marca de agua BORRADOR/ANULADO cuando aplica). El código de formato controlado queda pendiente de que calidad emita el formato real (constante `FORMATO_CODIGO` en `server/src/pdf/ensayoInyeccionPdf.js`).

## 4. Planes de prueba (Metrología)

- Pantalla **Planes de prueba** (en el menú, solo Metrología/admin): el catálogo de planes de validación de cromado por cliente, que es lo que precargan los reportes.
- **Crear un plan**: se elige cliente, se escribe la norma del plan y se agregan sus pruebas (ensayo, norma/apartado, característica a evaluar). Se pueden agregar o quitar filas.
- Lista de **planes existentes** agrupados por cliente y norma, con su tabla de pruebas y opción de **borrar** (borrar un plan no afecta a los reportes ya creados).
- Los 16 planes iniciales se importaron del Excel de metrología (hoja CROMADO VAL); desde aquí se crean los que falten (p. ej. clientes sin plan).

## 5. Imprimir por OF

- Cualquier usuario busca una **OF** y ve todo lo capturado con ella en los dos módulos.
- Marca qué documentos imprimir — y dentro de cada test de cromado, **qué pruebas** — y sale **un solo PDF**: primero los informes FM-15-30, luego los registros FM-15-01-03 de anexo (como el paquete real Ens_2384).
- Smoke test manual del armado: `node server/scripts/prueba-of.js`.

## 6. Administración

- Pestañas **Usuarios, Piezas, Normas, Equipos y Clientes**. Solo el **admin global** edita; el auditor admin la ve en solo lectura.
- Todo se edita **por fila** (botón *Editar* → Guardar/Cancelar): usuarios (nombre, rol y área; contraseña y activar/desactivar con sus propios botones), piezas (referencia, denominación y cliente), equipos (nombre, ID interno y fecha de calibración — se pueden vaciar), clientes (renombrar) y normas (límites por cliente).
- Nada se borra de los catálogos: usuarios, piezas, equipos y normas se **desactivan** (dejan de aparecer para capturar, pero lo histórico los conserva).

---

## Carga de fotos

Dentro de los formularios (registro de espesores y pruebas de cromado) hay una **zona de carga**: se sueltan o se eligen fotos, **de a una o varias a la vez**, y se van **acumulando** (no se reemplaza la selección). Cada miniatura se puede quitar antes de guardar. Solo JPG/PNG (lo que el PDF puede incrustar); hasta 10 por envío.

## Firma digital y QR de verificación

Los documentos **aprobados** (registro de espesores, reporte de ensayo y ensayo de inyección) se pueden **firmar digitalmente**. Firman **solo admin, admin de Químico y admin de Metrología**:

- La firma guarda **quién y cuándo**, más un **token HMAC-SHA256** del documento con el secreto del servidor (`FIRMA_SECRET` o `SESSION_SECRET` en `server/.env`): no se puede fabricar una firma válida sin el secreto.
- El **PDF firmado** lleva el bloque *FIRMA DIGITAL / DIGITAL SIGNATURE*: firmante, fecha/hora, ID de firma y **código QR**. En el FM-15-01-03, el APPROVED BY deja de ir en blanco y lleva al firmante. La impresión por OF también incluye el QR de cada documento firmado.
- El QR apunta a la **página pública de verificación** (`/api/verificar/…`, sin sesión — se escanea desde cualquier teléfono): con token correcto muestra **FIRMA VÁLIDA** con folio, cliente, referencia y firmante; si el documento se **anuló** después de firmarse, avisa que la firma ya no lo ampara; con token incorrecto muestra **FIRMA NO VÁLIDA** sin revelar ningún dato.
- En producción conviene fijar `APP_URL` en `server/.env` (p. ej. `http://<IP-del-servidor>:3000`) para que los QR impresos siempre apunten a la dirección fija del servidor.

Sin firma digital, los PDF salen como antes: **FM-15-01-03** con el responsable en ISSUED BY y APPROVED BY en blanco para firma a mano; **FM-15-30** con el RESPONSABLE de cada prueba y sin bloque de firmas al final.

---

## Integridad y control de calidad (alpha 0.1x)

Endurecimiento pensado para que los registros aguanten una auditoría IATF:

- **Anulación con traza** (la vía normal): el admin **anula con un motivo obligatorio** y el documento queda **visible y marcado ANULADO** (con quién y cuándo). El PDF sale con marca de agua *ANULADO / VOID*. Lo aprobado y lo anulado es inmutable (no se edita, no admite fotos).
- **Borrado definitivo** (solo admin, con confirmación): elimina el documento **por completo** — pruebas, piezas, mediciones y fotos, también del disco — y aplica **aunque esté aprobado o firmado**. Es para capturas de prueba o duplicados; a diferencia de Anular, **no deja traza**. El QR de un PDF impreso de un documento borrado da FIRMA NO VÁLIDA.
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
| **Químico** (admin de área) | Lo anterior + **aprobar** registros y **firmar** documentos |
| **Metrología** (usuario) | Crear/editar reportes de cromado y sus pruebas; crear/borrar planes; fotos |
| **Metrología** (admin de área) | Lo anterior + **aprobar** reportes y **firmar** documentos |
| **admin** (global) | Todo: **firmar**, **anular** (con motivo), **borrar definitivamente** y editar Administración |
| **auditor / auditor admin** | Solo lectura (el segundo además ve Administración) |
| solicitante | Sin función en esta versión |

## Arrancar

Para desarrollo con recarga automática: `npm run dev` (servidor en :3000, cliente en :5173).

## Despliegue en un servidor nuevo

```
git clone <url-del-repo>
cd lab
npm install                       # dependencias del proyecto raíz
npm --prefix server install
npm --prefix client install

cp server/.env.example server/.env
# editar server/.env: DATABASE_URL, SESSION_SECRET propio y APP_URL (ver abajo)

# la base de datos de DATABASE_URL debe existir antes de migrar (migrate.js
# crea las tablas, no la base): createdb lab   -- o el nombre que hayas puesto

npm run migrate   # crea el esquema
npm run seed      # usuarios y áreas iniciales (SOLO la primera vez, en base vacía)
npm run build     # compila el cliente
npm start         # un solo proceso en http://localhost:3000 (sirve API + interfaz)
```

Requiere PostgreSQL corriendo y accesible con la `DATABASE_URL` que pongas en `server/.env`.

### Migrar datos ya capturados (en vez de `npm run seed`)

Si ya hay trabajo real en una base existente (registros/reportes capturados o firmados, catálogos cargados), se **migra la base completa** en vez de partir de cero — `npm run seed` no aplica en este caso, se saltaría directo a migrar el respaldo:

En la máquina de origen (donde está la base actual):

```
pg_dump -U <usuario> -h localhost -d lab -F c -f lab_respaldo.dump
```

La evidencia fotográfica **no** va en el dump — vive en `server/uploads/`, hay que copiar esa carpeta aparte (o comprimirla) junto con el `.dump`.

En el servidor nuevo, después de crear la base vacía y configurar `server/.env` (pero **antes** de `npm run migrate`/`seed`):

```
pg_restore -U <usuario> -h localhost -d lab --no-owner --no-privileges lab_respaldo.dump
```

`--no-owner --no-privileges` evita fallos si el usuario/rol de Postgres no se llama igual en el servidor nuevo. Después, copiar el contenido de `server/uploads/` de origen dentro de `server/uploads/` del proyecto ya clonado, y seguir con `npm run migrate` (confirma que el esquema está al día; no debería aplicar nada nuevo si el respaldo ya tenía todas las migraciones) → `npm run build` → `npm start`. Conviene verificar después que los conteos (`SELECT count(*) FROM piezas`, `clientes`, `registros_espesores`, `reportes_ensayo`) coincidan con los de origen.

### Para que otros equipos y celulares entren

1. **`APP_URL` en `server/.env`** — la IP fija o nombre del servidor en la intranet (p. ej. `http://192.168.1.50:3000`). Sin esto, el sistema intenta adivinar la IP del servidor, lo que falla si tiene más de una red activa a la vez (ver "Firma digital y QR de verificación" más abajo).
2. **Firewall del servidor** — el puerto (3000, o 443 si se pone detrás de un reverse proxy) debe estar permitido para el perfil de red real de esa máquina. En Windows, `Get-NetConnectionProfile` dice si la red del servidor es `Domain`, `Private` o `Public`; la regla de firewall tiene que cubrir ese perfil (una regla genérica de Node.js suele venir limitada solo a `Domain`, y no sirve si el servidor no está en esa categoría).
3. **Probar desde un dispositivo aparte** del servidor (celular, otra máquina) — un `curl` hecho desde el propio servidor no revela si el firewall está bloqueando tráfico externo.

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

- `server/` — API Express + PostgreSQL. Migraciones en `server/migrations/`, PDFs en `server/src/pdf/` (`registroPdf.js`, `reportePdf.js`), rutas en `server/src/routes/` (la verificación pública de firmas vive en `verificar.js`; la generación de tokens y QR en `src/firma.js`), fotos en `server/uploads/`.
- `client/` — interfaz React (Vite). El servidor sirve `client/dist/` compilado.
- `info reportes/` — formatos de referencia del laboratorio (FM-15-30, FM-15-01-03, sistema Access viejo).
