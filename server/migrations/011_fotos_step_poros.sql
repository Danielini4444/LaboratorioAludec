-- Las fotos del registro de espesores ahora pueden pertenecer a una pieza
-- y a una sección: 'muestra' (general, con los puntos de medición),
-- 'step' (gráficas de espesor/potencial) o 'poros' (conteo al microscopio),
-- como en el formato FM-15-01-03.
ALTER TABLE registro_imagenes
  ADD COLUMN pieza_id integer REFERENCES registro_piezas(id) ON DELETE CASCADE,
  ADD COLUMN seccion text NOT NULL DEFAULT 'muestra' CHECK (seccion IN ('muestra', 'step', 'poros'));
