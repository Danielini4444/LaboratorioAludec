import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../App.jsx';
import { useDebounce } from '../components/useDebounce.js';
import AvisoReportesPendientes from '../components/AvisoReportesPendientes.jsx';
import Cargando from '../components/Cargando.jsx';

export function esQuimico(user) {
  return user.rol === 'admin' || user.rol === 'admin_area' ||
    (user.rol === 'usuario_area' && user.area_nombre === 'Químico');
}

const IconoVacio = () => (
  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="icono">
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5" />
    <path d="M9 13h6" /><path d="M9 17h4" />
  </svg>
);

export default function Registros() {
  const { user } = useAuth();
  const [registros, setRegistros] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [clienteId, setClienteId] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [cargando, setCargando] = useState(true);
  const q = useDebounce(busqueda, 300);

  useEffect(() => {
    let vigente = true;
    setCargando(true);
    api(`/registros?q=${encodeURIComponent(q)}&cliente_id=${clienteId}`)
      .then(rs => { if (vigente) setRegistros(rs); })
      .catch(() => { if (vigente) setRegistros([]); })
      .finally(() => { if (vigente) setCargando(false); });
    return () => { vigente = false; };
  }, [q, clienteId]);

  useEffect(() => { api('/clientes').then(setClientes).catch(() => {}); }, []);

  const filtrando = !!(clienteId || busqueda);

  return (
    <div>
      <div className="encabezado-detalle">
        <div className="encabezado-pagina">
          <h2>Registro de espesores</h2>
          <p className="descripcion">Espesores y STEP por cliente, conforme van saliendo las piezas · formato FM-15-01-03</p>
        </div>
        {esQuimico(user) && <Link className="boton" to="/registros/nuevo">+ Nuevo registro</Link>}
      </div>

      <AvisoReportesPendientes modulo="registro" />

      <div className="barra-busqueda">
        <select value={clienteId} onChange={e => setClienteId(e.target.value)}>
          <option value="">Todos los clientes</option>
          {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>
        <input
          placeholder="Buscar por referencia, denominación, OF o barra…"
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
        />
      </div>

      {cargando ? (
        <Cargando />
      ) : registros.length ? (
        <>
          <p className="conteo">{registros.length} {registros.length === 1 ? 'registro' : 'registros'}{filtrando ? ' con el filtro actual' : ''}</p>
          <table className="tabla lista">
            <thead>
              <tr>
                <th>No.</th><th>Cliente</th><th>Fecha</th><th>Referencia</th><th>Denominación</th>
                <th>OF</th><th>Barra</th><th className="derecha">Piezas</th><th>Resultado</th><th>Realizó</th>
              </tr>
            </thead>
            <tbody>
              {registros.map(r => (
                <tr key={r.id} className={r.anulado ? 'inactivo' : ''}>
                  <td><Link to={`/registros/${r.id}`}>{r.reporte_no}</Link></td>
                  <td>{r.cliente_nombre}</td>
                  <td>{new Date(r.fecha_prueba).toLocaleDateString('es-MX')}</td>
                  <td>{r.referencia}</td>
                  <td>{r.denominacion}</td>
                  <td>{r.of || '—'}</td>
                  <td>{r.barra || '—'}</td>
                  <td className="derecha">{r.num_piezas}</td>
                  <td>
                    {r.resultado
                      ? <span className={`badge ${r.resultado === 'PASS' ? 'ok' : 'mal'}`}>{r.resultado}</span>
                      : '—'}
                    {r.aprobado && <span className="badge ok">aprobado</span>}
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
            ? 'Ningún registro coincide con el filtro.'
            : 'Todavía no hay registros capturados.'}
          {esQuimico(user) && !filtrando && (
            <div className="meta" style={{ marginTop: 6 }}>Captura el primero con “+ Nuevo registro”.</div>
          )}
        </div>
      )}
    </div>
  );
}
