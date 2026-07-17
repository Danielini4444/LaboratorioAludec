-- Módulo "Ensayos inyección" (alpha 0.2): informes de ensayos de piezas
-- inyectadas, hermano del Test de cromado (reportes_ensayo). Cabecera con
-- folio propio Iny_####, filas de ensayo (exigencia/resultado/característica/
-- observaciones/conformidad) y apartado de fotos con descripción por foto.
-- Captura el área de Metrología; mismo ciclo de vida que cromado
-- (aprobación, firma digital y anulación con traza).

-- Folio propio del módulo, desde 1 (se muestra como Iny_0001).
CREATE SEQUENCE iny_folio_seq START 1;

CREATE TABLE ensayos_inyeccion (
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
CREATE INDEX idx_ensayos_iny_cliente ON ensayos_inyeccion(cliente_id);

-- Filas del informe (Id 1..N): Ensayo-Descripción, Exigencia, Resultado,
-- Característica, Observaciones y Conformidad (OK/NOK).
CREATE TABLE ensayo_iny_filas (
  id            serial PRIMARY KEY,
  ensayo_id     integer NOT NULL REFERENCES ensayos_inyeccion(id) ON DELETE CASCADE,
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

-- Apartado de fotos del informe: cada foto lleva su descripción.
CREATE TABLE ensayo_iny_fotos (
  id              serial PRIMARY KEY,
  ensayo_id       integer NOT NULL REFERENCES ensayos_inyeccion(id) ON DELETE CASCADE,
  archivo         text NOT NULL,
  nombre_original text,
  descripcion     text,
  sha256          text,
  subida_por      integer NOT NULL REFERENCES usuarios(id),
  subida_en       timestamptz NOT NULL DEFAULT now()
);
