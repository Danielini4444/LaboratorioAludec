# Estilos e identidad visual del QMS — contrato de diseño

> **Para quién es este documento:** cualquier persona o sesión de Claude que
> construya o evolucione un **sistema** del QMS de ALUDEC. La meta es que los
> ~16–20 sistemas se vean de la **misma familia** — misma paleta, mismos logos,
> mismos tokens y mismas clases de componente — sin reinventar el estilo en cada
> repo.
>
> Hermanos de este doc: **`stack.md`** (con qué se construye) y **`login.md`**
> (autenticación y permisos). Aquí va **cómo se ve**.
>
> **Autoridad:** este documento es la **fuente única** de la identidad visual y
> **reemplaza** la paleta provisional que `stack.md` §6 describía (primario azul
> `#1d4ed8`). Cierra el pendiente de `stack.md` §11 («extraer el `@theme` a un
> preset compartido»). Ante cualquier duda de color, manda `styles.md`.
>
> **Política** (igual que `stack.md`): *default fuerte, flexible*. La paleta, los
> logos y los tokens son **obligatorios e iguales en todos**; desviarse se permite
> **solo si se justifica y se documenta** en el `DECISIONS.md` del sistema.

---

## 1. La marca en una frase

**Naranja como acento + una escala de grises fría, sin azul.** El naranja es el
color de marca del logo y se reserva para acentos; la interfaz se construye en
grises (primario, texto, bordes, fondo). Verde / rojo / ámbar se mantienen solo
como colores **funcionales** (éxito / error / advertencia).

### Dos sustituciones que definen la identidad

La marca anterior usaba azules; la nueva los reemplaza por grises:

- **AZUL MARINO → GRIS OSCURO** `#1D252D` (RGB 29/37/45) — pasa a ser el
  **primario** (botones, enlaces, menú activo) **y** el color de **texto**.
- **AZUL CLARO → GRIS CLARO** `#D0D3D4` (RGB 208/211/212) — pasa a ser el color de
  **bordes**.
- El **naranja `#F18308` NO es el primario**: es acento (logo y detalles puntuales).

---

## 2. Paleta de marca

Escala oficial del logo (naranja + 6 grises). Copiar estos valores exactos.

| # | RGB | HEX | Rol en la interfaz | Token |
|---|---|---|---|---|
| 1 | 241 / 131 / 8 | `#F18308` | Naranja de marca — **acento** | `--color-acento` |
| 2 | 250 / 170 / 80 | `#FAAA50` | Naranja claro — acento suave | `--color-acento-suave` |
| 3 | 29 / 37 / 45 | `#1D252D` | Gris oscuro — **primario** + **texto** | `--color-primario`, `--color-tinta` |
| 4 | 51 / 63 / 72 | `#333F48` | Gris — hover del primario | `--color-primario-hover` |
| 5 | 91 / 103 / 112 | `#5B6770` | Gris medio — **texto secundario** | `--color-suave` |
| 6 | 124 / 135 / 142 | `#7C878E` | Gris medio-claro — texto atenuado, iconos | *(utilidad directa)* |
| 7 | 162 / 170 / 173 | `#A2AAAD` | Gris claro — deshabilitado, líneas suaves | *(utilidad directa)* |
| 8 | 208 / 211 / 212 | `#D0D3D4` | Gris claro — **bordes** | `--color-borde` |

Derivado (no está en la escala pero se usa como superficie): fondo general
`#F4F5F5` (gris muy claro neutro) → `--color-fondo`.

### Colores funcionales (no son de marca, se mantienen)

| Uso | HEX | Token |
|---|---|---|
| Éxito / OK | `#15803D` | `--color-ok` |
| Error / rechazo | `#B91C1C` | `--color-mal` |
| Advertencia / condicional | `#B45309` | `--color-alerta` |

### Radio y superficie

