-- alpha 0.1x — Solicitud de ensayos como sistema de tickets.
-- Replica los dos formatos reales del laboratorio:
--   SE   = Solicitud de ensayos (producto)      · FM-15-01
--   SEMP = Solicitud de ensayos de materia prima · FM-15-01A
-- Cada solicitud es un ticket con estado (pendiente → en proceso → completada,
-- o cancelada con traza) dirigido a un área del laboratorio, con N líneas de
-- ensayo (tipo + n° muestras + observaciones), como los 3 renglones del formato.

-- Folio correlativo independiente por formato (el "N° de solicitud" del Excel).
CREATE SEQUENCE sol_se_folio_seq;
CREATE SEQUENCE sol_semp_folio_seq;

CREATE TABLE solicitudes_ensayo (
  id              serial PRIMARY KEY,
  tipo            text NOT NULL CHECK (tipo IN ('SE','SEMP')),
  folio           integer NOT NULL,
  -- área del laboratorio que atiende el ticket (Químico / Metrología)
  area_id         integer NOT NULL REFERENCES areas(id),

  -- identificación de la pieza / material (referencia → denominación)
  cliente_id      integer REFERENCES clientes(id),
  referencia      text NOT NULL,
  denominacion    text,

  -- SE: órdenes de fabricación por proceso
  of_cromado      text,
  of_inyeccion    text,
  of_ensamble     text,
  of_pintura      text,

  -- SEMP: datos de materia prima
  proveedor       text,
  numero_etiqueta text,
  color_material  text,
  fecha_caducidad date,

  notas           text,

  -- ciclo de vida del ticket
  estado          text NOT NULL DEFAULT 'pendiente'
                    CHECK (estado IN ('pendiente','en_proceso','completada','cancelada')),
  solicitada_por  integer NOT NULL REFERENCES usuarios(id),
  creada_en       timestamptz NOT NULL DEFAULT now(),
  atendida_por    integer REFERENCES usuarios(id),
  atendida_en     timestamptz,
  cerrada_en      timestamptz,
  motivo_cancelacion text,

  UNIQUE (tipo, folio)
);

-- Los renglones de ensayo del formato (en el Excel eran 3 fijos; aquí N).
CREATE TABLE solicitud_ensayo_lineas (
  id            serial PRIMARY KEY,
  solicitud_id  integer NOT NULL REFERENCES solicitudes_ensayo(id) ON DELETE CASCADE,
  orden         integer NOT NULL,
  ensayo        text NOT NULL,
  num_muestras  integer,
  observaciones text
);

CREATE INDEX idx_sol_ensayo_estado ON solicitudes_ensayo(estado);
CREATE INDEX idx_sol_ensayo_area ON solicitudes_ensayo(area_id);
CREATE INDEX idx_sol_ensayo_cliente ON solicitudes_ensayo(cliente_id);
CREATE INDEX idx_sol_lineas_solicitud ON solicitud_ensayo_lineas(solicitud_id);
