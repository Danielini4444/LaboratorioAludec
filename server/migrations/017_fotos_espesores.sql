-- Nueva sección de fotos para el registro: 'espesores' (thickness), por pieza,
-- junto a las que ya existían (muestra, step, poros) del formato FM-15-01-03.
ALTER TABLE registro_imagenes DROP CONSTRAINT IF EXISTS registro_imagenes_seccion_check;
ALTER TABLE registro_imagenes
  ADD CONSTRAINT registro_imagenes_seccion_check
  CHECK (seccion IN ('muestra', 'step', 'poros', 'espesores'));
