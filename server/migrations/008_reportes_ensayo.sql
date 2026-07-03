-- Reportes de Metrología y Ensayos (formato FM-15-30, folio Ens_####):
-- el otro reporte del laboratorio, junto al registro de espesores.
-- Estructura según "Información reportes.pdf": datos generales con folio
-- único, identificación de la pieza, pruebas con norma+apartado, equipo
-- (con calibración), condiciones, resultados con fotos y tipo de falla,
-- conclusión y aprobaciones.

-- Folio único Ens_#### — continúa el consecutivo del sistema viejo.
CREATE SEQUENCE ens_folio_seq START 2630;

CREATE TABLE reportes_ensayo (
  id                   serial PRIMARY KEY,
  folio                integer NOT NULL UNIQUE,
  cliente_id           integer NOT NULL REFERENCES clientes(id),
  referencia           text NOT NULL,
  denominacion         text NOT NULL,
  proyecto             text,
  area_solicitante     text,                    -- Control Proceso, Calidad…
  descripcion_material text,                    -- pieza completa cromada, componente soldado…
  of                   text,
  fecha_recepcion      date,
  cantidad_piezas      integer,
  informacion_previa   text,
  conclusion           text CHECK (conclusion IN ('CUMPLE', 'NO_CUMPLE')),
  valoracion_final     text,
  fecha_emision        date,
  realizado_por        integer NOT NULL REFERENCES usuarios(id),  -- analista
  aprobado_por         integer REFERENCES usuarios(id),
  aprobado_en          timestamptz,
  creado_en            timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_reportes_cliente ON reportes_ensayo(cliente_id);
CREATE INDEX idx_reportes_of ON reportes_ensayo(of);

-- Las pruebas del reporte (Test 1..N), capturadas conforme terminan.
CREATE TABLE reporte_pruebas (
  id             serial PRIMARY KEY,
  reporte_id     integer NOT NULL REFERENCES reportes_ensayo(id) ON DELETE CASCADE,
  numero         integer NOT NULL,
  ensayo         text NOT NULL,                 -- Grind Saw Test, Stone Chip…
  norma          text,                          -- TL 528 D-21, WSS-M1P83-E2…
  apartado       text,                          -- 3.5.1
  criterios      text,                          -- criterios de aceptación
  equipo_id      integer REFERENCES equipos(id),
  condiciones    text,                          -- velocidad, carga, curado…
  fecha_inicio   timestamptz,
  fecha_fin      timestamptz,
  resultado      text,                          -- datos individuales
  tipo_falla     text,
  valoracion     text CHECK (valoracion IN ('OK', 'NOK')),
  realizado_por  integer NOT NULL REFERENCES usuarios(id),
  creado_en      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (reporte_id, numero)
);

CREATE TABLE prueba_imagenes (
  id              serial PRIMARY KEY,
  prueba_id       integer NOT NULL REFERENCES reporte_pruebas(id) ON DELETE CASCADE,
  archivo         text NOT NULL,
  nombre_original text,
  subida_por      integer NOT NULL REFERENCES usuarios(id),
  subida_en       timestamptz NOT NULL DEFAULT now()
);
