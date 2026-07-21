-- Módulo "Ensayos pintura" (alpha 0.3): informes de ensayos de piezas
-- pintadas, hermano de Ensayos inyección (ensayos_inyeccion). Mismo ciclo de
-- vida (cabecera con folio propio Pin_####, filas de ensayo, apartado de fotos
-- con descripción, valoración final, aprobación, firma digital con QR y
-- anulación con traza). Captura el área de Metrología.
--
-- Además de lo de inyección, pintura suma un apartado de ESPESORES organizado
-- por pieza: cada pieza lleva varios puntos de medición (µm) con su promedio,
-- una imagen y un comentario. Modelado como registro_piezas/registro_mediciones
-- del Test de cromado (006_especifico_espesores.sql).

-- Folio propio del módulo, desde 1 (se muestra como Pin_0001).
CREATE SEQUENCE pin_folio_seq START 1;

CREATE TABLE ensayos_pintura (
  id                 serial PRIMARY KEY,
  folio              integer NOT NULL UNIQUE,
  cliente_id         integer NOT NULL REFERENCES clientes(id),
  referencia         text NOT NULL,
  denominacion       text NOT NULL,
  ofs                text[] NOT NULL DEFAULT '{}',  -- OF/lote: varias u opcional
  solicitante        text,
  informacion_previa text,
  valoracion_final   text,
  fecha_emision      date,
  realizado_por      integer NOT NULL REFERENCES usuarios(id),  -- analista
  aprobado_por       integer REFERENCES usuarios(id),
  aprobado_en        timestamptz,
  firmado_por        integer REFERENCES usuarios(id),
  firmado_en         timestamptz,
  firma_token        text,
  anulado_por        integer REFERENCES usuarios(id),
  anulado_en         timestamptz,
  motivo_anulacion   text,
  creado_en          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_ensayos_pin_cliente ON ensayos_pintura(cliente_id);

-- Filas del informe (Id 1..N): Ensayo-Descripción, Exigencia, Resultado,
-- Característica, Observaciones y Conformidad (OK/NOK).
CREATE TABLE ensayo_pin_filas (
  id            serial PRIMARY KEY,
  ensayo_id     integer NOT NULL REFERENCES ensayos_pintura(id) ON DELETE CASCADE,
  numero        integer NOT NULL,
  descripcion   text NOT NULL,                 -- Ensayo-Descripción
  exigencia     text,
  resultado     text,
  caracteristica text,
  observaciones text,
  conformidad   text CHECK (conformidad IN ('OK', 'NOK')),
  realizado_por integer NOT NULL REFERENCES usuarios(id),
  creado_en     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (ensayo_id, numero)
);

-- Apartado general de fotos del informe: cada foto lleva su descripción.
CREATE TABLE ensayo_pin_fotos (
  id              serial PRIMARY KEY,
  ensayo_id       integer NOT NULL REFERENCES ensayos_pintura(id) ON DELETE CASCADE,
  archivo         text NOT NULL,
  nombre_original text,
  descripcion     text,
  sha256          text,
  subida_por      integer NOT NULL REFERENCES usuarios(id),
  subida_en       timestamptz NOT NULL DEFAULT now()
);

-- Apartado de ESPESORES por pieza: cada pieza (1, 2, 3…) lleva su comentario y
-- una sola imagen (columnas en la propia fila; se reemplaza al subir otra).
CREATE TABLE ensayo_pin_piezas (
  id               serial PRIMARY KEY,
  ensayo_id        integer NOT NULL REFERENCES ensayos_pintura(id) ON DELETE CASCADE,
  numero           integer NOT NULL,           -- Pieza 1, 2, 3…
  comentario       text,
  imagen_archivo   text,
  imagen_nombre    text,
  imagen_sha256    text,
  imagen_subida_por integer REFERENCES usuarios(id),
  creado_en        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (ensayo_id, numero)
);

-- Puntos de medición de espesor de la pieza (1..N), en µm. El promedio NO se
-- almacena: se calcula como media de los valores no nulos (cliente y PDF).
CREATE TABLE ensayo_pin_espesores (
  id        serial PRIMARY KEY,
  pieza_id  integer NOT NULL REFERENCES ensayo_pin_piezas(id) ON DELETE CASCADE,
  punto     integer NOT NULL,
  valor     numeric,
  UNIQUE (pieza_id, punto)
);
