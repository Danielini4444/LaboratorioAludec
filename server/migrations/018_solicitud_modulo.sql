-- alpha 0.3x — La solicitud de ensayos apunta DIRECTO a un módulo del sistema
-- (registro de espesores químico / cromado / inyección / pintura) en vez de
-- solo a un área. El área que atiende se deduce del módulo (registro→Químico,
-- cromado/inyección/pintura→Metrología), así que el solicitante ya no elige área.
-- Cuando el área toma la solicitud (en_proceso), en la lista del módulo aparece
-- el aviso "reporte pendiente de esta OF" para generarlo precargado.

ALTER TABLE solicitudes_ensayo
  ADD COLUMN modulo text CHECK (modulo IN ('registro','cromado','inyeccion','pintura'));

CREATE INDEX idx_sol_ensayo_modulo ON solicitudes_ensayo(modulo);
