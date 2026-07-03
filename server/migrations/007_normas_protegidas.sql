-- Las normas editadas a mano en Administración > Normas quedan protegidas:
-- el importador del Excel ya no las sobreescribe.
ALTER TABLE especificaciones ADD COLUMN editada_manual boolean NOT NULL DEFAULT false;