- **Radio base:** `10px` (`--radius-base`) en botones, tarjetas, inputs, imágenes.
- **Superficie:** tarjetas y controles en **blanco** sobre fondo `#F4F5F5`, borde
  `#D0D3D4`, sombra sutil (`shadow-sm`).
- **Tema único claro.** No hay modo oscuro (si un sistema lo necesita, lo
  documenta).

---

## 3. Logos

Dos activos distintos. **No intercambiarlos.**

### 3.1 Logo del sistema — cabecera y login

Va en el `Layout` (cabecera) y en la `LoginPage`. Archivo canónico **`logo.png`**,
servido en `/logo.png` (carpeta `client/public/`).

![Logo del sistema](logo.png)

### 3.2 Logo de pestaña (favicon) — icono del navegador

Va **solo** en `<link rel="icon">` del `index.html`. Es una versión compacta,
pensada para verse a 16–32 px. Archivo **`logo tabs.png`**, servido como
**`/logo-tabs.png`** (copiar a `client/public/logo-tabs.png` sin el espacio en el
nombre para evitar problemas de URL).

![Logo de pestaña](<logo tabs.png>)

```html
<!-- index.html -->
<link rel="icon" type="image/png" href="/logo-tabs.png" />
```

---

## 4. Tokens `@theme` (Tailwind v4)

Tailwind CSS v4, config CSS-first (`@import "tailwindcss";` + `@theme`). Este
bloque es el **preset compartido**: cópialo tal cual en `client/src/styles.css` de
cada sistema. Los tokens generan utilidades (`bg-primario`, `text-suave`,
`border-[color:var(--color-borde)]`, `text-acento`, …).

```css
@import "tailwindcss";

/* Tema compartido del ecosistema QMS ALUDEC (styles.md). Naranja como acento +
   escala de grises. Sin azul: AZUL MARINO -> GRIS OSCURO, AZUL CLARO -> GRIS CLARO. */
@theme {
  --color-primario: #1d252d;        /* gris oscuro RGB 29/37/45 */
  --color-primario-hover: #333f48;  /* gris RGB 51/63/72 (hover) */
  --color-acento: #f18308;          /* naranja de marca RGB 241/131/8 */
  --color-acento-suave: #faaa50;    /* naranja claro RGB 250/170/80 */
  --color-ok: #15803d;
  --color-mal: #b91c1c;
  --color-alerta: #b45309;
  --color-tinta: #1d252d;           /* texto (gris oscuro) */
  --color-suave: #5b6770;           /* texto secundario RGB 91/103/112 */
  --color-borde: #d0d3d4;           /* gris claro RGB 208/211/212 */
  --color-fondo: #f4f5f5;           /* gris muy claro neutro */
  --radius-base: 10px;
}

html,
body,
#root {
  height: 100%;
}
body {
  background: var(--color-fondo);
  color: var(--color-tinta);
  font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
}
```

**Tipografía:** pila de sistema (`system-ui, -apple-system, Segoe UI, Roboto,
sans-serif`). Sin fuentes web externas.

---

## 5. Clases de componente (`@layer components`)

Mismos componentes base en todos los sistemas. Van en el mismo `styles.css`,
debajo del `@theme`. (Tailwind v4: las variantes de botón **no** hacen `@apply` de
`.btn`; comparten la base con un selector agrupado.)

```css
@layer components {
  .btn,
  .btn-primary,
  .btn-ghost,
  .btn-ok,
  .btn-mal {
    @apply inline-flex items-center justify-center gap-2 rounded-[10px] px-4 py-2 text-sm font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed;
  }
  .btn-primary { @apply bg-primario text-white hover:bg-primario-hover; }
  .btn-ghost   { @apply border border-[color:var(--color-borde)] bg-white text-tinta hover:bg-slate-50; }
  .btn-ok      { @apply bg-ok text-white hover:brightness-95; }
  .btn-mal     { @apply bg-mal text-white hover:brightness-95; }
  .card  { @apply rounded-[10px] border border-[color:var(--color-borde)] bg-white p-5 shadow-sm; }
  .input { @apply w-full rounded-[10px] border border-[color:var(--color-borde)] bg-white px-3 py-2 text-sm outline-none focus:border-primario focus:ring-2 focus:ring-primario/20; }
  .label { @apply mb-1 block text-sm font-medium text-suave; }
  .th    { @apply px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-suave; }
  .td    { @apply px-3 py-2 text-sm; }
  .badge { @apply inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold; }
}
```

