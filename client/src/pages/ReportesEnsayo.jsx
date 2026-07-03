import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../App.jsx';
import { useDebounce } from '../components/useDebounce.js';
import Cargando from '../components/Cargando.jsx';

export function esMetrologia(user) {
  return user.rol === 'admin' ||
    ((user.rol === 'admin_area' || user.rol === 'usuario_area') && user.area_nombre === 'Metrología');
}

const IconoVacio = () => (
  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="icono">
    <path d="M9 2h6v4H9z" /><path d="M15 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
    <path d="M9 12h6" /><path d="M9 16h4" />
  </svg>
);

export default function ReportesEnsayo() {
  const { user } = useAuth();
  const [reportes, setReportes] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [clienteId, setClienteId] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [cargando, setCargando] = useState(true);
  const q = useDebounce(busqueda, 300);

  useEffect(() => {
    let vigente = true;
    setCargando(true);
    api(`/reportes?q=${encodeURIComponent(q)}&cliente_id=${clienteId}`)
      .then(rs => { if (vigente) setReportes(rs); })
      .catch(() => { if (vigente) setReportes([]); })
      .finally(() => { if (vigente) setCargando(false); });
    return () => { vigente = false; };
  }, [q, clienteId]);

  useEffect(() => { api('/clientes').then(setClientes).catch(() => {}); }, []);

  const filtrando = !!(clienteId || busqueda);

  return (
    <div>
      <div className="encabezado-detalle">
        <div className="encabezado-pagina">
          <h2>Test de cromado</h2>
          <p className="descripcion">Informes de ensayos con folio único (adherencia, stone chip, corrosión…) · formato FM-15-30</p>
        </div>
        {esMetrologia(user) && <Link className="boton" to="/reportes/nuevo">+ Nuevo reporte</Link>}
      </div>
      <div className="barra-busqueda">
        <select value={clienteId} onChange={e => setClienteId(e.target.value)}>
          <option value="">Todos los clientes</option>
          {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>
        <input
          placeholder="Buscar por folio, referencia, denominación u OF…"
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
        />
      </div>

      {cargando ? (
        <Cargando />
      ) : reportes.length ? (
        <>
          <p className="conteo">{reportes.length} {reportes.length === 1 ? 'reporte' : 'reportes'}{filtrando ? ' con el filtro actual' : ''}</p>
          <table className="tabla lista">
            <thead>
              <tr>
                <th>Folio</th><th>Cliente</th><th>Referencia</th><th>Denominación</th>
                <th>OF</th><th className="derecha">Pruebas</th><th>Conclusión</th><th>Analista</th>
              </tr>
            </thead>
            <tbody>
              {reportes.map(r => (
                <tr key={r.id} className={r.anulado ? 'inactivo' : ''}>
                  <td><Link to={`/reportes/${r.id}`}>Ens_{r.folio}</Link></td>
                  <td>{r.cliente_nombre}</td>
                  <td>{r.referencia}</td>
                  <td>{r.denominacion}</td>
                  <td>{r.of || '—'}</td>
                  <td className="derecha">{r.num_pruebas}</td>
                  <td>
                    {r.conclusion
                      ? <span className={`badge ${r.conclusion === 'CUMPLE' ? 'ok' : 'mal'}`}>{r.conclusion === 'CUMPLE' ? 'CUMPLE' : 'NO CUMPLE'}</span>
                      : <span className="badge pendiente">En proceso</span>}
                    {r.anulado && <span className="badge mal">ANULADO</span>}
                  </td>
                  <td>{r.realizado_por_nombre}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : (
        <div className="vacio-bloque">
          <IconoVacio />
          {filtrando
            ? 'Ningún reporte coincide con el filtro.'
            : 'Todavía no hay reportes creados.'}
          {esMetrologia(user) && !filtrando && (
            <div className="meta" style={{ marginTop: 6 }}>Crea el primero con “+ Nuevo reporte”.</div>
          )}
        </div>
      )}
    </div>
  );
}
