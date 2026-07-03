-- alpha 0.1x — endurecimiento de integridad de registros de calidad (IATF):
-- anulación con traza en vez de borrado, sello de aprobación en químico,
-- cambio de contraseña obligatorio y hash de la evidencia fotográfica.

-- 1) Sello de aprobación faltante en registros de espesores (paridad con reportes)
ALTER TABLE registros_espesores ADD COLUMN aprobado_en timestamptz;

-- 2) Anulación con traza (soft-delete) en ambos registros de calidad
ALTER TABLE registros_espesores
  ADD COLUMN anulado_por integer REFERENCES usuarios(id),
  ADD COLUMN anulado_en timestamptz,
  ADD COLUMN motivo_anulacion text;
ALTER TABLE reportes_ensayo
  ADD COLUMN anulado_por integer REFERENCES usuarios(id),
  ADD COLUMN anulado_en timestamptz,
  ADD COLUMN motivo_anulacion text;

-- 3) Cambio de contraseña obligatorio en el primer ingreso
ALTER TABLE usuarios ADD COLUMN debe_cambiar_password boolean NOT NULL DEFAULT false;
-- los usuarios existentes están con la contraseña por defecto: que la roten
UPDATE usuarios SET debe_cambiar_password = true;

-- 4) Hash SHA-256 de la evidencia, para detectar archivo faltante o alterado
ALTER TABLE registro_imagenes ADD COLUMN sha256 text;
ALTER TABLE prueba_imagenes ADD COLUMN sha256 text;
