-- Preparación para AUTH_MODE=sso (login central del QMS, ver login.md §5 y §9).
-- external_id = el `sub` del IdP central (espejo de identidad, único, nullable
-- para los usuarios locales de standalone).
ALTER TABLE usuarios ADD COLUMN external_id text UNIQUE;

-- Los usuarios creados por JIT desde el SSO no tienen contraseña local.
-- Todo usuario debe tener contraseña local O venir del IdP.
ALTER TABLE usuarios ALTER COLUMN password_hash DROP NOT NULL;
ALTER TABLE usuarios ADD CONSTRAINT usuarios_password_o_sso
  CHECK (password_hash IS NOT NULL OR external_id IS NOT NULL);
