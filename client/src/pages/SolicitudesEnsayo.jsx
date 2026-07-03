import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../App.jsx';
import { useDebounce } from '../components/useDebounce.js';
import { ESTADOS } from '../ensayosCatalogo.js';
import Cargando from '../components/Cargando.jsx';

export const puedeSolicitar = (user) => user.rol === 'admin' || user.rol === 'solicitante';

const IconoVacio = () => (
  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="icono">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" />
    <path d="M9 13h6" /><path d="M9 17h4" />
  </svg>
);

export default function SolicitudesEnsayo() {
  const { user } = useAuth();
  const [solicitudes, setSolicitudes] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [estado, setEstado] = useState('');
  const [tipo, setTipo] = useState('');
  const [clienteId, setClienteId] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [cargando, setCargando] = useState(true);
  const q = useDebounce(busqueda, 300);

  useEffect(() => {
    let vigente = true;
    setCargando(true);
    api(`/solicitudes-ensayo?q=${encodeURIComponent(q)}&estado=${estado}&tipo=${tipo}&cliente_id=${clienteId}`)
      .then(rs => { if (vigente) setSolicitudes(rs); })
      .catch(() => { if (vigente) setSolicitudes([]); })
      .finally(() => { if (vigente) setCargando(false); });
    return () => { vigente = false; };
  }, [q, estado, tipo, clienteId]);

  useEffect(() => { api('/clientes').then(setClientes).catch(() => {}); }, []);

  const filtrando = !!(estado || tipo || clienteId || busqueda);

  return (
    <div>
      <div className="encabezado-detalle">
        <div className="encabezado-pagina">
          <h2>Solicitud de ensayos</h2>
          <p className="descripcion">Peticiones de ensayo al laboratorio · formatos FM-15-01 (producto) y FM-15-01A (materia prima)</p>
        </div>
        {puedeSolicitar(user) && <Link className="boton" to="/solicitudes/nueva">+ Nueva solicitud</Link>}
      </div>

      <div className="barra-busqueda">
        <select value={estado} onChange={e => setEstado(e.target.value)}>
          <option value="">Todos los estados</option>
          {Object.entries(ESTADOS).map(([k, v]) => <option key={k} value={k}>{v.texto}</option>)}
        </select>
        <select value={tipo} onChange={e => setTipo(e.target.value)}>
          <option value="">SE y SEMP</option>
          <option value="SE">SE · producto</option>
          <option value="SEMP">SEMP · materia prima</option>
        </select>
        <select value={clienteId} onChange={e => setClienteId(e.target.value)}>
          <option value="">Todos los clientes</option>
          {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>
        <input placeholder="Buscar por folio, referencia, denominación, OF…" value={busqueda} onChange={e => setBusqueda(e.target.value)} />
      </div>

      {cargando ? (
        <Cargando />
      ) : solicitudes.length ? (
        <>
          <p className="conteo">{solicitudes.length} {solicitudes.length === 1 ? 'solicitud' : 'solicitudes'}{filtrando ? ' con el filtro actual' : ''}</p>
          <table className="tabla lista">
            <thead>
              <tr>
                <th>N°</th><th>Formato</th><th>Cliente</th><th>Referencia</th><th>Denominación</th>
                <th className="derecha">Ensayos</th><th>Estado</th><th>Solicitante</th>
              </tr>
            </thead>
            <tbody>
              {solicitudes.map(s => (
                <tr key={s.id} className={s.estado === 'cancelada' ? 'inactivo' : ''}>
                  <td><Link to={`/solicitudes/${s.id}`}>{s.tipo}-{s.folio}</Link></td>
                  <td>{s.tipo === 'SEMP' ? 'Materia prima' : 'Producto'}</td>
                  <td>{s.cliente_nombre || (s.proveedor ? `Prov. ${s.proveedor}` : '—')}</td>
                  <td>{s.referencia}</td>
                  <td>{s.denominacion || '—'}</td>
                  <td className="derecha">{s.num_ensayos}</td>
                  <td><span className={`badge ${ESTADOS[s.estado].badge}`}>{ESTADOS[s.estado].texto}</span></td>
                  <td>{s.solicitada_por_nombre}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : (
        <div className="vacio-bloque">
          <IconoVacio />
          {filtrando ? 'Ninguna solicitud coincide con el filtro.' : 'Todavía no hay solicitudes de ensayo.'}
          {puedeSolicitar(user) && !filtrando && (
            <div className="meta" style={{ marginTop: 6 }}>Crea la primera con “+ Nueva solicitud”.</div>
          )}
        </div>
      )}
    </div>
  );
}