---

## 6. Estados y semáforos

Colores de **estado de documento** (chips/badges). En progreso = naranja de marca;
terminales = verde/rojo; neutros = gris. **Sin azul ni índigo.**

| Estado | Fondo / texto (Tailwind) | Color |
|---|---|---|
| Borrador | `bg-slate-100 text-slate-600` | Gris |
| En captura / en proceso | `bg-orange-100 text-orange-700` | Naranja (acento) |
| Calculado | `bg-slate-200 text-slate-800` | Gris |
| Aprobado (Vº Bº) | `bg-green-100 text-green-700` | Verde |
| Firmado (definitivo) | `bg-green-600 text-white` | Verde fuerte |
| Rechazado | `bg-red-100 text-red-700` | Rojo |
| Anulado | `bg-slate-200 text-slate-500 line-through` | Gris tachado |

**Veredicto / semáforo de resultado** (aceptación de una medición o sistema):

| Veredicto | Color | Token |
|---|---|---|
| Aceptado | Verde | `--color-ok` |
| Condicional | Ámbar | `--color-alerta` |
| Rechazado | Rojo | `--color-mal` |

---

## 7. PDF y otros medios

Los informes PDF (pdfkit) usan **la misma paleta**. Objeto `COLORES` de referencia:

```ts
const COLORES = {
  primario: "#1d252d",     // gris oscuro
  tinta: "#1d252d",
  ok: "#15803d",
  mal: "#b91c1c",
  alerta: "#b45309",
  gris: "#5b6770",         // texto secundario
  linea: "#d0d3d4",        // gris claro (bordes/reglas)
  tablaHeader: "#eceded",  // gris muy claro (cabeceras de tabla)
};
```

Cualquier gráfico, tabla, QR o export sigue naranja + grises; nunca azul.

---

## 8. Cómo aplicarlo a un sistema (o migrar uno existente)

1. **`@theme` + componentes:** copiar los bloques de §4 y §5 en
   `client/src/styles.css`.
2. **Logos:** `logo.png` en `client/public/` (cabecera + login);
   `logo tabs.png` → `client/public/logo-tabs.png` y apuntarlo en el favicon (§3).
3. **Quitar el azul:** sustituir cualquier `#1d4ed8`/`#1e40af` (primario azul),
   `#0f172a` (texto navy), `#e2e8f0`/`#f8fafc` (grises azulados) y las utilidades
   `blue-*` / `indigo-*` / `sky-*` por los tokens/grises de este doc. Los badges
   de estado azul/índigo → naranja/gris (§6).
4. **Verificar** que no queda azul: `grep -rE "#1d4ed8|#0f172a|blue-|indigo-|sky-"`
   sobre `client/src` no debe devolver nada (salvo comentarios de migración).

**No usar:** azul en ningún tono, otras familias tipográficas, sombras/gradientes
llamativos, ni el naranja como color primario de la interfaz (solo acento).

---

## 9. En una frase

**Naranja de marca como acento + escala de grises fría (primario y texto gris
oscuro `#1D252D`, bordes gris claro `#D0D3D4`), verde/rojo/ámbar solo funcionales,
radio 10px, `logo.png` en cabecera y `logo-tabs.png` en la pestaña** — un único
`@theme` de Tailwind v4 y un set de componentes compartido para que los 16–20
sistemas del QMS se vean como uno solo. Sin azul.
