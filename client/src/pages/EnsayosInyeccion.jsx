import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../App.jsx';
import { esMetrologia } from './ReportesEnsayo.jsx';
import { useDebounce } from '../components/useDebounce.js';
import AvisoReportesPendientes from '../components/AvisoReportesPendientes.jsx';
import Cargando from '../components/Cargando.jsx';

// Folio para mostrar: Iny_0001.
export const folioIny = (folio) => `Iny_${String(folio).padStart(4, '0')}`;

const IconoVacio = () => (
  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="icono">
    <path d="M12 2v4" /><path d="M8 4h8" />
    <path d="M7 6h10l1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2z" />
    <path d="M7.5 13h9" />
  </svg>
);

export default function EnsayosInyeccion() {
  const { user } = useAuth();
  const [ensayos, setEnsayos] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [clienteId, setClienteId] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [cargando, setCargando] = useState(true);
  const q = useDebounce(busqueda, 300);

  useEffect(() => {
    let vigente = true;
    setCargando(true);
    api(`/ensayos-inyeccion?q=${encodeURIComponent(q)}&cliente_id=${clienteId}`)
      .then(es => { if (vigente) setEnsayos(es); })
      .catch(() => { if (vigente) setEnsayos([]); })
      .finally(() => { if (vigente) setCargando(false); });
    return () => { vigente = false; };
  }, [q, clienteId]);

  useEffect(() => { api('/clientes').then(setClientes).catch(() => {}); }, []);

  const filtrando = !!(clienteId || busqueda);

  return (
    <div>
      <div className="encabezado-detalle">
        <div className="encabezado-pagina">
          <h2>Ensayos inyección</h2>
          <p className="descripcion">Informes de ensayos de piezas inyectadas con No. de ensayo único (Iny_####)</p>
        </div>
        {esMetrologia(user) && <Link className="boton" to="/inyeccion/nuevo">+ Nuevo ensayo</Link>}
      </div>

      <AvisoReportesPendientes modulo="inyeccion" />

      <div className="barra-busqueda">
        <select value={clienteId} onChange={e => setClienteId(e.target.value)}>
          <option value="">Todos los clientes</option>
          {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>
        <input
          placeholder="Buscar por No. de ensayo, referencia, denominación u OF/lote…"
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
        />
      </div>

      {cargando ? (
        <Cargando />
      ) : ensayos.length ? (
        <>
          <p className="conteo">{ensayos.length} {ensayos.length === 1 ? 'ensayo' : 'ensayos'}{filtrando ? ' con el filtro actual' : ''}</p>
          <table className="tabla lista">
            <thead>
              <tr>
                <th>No. ensayo</th><th>Cliente</th><th>Referencia</th><th>Denominación</th>
                <th>OF/Lote</th><th className="derecha">Ensayos</th><th>Estado</th><th>Analista</th>
              </tr>
            </thead>
            <tbody>
              {ensayos.map(e => (
                <tr key={e.id} className={e.anulado ? 'inactivo' : ''}>
                  <td><Link to={`/inyeccion/${e.id}`}>{folioIny(e.folio)}</Link></td>
                  <td>{e.cliente_nombre}</td>
                  <td>{e.referencia}</td>
                  <td>{e.denominacion}</td>
                  <td>{e.ofs?.length ? e.ofs.join(', ') : '—'}</td>
                  <td className="derecha">{e.num_filas}</td>
                  <td>
                    {e.aprobado
                      ? <span className="badge ok">Emitido</span>
                      : <span className="badge pendiente">En proceso</span>}
                    {e.num_nok > 0 && <span className="badge mal">{e.num_nok} NOK</span>}
                    {e.anulado && <span className="badge mal">ANULADO</span>}
                  </td>
                  <td>{e.realizado_por_nombre}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : (
        <div className="vacio-bloque">
          <IconoVacio />
          {filtrando
            ? 'Ningún ensayo coincide con el filtro.'
            : 'Todavía no hay ensayos de inyección creados.'}
          {esMetrologia(user) && !filtrando && (
            <div className="meta" style={{ marginTop: 6 }}>Crea el primero con “+ Nuevo ensayo”.</div>
          )}
        </div>
      )}
    </div>
  );
}
