-- Un cliente puede tener varios planes de cromado (Stellantis: PS.50014 y
-- PS.50065). El plan se identifica por cliente + norma del plan.
-- Se vacía la tabla: el importador la repuebla con la estructura nueva.
DELETE FROM planes_prueba;
ALTER TABLE planes_prueba ADD COLUMN plan_norma text NOT NULL DEFAULT '';
ALTER TABLE planes_prueba DROP CONSTRAINT planes_prueba_proceso_cliente_id_orden_key;
ALTER TABLE planes_prueba ADD CONSTRAINT planes_prueba_unico UNIQUE (proceso, cliente_id, plan_norma, orden);
