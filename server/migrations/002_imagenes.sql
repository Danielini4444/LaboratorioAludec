-- Imágenes adjuntas a los ensayos (evidencia fotográfica).
-- El archivo vive en server/uploads/; aquí solo la referencia.

CREATE TABLE ensayo_imagenes (
  id              serial PRIMARY KEY,
  ensayo_id       integer NOT NULL REFERENCES ensayos(id) ON DELETE CASCADE,
  archivo         text NOT NULL,
  nombre_original text,
  subida_por      integer NOT NULL REFERENCES usuarios(id),
  subida_en       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ensayo_imagenes_ensayo ON ensayo_imagenes(ensayo_id);
