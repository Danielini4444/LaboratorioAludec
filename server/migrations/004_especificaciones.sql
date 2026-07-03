-- Especificaciones por cliente y norma para un tipo de ensayo.
-- limites: { clave_de_campo: { min?, max? } } — al capturar, el sistema
-- compara los valores medidos contra estos límites.
-- Un mismo cliente puede tener varias normas (ej. Stellantis PS8810/PS50014).

CREATE TABLE especificaciones (
  id              serial PRIMARY KEY,
  tipo_ensayo_id  integer NOT NULL REFERENCES tipos_ensayo(id),
  cliente_id      integer NOT NULL REFERENCES clientes(id),
  norma           text NOT NULL,
  limites         jsonb NOT NULL DEFAULT '{}',
  activa          boolean NOT NULL DEFAULT true,
  UNIQUE (tipo_ensayo_id, cliente_id, norma)
);

CREATE INDEX idx_especificaciones_tipo_cliente ON especificaciones(tipo_ensayo_id, cliente_id);
