-- alpha 0.3x — Especificaciones de espesores de PINTURA por cliente, hermanas
-- de las normas del laboratorio químico (especificaciones). Cada spec (cliente
-- + norma) define varias CAPAS (primer / base / transparente / total…), cada
-- una con su rango mín–máx en µm. Al capturar el ensayo de pintura, cada pieza
-- registra un valor por capa y se valida contra estos rangos.

CREATE TABLE especificaciones_pintura (
  id          serial PRIMARY KEY,
  cliente_id  integer NOT NULL REFERENCES clientes(id),
  norma       text NOT NULL,
  activa      boolean NOT NULL DEFAULT true,
  UNIQUE (cliente_id, norma)
);
CREATE INDEX idx_especs_pintura_cliente ON especificaciones_pintura(cliente_id);

CREATE TABLE especificacion_pintura_capas (
  id          serial PRIMARY KEY,
  espec_id    integer NOT NULL REFERENCES especificaciones_pintura(id) ON DELETE CASCADE,
  orden       integer NOT NULL,
  nombre      text NOT NULL,               -- Primer, Base, Transparente, Total…
  espesor_min numeric,
  espesor_max numeric,
  UNIQUE (espec_id, orden)
);

-- El informe de pintura apunta al spec elegido (se filtra por su cliente).
ALTER TABLE ensayos_pintura
  ADD COLUMN especificacion_pintura_id integer REFERENCES especificaciones_pintura(id);

-- Los espesores de la pieza dejan de ser "puntos" y pasan a ser un valor por
-- CAPA (nombre de capa + valor). La validación casa el nombre contra la capa
-- del spec, así que soporta también capas libres (sin spec).
ALTER TABLE ensayo_pin_espesores DROP CONSTRAINT ensayo_pin_espesores_pieza_id_punto_key;
ALTER TABLE ensayo_pin_espesores DROP COLUMN punto;
ALTER TABLE ensayo_pin_espesores ADD COLUMN capa text;
