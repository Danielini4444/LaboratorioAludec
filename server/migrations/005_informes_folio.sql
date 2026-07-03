-- Rediseño del informe al formato real del laboratorio (FM-15-30):
-- el informe es por folio (petición de ensayos), con una pieza, varias OFs
-- (una por proceso), ensayos con equipo/fechas/característica/resultado,
-- valoración final y aprobaciones. Sustituye al modelo "informe por OF".

CREATE TABLE equipos (
  id                 serial PRIMARY KEY,
  nombre             text NOT NULL,
  referencia_interna text,
  fecha_calibracion  date,
  activo             boolean NOT NULL DEFAULT true
);
CREATE UNIQUE INDEX idx_equipos_ref ON equipos ((lower(referencia_interna))) WHERE referencia_interna IS NOT NULL;

CREATE TABLE procesos (
  id      serial PRIMARY KEY,
  nombre  text NOT NULL UNIQUE,
  activo  boolean NOT NULL DEFAULT true
);
INSERT INTO procesos (nombre) VALUES
  ('Cromado'), ('Inyección'), ('Pintado'), ('Montaje'), ('Esmaltado'), ('Stamping');

-- Folio consecutivo (Nº Ensayo). Arranca donde va el consecutivo real.
CREATE SEQUENCE folio_seq START 2630;

-- La tabla informes anterior solo registraba emisiones de PDF; se rehace.
DROP TABLE informes;
CREATE TABLE informes (
  id                 serial PRIMARY KEY,
  folio              integer NOT NULL UNIQUE,
  referencia         text NOT NULL,
  denominacion       text NOT NULL,
  cliente_id         integer NOT NULL REFERENCES clientes(id),
  pieza_id           integer REFERENCES piezas(id),
  solicitante        text,
  contacto           text,
  tipo_pieza         text,
  tecnologias        jsonb NOT NULL DEFAULT '[]',
  fecha_recepcion    date,
  cantidad_piezas    integer,
  informacion_previa text,
  valoracion_final   text,
  conformidad        text CHECK (conformidad IN ('OK', 'NOK')),
  aspecto            text,
  trazabilidad       text,
  estado             text NOT NULL DEFAULT 'abierto' CHECK (estado IN ('abierto', 'cerrado')),
  creado_por         integer NOT NULL REFERENCES usuarios(id),
  cerrado_por        integer REFERENCES usuarios(id),
  creado_en          timestamptz NOT NULL DEFAULT now(),
  cerrado_en         timestamptz
);

-- OFs del informe, una por proceso (trazabilidad de barra por proceso).
CREATE TABLE informe_ofs (
  id          serial PRIMARY KEY,
  informe_id  integer NOT NULL REFERENCES informes(id) ON DELETE CASCADE,
  proceso_id  integer NOT NULL REFERENCES procesos(id),
  of_clave    text NOT NULL,
  UNIQUE (informe_id, proceso_id)
);
CREATE INDEX idx_informe_ofs_clave ON informe_ofs(of_clave);

ALTER TABLE ensayos
  ADD COLUMN informe_id     integer REFERENCES informes(id),
  ADD COLUMN equipo_id      integer REFERENCES equipos(id),
  ADD COLUMN fecha_inicio   timestamptz,
  ADD COLUMN fecha_fin      timestamptz,
  ADD COLUMN caracteristica text,
  ADD COLUMN resultado_texto text;

-- Criterio de aceptación textual (se imprime como Característica/Characteristic).
ALTER TABLE especificaciones ADD COLUMN exigencia text;

-- Datos existentes: cada OF se vuelve un informe abierto con su OF en Cromado.
ALTER TABLE informes ADD COLUMN _of_origen integer;
INSERT INTO informes (folio, referencia, denominacion, cliente_id, solicitante, informacion_previa, creado_por, creado_en, _of_origen)
SELECT nextval('folio_seq'), o.referencia, o.denominacion, o.cliente_id, 'Control Proceso', o.notas, o.creada_por, o.creada_en, o.id
FROM ofs o ORDER BY o.id;

INSERT INTO informe_ofs (informe_id, proceso_id, of_clave)
SELECT i.id, (SELECT id FROM procesos WHERE nombre = 'Cromado'), o.clave
FROM informes i JOIN ofs o ON o.id = i._of_origen;

UPDATE ensayos e SET informe_id = i.id FROM informes i WHERE i._of_origen = e.of_id;
ALTER TABLE informes DROP COLUMN _of_origen;
ALTER TABLE ensayos ALTER COLUMN informe_id SET NOT NULL;

-- El flujo de solicitudes lo absorbe el informe en estado "abierto".
ALTER TABLE ensayos DROP COLUMN of_id;
ALTER TABLE ensayos DROP COLUMN solicitud_id;
DROP TABLE solicitudes;
DROP TABLE ofs;

CREATE INDEX idx_ensayos_informe ON ensayos(informe_id);
