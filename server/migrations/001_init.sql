-- Esquema inicial del sistema de laboratorio.
-- Núcleo fijo: OF -> ensayos -> informe.
-- Parte configurable: áreas y tipos de ensayo (con sus campos) son datos, no código.

CREATE TABLE areas (
  id        serial PRIMARY KEY,
  nombre    text NOT NULL UNIQUE,
  activa    boolean NOT NULL DEFAULT true
);

CREATE TABLE usuarios (
  id            serial PRIMARY KEY,
  usuario       text NOT NULL UNIQUE,
  nombre        text NOT NULL,
  password_hash text NOT NULL,
  rol           text NOT NULL CHECK (rol IN ('admin','auditor','auditor_admin','solicitante','admin_area','usuario_area')),
  area_id       integer REFERENCES areas(id),
  activo        boolean NOT NULL DEFAULT true,
  -- los roles de área llevan área asignada; los globales no
  CHECK ((rol IN ('admin_area','usuario_area')) = (area_id IS NOT NULL))
);

CREATE TABLE clientes (
  id      serial PRIMARY KEY,
  nombre  text NOT NULL UNIQUE
);

-- Orden de fabricación: la clave que relaciona todas las pruebas de una pieza
-- entre áreas. Denominación y referencia identifican la pieza.
CREATE TABLE ofs (
  id           serial PRIMARY KEY,
  clave        text NOT NULL UNIQUE,
  cliente_id   integer NOT NULL REFERENCES clientes(id),
  denominacion text NOT NULL,
  referencia   text NOT NULL,
  notas        text,
  creada_por   integer NOT NULL REFERENCES usuarios(id),
  creada_en    timestamptz NOT NULL DEFAULT now()
);

-- Plantilla de prueba definida por el admin de cada área.
-- campos: [{clave, etiqueta, tipo: numero|texto|booleano|opcion, unidad?, opciones?, requerido?}]
CREATE TABLE tipos_ensayo (
  id          serial PRIMARY KEY,
  area_id     integer NOT NULL REFERENCES areas(id),
  nombre      text NOT NULL,
  descripcion text,
  campos      jsonb NOT NULL DEFAULT '[]',
  activo      boolean NOT NULL DEFAULT true,
  UNIQUE (area_id, nombre)
);

CREATE TABLE solicitudes (
  id              serial PRIMARY KEY,
  of_id           integer NOT NULL REFERENCES ofs(id),
  tipo_ensayo_id  integer NOT NULL REFERENCES tipos_ensayo(id),
  solicitada_por  integer NOT NULL REFERENCES usuarios(id),
  estado          text NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente','completada','cancelada')),
  notas           text,
  creada_en       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE ensayos (
  id              serial PRIMARY KEY,
  of_id           integer NOT NULL REFERENCES ofs(id),
  tipo_ensayo_id  integer NOT NULL REFERENCES tipos_ensayo(id),
  solicitud_id    integer REFERENCES solicitudes(id),
  valores         jsonb NOT NULL DEFAULT '{}',
  resultado       text CHECK (resultado IN ('conforme','no_conforme')),
  observaciones   text,
  realizado_por   integer NOT NULL REFERENCES usuarios(id),
  realizado_en    timestamptz NOT NULL DEFAULT now()
);

-- Registro de cada emisión de informe (el PDF se genera al momento).
CREATE TABLE informes (
  id           serial PRIMARY KEY,
  of_id        integer NOT NULL REFERENCES ofs(id),
  numero       text NOT NULL UNIQUE,
  generado_por integer NOT NULL REFERENCES usuarios(id),
  generado_en  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ofs_cliente ON ofs(cliente_id);
CREATE INDEX idx_ensayos_of ON ensayos(of_id);
CREATE INDEX idx_solicitudes_of ON solicitudes(of_id);
CREATE INDEX idx_tipos_ensayo_area ON tipos_ensayo(area_id);
