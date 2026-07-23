import { createContext, useContext, useEffect, useState } from 'react';
import { Routes, Route, NavLink, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { api } from './api.js';
import { modoAuth, cerrarSesion } from './sso.js';
import Login from './pages/Login.jsx';
import Registros from './pages/Registros.jsx';
import NuevoRegistro from './pages/NuevoRegistro.jsx';
import RegistroDetalle from './pages/RegistroDetalle.jsx';
import ReportesEnsayo, { esMetrologia } from './pages/ReportesEnsayo.jsx';
import NuevoReporte from './pages/NuevoReporte.jsx';
import ReporteDetalle from './pages/ReporteDetalle.jsx';
import EnsayosInyeccion from './pages/EnsayosInyeccion.jsx';
import NuevoEnsayoInyeccion from './pages/NuevoEnsayoInyeccion.jsx';
import EnsayoInyeccionDetalle from './pages/EnsayoInyeccionDetalle.jsx';
import EnsayosPintura from './pages/EnsayosPintura.jsx';
import NuevoEnsayoPintura from './pages/NuevoEnsayoPintura.jsx';
import EnsayoPinturaDetalle from './pages/EnsayoPinturaDetalle.jsx';
import SolicitudesEnsayo from './pages/SolicitudesEnsayo.jsx';
import NuevaSolicitud from './pages/NuevaSolicitud.jsx';
import SolicitudDetalle from './pages/SolicitudDetalle.jsx';
import PlanesPrueba from './pages/PlanesPrueba.jsx';
import Admin from './pages/Admin.jsx';
import ImprimirOF from './pages/ImprimirOF.jsx';
import CambiarPassword from './pages/CambiarPassword.jsx';

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export const ROLES_NOMBRE = {
  admin: 'Administrador',
  auditor: 'Auditor',
  auditor_admin: 'Auditor admin',
  solicitante: 'Solicitante',
  admin_area: 'Admin de área',
  usuario_area: 'Usuario de área'
};

const IconoEnsayos = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 2h6v4H9z" /><path d="M15 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
    <path d="M9 12h6" /><path d="M9 16h4" />
  </svg>
);

const IconoRegistro = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10 2v7.5L4.5 19a2 2 0 0 0 1.7 3h11.6a2 2 0 0 0 1.7-3L14 9.5V2" />
    <path d="M8.5 2h7" /><path d="M7 16h10" />
  </svg>
);

const IconoInyeccion = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2v4" /><path d="M8 4h8" />
    <path d="M7 6h10l1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2z" />
    <path d="M7.5 13h9" />
  </svg>
);

const IconoPintura = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 3H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h9" />
    <path d="M14 13v3a2 2 0 0 1-2 2h-1a1 1 0 0 0-1 1v2" />
    <path d="M8 21h4" />
  </svg>
);

const IconoPlan = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 2h6a1 1 0 0 1 1 1v1h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2V3a1 1 0 0 1 1-1z" />
    <path d="M9 13l2 2 4-4" />
  </svg>
);

const IconoImprimir = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 9V2h12v7" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
    <rect x="6" y="14" width="12" height="8" />
  </svg>
);

const IconoSolicitud = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" />
    <path d="M9 13h6" /><path d="M9 17h4" />
  </svg>
);

const IconoAdmin = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.09a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h.09a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.09a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);

// En modo sso el usuario ya se autenticó en el login central; si lab responde
// 403 es que nadie le ha asignado un rol de este sistema en el panel del QMS.
function SinAcceso() {
  return (
    <div className="pantalla-carga">
      <div>
        <p>Tu cuenta no tiene acceso al sistema de laboratorio.</p>
        <p>Solicita el rol a un administrador del QMS.</p>
        <button className="link" onClick={cerrarSesion}>Cerrar sesión</button>
      </div>
    </div>
  );
}

// Punto con el número de reportes pendientes de generar en un módulo.
function PuntoPendiente({ n }) {
  if (!n) return null;
  return <span className="punto-pendiente" title={`${n} reporte(s) pendiente(s)`}>{n}</span>;
}

