-- Catálogo de piezas: referencia + denominación + cliente.
-- Reemplaza al catálogo implícito que se deducía de las OFs anteriores.

CREATE TABLE piezas (
  id           serial PRIMARY KEY,
  referencia   text NOT NULL,
  denominacion text NOT NULL,
  cliente_id   integer NOT NULL REFERENCES clientes(id),
  activa       boolean NOT NULL DEFAULT true
);

CREATE UNIQUE INDEX idx_piezas_referencia ON piezas ((lower(referencia)));

-- Respaldo: registra como piezas las combinaciones ya usadas en OFs.
INSERT INTO piezas (referencia, denominacion, cliente_id)
SELECT DISTINCT ON (lower(referencia)) referencia, denominacion, cliente_id
FROM ofs
ORDER BY lower(referencia), creada_en DESC;
