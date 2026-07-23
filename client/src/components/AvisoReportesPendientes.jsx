import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../api.js';
import { rutaReporteConDatos } from '../ensayosCatalogo.js';

// Aviso "Tienes un reporte pendiente de esta OF": lista las solicitudes ya
// tomadas (en proceso) dirigidas a este módulo, con botón para generar el
// reporte precargado con los datos de la solicitud. Se muestra arriba de la
// lista del módulo. `modulo` es la key del catálogo (registro/cromado/…).
export default function AvisoReportesPendientes({ modulo }) {
  const navigate = useNavigate();
  const [pendientes, setPendientes] = useState([]);

  useEffect(() => {
    let vigente = true;
    api(`/solicitudes-ensayo/pendientes?modulo=${modulo}`)
      .then(ps => { if (vigente) setPendientes(ps); })
      .catch(() => { if (vigente) setPendientes([]); });
    return () => { vigente = false; };
  }, [modulo]);

  if (!pendientes.length) return null;

  return (
    <div className="avisos-pendientes">
      {pendientes.map(p => (
        <div key={p.id} className="aviso-pendiente" role="status">
          <span>
            🔔 Tienes un reporte pendiente de esta OF{p.of ? ` (${p.of})` : ''}
            {' — '}
            <Link to={`/solicitudes/${p.id}`}>{p.tipo}-{p.folio}</Link>
            {p.referencia ? ` · Ref. ${p.referencia}` : ''}
            {p.cliente_nombre ? ` · ${p.cliente_nombre}` : ''}
          </span>
          <button className="chico" onClick={() => navigate(rutaReporteConDatos(modulo, p))}>
            Generar reporte
          </button>
        </div>
      ))}
    </div>
  );
}
