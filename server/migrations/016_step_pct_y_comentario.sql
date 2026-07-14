-- Laboratorio químico:
-- STEP: dos campos nuevos por pieza — porcentaje de Ni SB y Ni Br (respecto
--       al Ni total), capturados a mano.
-- Espesores: columna "comentario" por punto de medición.

ALTER TABLE registro_piezas
  ADD COLUMN ni_sb_pct numeric,
  ADD COLUMN ni_br_pct numeric;

ALTER TABLE registro_mediciones
  ADD COLUMN comentario text;
