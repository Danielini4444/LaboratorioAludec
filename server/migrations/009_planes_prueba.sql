-- Plan de pruebas por cliente (hoja CROMADO VAL del Excel de metrología):
-- las pruebas que por defecto lleva la validación de cromado de cada
-- cliente, con su norma y característica a evaluar. Se precargan al
-- reporte y el analista las completa conforme se ejecutan.
-- (proceso queda para las demás hojas: inyección, esmaltado, pegado…)

CREATE TABLE planes_prueba (
  id             serial PRIMARY KEY,
  proceso        text NOT NULL DEFAULT 'cromado',
  cliente_id     integer NOT NULL REFERENCES clientes(id),
  norma          text,
  ensayo         text NOT NULL,
  caracteristica text,
  orden          integer NOT NULL,
  UNIQUE (proceso, cliente_id, orden)
);
CREATE INDEX idx_planes_cliente ON planes_prueba(cliente_id, proceso);
