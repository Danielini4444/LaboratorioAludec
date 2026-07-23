import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../api.js';
import { rutaReporteConDatos } from '../ensayosCatalogo.js';

// Aviso en Test de cromado: registros de espesores del laboratorio químico ya
// terminados (aprobados por el admin químico) que aún no tienen su reporte de
// cromado para esa OF. Botón para generar el reporte de cromado precargado.
export default function AvisoQuimicoTerminados() {
  const navigate = useNavigate();
  const [pendientes, setPendientes] = useState([]);

  useEffect(() => {
    let vigente = true;
    api('/reportes/pendientes-quimico')
      .then(ps => { if (vigente) setPendientes(ps); })
      .catch(() => { if (vigente) setPendientes([]); });
    return () => { vigente = false; };
  }, []);

  if (!pendientes.length) return null;

  return (
    <div className="avisos-pendientes">
      {pendientes.map(p => (
        <div key={p.id} className="aviso-pendiente" role="status">
          <span>
            🔔 Un reporte pendiente terminado de laboratorio químico
            {' — '}OF: <strong>{p.of}</strong>
            {p.denominacion ? <> · Denominación: <strong>{p.denominacion}</strong></> : null}
            {' — '}
            <Link to={`/registros/${p.id}`}>ver registro No. {p.reporte_no}</Link>
          </span>
          <button className="chico" onClick={() => navigate(rutaReporteConDatos('cromado', {
            of: p.of, cliente_id: p.cliente_id, referencia: p.referencia, denominacion: p.denominacion
          }))}>
            Generar reporte
          </button>
        </div>
      ))}
    </div>
  );
}
