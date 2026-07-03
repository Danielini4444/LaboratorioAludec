require('dotenv').config();
const path = require('path');
const express = require('express');
const session = require('express-session');
const PgSession = require('connect-pg-simple')(session);
const { pool } = require('./db');

const app = express();
app.use(express.json());
app.use(session({
  store: new PgSession({ pool, createTableIfMissing: true }),
  secret: process.env.SESSION_SECRET || 'cambia-este-secreto',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 8 * 60 * 60 * 1000 }
}));

// Mientras un usuario deba cambiar su contraseña, solo puede usar /api/auth
// (login, me, logout, cambiar-password). Todo lo demás queda bloqueado.
app.use('/api', (req, res, next) => {
  const u = req.session.user;
  if (u && u.debe_cambiar_password && !req.path.startsWith('/auth/')) {
    return res.status(403).json({ error: 'Debes cambiar tu contraseña antes de continuar', code: 'CAMBIO_REQUERIDO' });
  }
  next();
});

app.use('/api/auth', require('./routes/auth'));
app.use('/api/usuarios', require('./routes/usuarios'));
app.use('/api/areas', require('./routes/areas'));
app.use('/api/clientes', require('./routes/clientes'));
app.use('/api/piezas', require('./routes/piezas'));
app.use('/api/equipos', require('./routes/equipos'));
app.use('/api/registros', require('./routes/registros'));
app.use('/api/reportes', require('./routes/reportes'));
app.use('/api/planes', require('./routes/planes'));
app.use('/api/imagenes', require('./routes/imagenes'));
app.use('/api/especificaciones', require('./routes/especificaciones'));
app.use('/api/of', require('./routes/of'));
app.use('/api/solicitudes-ensayo', require('./routes/solicitudesEnsayo'));

app.use((err, req, res, next) => {
  if (err.status) return res.status(err.status).json({ error: err.message });
  console.error(err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

// En producción el mismo proceso sirve el cliente compilado (client/dist).
const dist = path.join(__dirname, '..', '..', 'client', 'dist');
app.use(express.static(dist));
app.get(/^\/(?!api).*/, (req, res) => {
  res.sendFile(path.join(dist, 'index.html'), err => { if (err) res.status(404).end(); });
});

const port = process.env.PORT || 3000;
app.listen(port, '0.0.0.0', () => console.log(`Servidor escuchando en http://localhost:${port}`));