function Layout({ children }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const veAdmin = user.rol === 'admin' || user.rol === 'auditor_admin';
  const iniciales = user.nombre.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase();
  // Conteo de reportes pendientes por módulo (para el punto del menú); se
  // refresca al navegar, así el punto se actualiza al tomar/cerrar solicitudes.
  const [pendientes, setPendientes] = useState({});
  useEffect(() => {
    api('/solicitudes-ensayo/pendientes-conteo').then(setPendientes).catch(() => {});
  }, [location.pathname]);
  return (
    <div className="app">
      <aside className="sidebar">
        <div className="marca" style={{ backgroundColor: 'white' }}>
          <img className="logo" src="/logo.png" alt="ALUDEC" style={{ height: '40px' }}/>
          <div className="sub" style={{ fontSize: '15px', marginTop: '10px', color: 'black' }}>
          <span><b>Laboratorio ALUDEC</b></span>
          </div>
        </div>
        <nav>
          <NavLink to="/solicitudes"><IconoSolicitud /> Solicitud de ensayos</NavLink>
          <NavLink to="/registros"><IconoRegistro /> Laboratorio químico <PuntoPendiente n={pendientes.registro} /></NavLink>
          <NavLink to="/reportes"><IconoEnsayos /> Test de cromado <PuntoPendiente n={pendientes.cromado} /></NavLink>
          <NavLink to="/inyeccion"><IconoInyeccion /> Ensayos inyección <PuntoPendiente n={pendientes.inyeccion} /></NavLink>
          <NavLink to="/pintura"><IconoPintura /> Ensayos pintura <PuntoPendiente n={pendientes.pintura} /></NavLink>
          {esMetrologia(user) && <NavLink to="/planes"><IconoPlan /> Planes de prueba</NavLink>}
          <NavLink to="/imprimir"><IconoImprimir /> Imprimir por OF</NavLink>
          {veAdmin && <NavLink to="/admin"><IconoAdmin /> Administración</NavLink>}
        </nav>
        <div className="sidebar-user">
          <div className="avatar">{iniciales}</div>
          <div>
            <div className="nombre">{user.nombre}</div>
            <div className="rol">
              {ROLES_NOMBRE[user.rol]}{user.area_nombre ? ` · ${user.area_nombre}` : ''}
            </div>
            <button className="link" onClick={logout}>Cerrar sesión</button>
          </div>
        </div>
      </aside>
      <main className="contenido">{children}</main>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [cargando, setCargando] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    api('/auth/me')
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setCargando(false));
  }, []);

  const login = async (usuario, password) => {
    const u = await api('/auth/login', { method: 'POST', body: { usuario, password } });
    setUser(u);
    navigate('/registros');
  };

  const logout = async () => {
    if (modoAuth === 'sso') return cerrarSesion(); // redirige al login central
    await api('/auth/logout', { method: 'POST' });
    setUser(null);
    navigate('/login');
  };

  const refrescar = () => api('/auth/me').then(setUser).catch(() => setUser(null));

  if (cargando) return <div className="pantalla-carga">Cargando…</div>;

  return (
    <AuthContext.Provider value={{ user, login, logout, refrescar }}>
      {!user ? (
        modoAuth === 'sso' ? (
          <SinAcceso />
        ) : (
          <Routes>
            <Route path="*" element={<Login />} />
          </Routes>
        )
      ) : user.debe_cambiar_password ? (
        <CambiarPassword />
      ) : (
        <Layout>
          <Routes>
            <Route path="/" element={<Navigate to="/registros" replace />} />
            <Route path="/login" element={<Navigate to="/registros" replace />} />
            <Route path="/registros" element={<Registros />} />
            <Route path="/registros/nuevo" element={<NuevoRegistro />} />
            <Route path="/registros/:id/editar" element={<NuevoRegistro />} />
            <Route path="/registros/:id" element={<RegistroDetalle />} />
            <Route path="/reportes" element={<ReportesEnsayo />} />
            <Route path="/reportes/nuevo" element={<NuevoReporte />} />
            <Route path="/reportes/:id" element={<ReporteDetalle />} />
            <Route path="/inyeccion" element={<EnsayosInyeccion />} />
            <Route path="/inyeccion/nuevo" element={<NuevoEnsayoInyeccion />} />
            <Route path="/inyeccion/:id" element={<EnsayoInyeccionDetalle />} />
            <Route path="/pintura" element={<EnsayosPintura />} />
            <Route path="/pintura/nuevo" element={<NuevoEnsayoPintura />} />
            <Route path="/pintura/:id" element={<EnsayoPinturaDetalle />} />
            <Route path="/solicitudes" element={<SolicitudesEnsayo />} />
            <Route path="/solicitudes/nueva" element={<NuevaSolicitud />} />
            <Route path="/solicitudes/:id" element={<SolicitudDetalle />} />
            <Route path="/planes" element={<PlanesPrueba />} />
            <Route path="/imprimir" element={<ImprimirOF />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="*" element={<Navigate to="/registros" replace />} />
          </Routes>
        </Layout>
      )}
    </AuthContext.Provider>
  );
}