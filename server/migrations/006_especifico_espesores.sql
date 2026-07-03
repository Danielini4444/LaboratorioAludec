-- Adiós a lo modular: fuera plantillas, tipos de ensayo, procesos e informes
-- por folio. El sistema se vuelve específico: registros de espesores + STEP
-- tal cual el formato FM-15-01-03 del laboratorio.
-- Se conservan los datos del dominio: piezas, equipos, clientes, usuarios,
-- áreas y especificaciones (que pasan a ser por cliente + norma).

-- especificaciones: ya no dependen de un "tipo de ensayo"
DELETE FROM especificaciones
WHERE tipo_ensayo_id NOT IN (SELECT id FROM tipos_ensayo WHERE nombre LIKE 'Registro de espesores%');
ALTER TABLE especificaciones DROP CONSTRAINT IF EXISTS especificaciones_tipo_ensayo_id_cliente_id_norma_key;
ALTER TABLE especificaciones DROP COLUMN tipo_ensayo_id;
ALTER TABLE especificaciones ADD CONSTRAINT especificaciones_cliente_norma UNIQUE (cliente_id, norma);

-- fuera el modelo modular completo (los registros capturados eran de prueba)
DROP TABLE ensayo_imagenes;
DROP TABLE ensayos;
DROP TABLE informe_ofs;
DROP TABLE informes;
DROP TABLE tipos_ensayo;
DROP TABLE procesos;
DROP SEQUENCE folio_seq;

-- El registro de espesores: una captura por parte ensayada, como una fila
-- (con sus dos piezas HCD/LCD) del Excel "Registro de espesores".
CREATE TABLE registros_espesores (
  id               serial PRIMARY KEY,
  reporte_no       integer NOT NULL,             -- consecutivo por cliente (REPORT NO.)
  cliente_id       integer NOT NULL REFERENCES clientes(id),
  norma            text,                          -- CUSTOMER NORME
  referencia       text NOT NULL,
  denominacion     text NOT NULL,
  of               text,
  barra            text,
  fecha_produccion date,
  fecha_prueba     date NOT NULL DEFAULT current_date,
  resultado        text CHECK (resultado IN ('PASS', 'FAIL')),
  observaciones    text,
  realizado_por    integer NOT NULL REFERENCES usuarios(id),  -- ISSUED BY
  aprobado_por     integer REFERENCES usuarios(id),           -- APPROVED BY
  creado_en        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cliente_id, reporte_no)
);
CREATE INDEX idx_registros_cliente ON registros_espesores(cliente_id);
CREATE INDEX idx_registros_of ON registros_espesores(of);

-- Las piezas medidas en un registro (Piece 1 FA3 HCD, Piece 2 FB31 LCD…).
-- El STEP es una medición por pieza, como en el formato.
CREATE TABLE registro_piezas (
  id             serial PRIMARY KEY,
  registro_id    integer NOT NULL REFERENCES registros_espesores(id) ON DELETE CASCADE,
  numero         integer NOT NULL,               -- Pieza 1, 2, 3…
  posicion_rack  text,                           -- FA3, FB31…
  densidad       text NOT NULL CHECK (densidad IN ('HCD', 'LCD')),
  step_punto     integer,
  ni_sb          numeric,
  ni_br          numeric,
  ni_mps         numeric,
  dp_mp_br       numeric,                        -- ΔP(NiMPS-NiB) mV
  dp_br_sb       numeric,                        -- ΔP(NiB-NiSB) mV
  poros          integer,                        -- pore count
  UNIQUE (registro_id, numero)
);

-- Puntos de medición de espesores por pieza (1, 2…): Cr, Ni total, Cu.
CREATE TABLE registro_mediciones (
  id        serial PRIMARY KEY,
  pieza_id  integer NOT NULL REFERENCES registro_piezas(id) ON DELETE CASCADE,
  punto     integer NOT NULL,
  cr        numeric,
  ni_total  numeric,
  cu        numeric,
  UNIQUE (pieza_id, punto)
);

-- Fotos del registro (muestra con puntos de medición, gráficas, poros).
CREATE TABLE registro_imagenes (
  id              serial PRIMARY KEY,
  registro_id     integer NOT NULL REFERENCES registros_espesores(id) ON DELETE CASCADE,
  archivo         text NOT NULL,
  nombre_original text,
  subida_por      integer NOT NULL REFERENCES usuarios(id),
  subida_en       timestamptz NOT NULL DEFAULT now()
);
