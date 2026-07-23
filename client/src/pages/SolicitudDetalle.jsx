import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../App.jsx';
import { ESTADOS, moduloPorKey, rutaGenerarReporte, ofDeSolicitud } from '../ensayosCatalogo.js';
import { puedeSolicitar } from './SolicitudesEnsayo.jsx';
import { useConfirmar } from '../components/Confirmar.jsx';
import Cargando from '../components/Cargando.jsx';

const fecha = (v) => (v ? new Date(v).toLocaleDateString('es-MX') : '—');

// ¿El usuario pertenece al área que atiende esta solicitud?
function atiendeArea(user, areaNombre) {
  return user.rol === 'admin' ||
    ((user.rol === 'admin_area' || user.rol === 'usuario_area') && user.area_nombre === areaNombre);
}

function Campo({ etiqueta, valor }) {
  return (
    <div className="campo">
      <span className="etq">{etiqueta}</span>
      <span className="val">{valor || '—'}</span>
    </div>
  );
}

export default function SolicitudDetalle() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [solicitud, setSolicitud] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [cancelando, setCancelando] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [trabajando, setTrabajando] = useState(false);
  const [confirmar, dialogoConfirmar] = useConfirmar();

  const recargar = () => api(`/solicitudes-ensayo/${id}`).then(setSolicitud).catch(() => setSolicitud(null));

  useEffect(() => {
    setCargando(true);
    api(`/solicitudes-ensayo/${id}`).then(setSolicitud).catch(() => setSolicitud(null)).finally(() => setCargando(false));
  }, [id]);

  const cambiarEstado = async (estado) => {
    setError('');
    setTrabajando(true);
    try {
      setSolicitud(await api(`/solicitudes-ensayo/${id}/estado`, { method: 'PUT', body: { estado } }));
    } catch (e) { setError(e.message); }
    finally { setTrabajando(false); }
  };

  const cancelar = async () => {
    setError('');
    setTrabajando(true);
    try {
      setSolicitud(await api(`/solicitudes-ensayo/${id}/cancelar`, { method: 'PUT', body: { motivo } }));
      setCancelando(false);
      setMotivo('');
    } catch (e) { setError(e.message); }
    finally { setTrabajando(false); }
  };

  // Borrado definitivo (sin traza, a diferencia de Cancelar): admin o admin del área.
  const borrar = async () => {
    if (!await confirmar({
      titulo: `Borrar solicitud ${solicitud.tipo}-${solicitud.folio}`,
      mensaje: 'La solicitud se borra DEFINITIVAMENTE con sus líneas de ensayo, sin dejar traza (a diferencia de Cancelar). Esta acción no se puede deshacer.',
      textoConfirmar: 'Borrar definitivamente',
      peligro: true
    })) return;
    try {
      await api(`/solicitudes-ensayo/${id}`, { method: 'DELETE' });
      navigate('/solicitudes');
    } catch (e) { setError(e.message); }
  };

  if (cargando) return <Cargando />;
  if (!solicitud) return <div className="vacio-bloque">Solicitud no encontrada. <Link to="/solicitudes">Volver</Link></div>;

  const s = solicitud;
  const esMP = s.tipo === 'SEMP';
  const abierta = s.estado === 'pendiente' || s.estado === 'en_proceso';
  const puedeAtender = atiendeArea(user, s.area_nombre) && abierta;
  const puedeCancelar = puedeSolicitar(user) && abierta;
  // Borrado definitivo: admin global o admin del área que atiende (cualquier estado).
  const puedeBorrar = user.rol === 'admin' ||
    (user.rol === 'admin_area' && user.area_nombre === s.area_nombre);
  const modulo = moduloPorKey(s.modulo);
  // Reporte pendiente: la solicitud ya fue tomada (en proceso) y la atiende su área.
  const puedeGenerarReporte = s.estado === 'en_proceso' && modulo && atiendeArea(user, s.area_nombre);

  return (
    <div>
      <div className="encabezado-detalle">
        <div>
          <h2 style={{ marginBottom: 4 }}>
            {s.tipo}-{s.folio}
            <span className={`badge ${ESTADOS[s.estado].badge}`}>{ESTADOS[s.estado].texto}</span>
          </h2>
          <div className="subtitulo">
            {esMP ? 'Solicitud de ensayos de materia prima · FM-15-01A' : 'Solicitud de ensayos de producto · FM-15-01'}
            {' · '}Módulo: {modulo ? modulo.etiqueta : '—'}
            {' · '}Atiende: {s.area_nombre}
          </div>
        </div>
        <div className="acciones">
          {puedeAtender && s.estado === 'pendiente' && (
            <button disabled={trabajando} onClick={() => cambiarEstado('en_proceso')}>Tomar solicitud</button>
          )}
          {puedeGenerarReporte && (
            <button onClick={() => navigate(rutaGenerarReporte(s))}>Generar reporte</button>
          )}
          {puedeAtender && (
            <button disabled={trabajando} onClick={() => cambiarEstado('completada')}>Marcar completada</button>
          )}
          {puedeCancelar && !cancelando && (
            <button className="secundario peligro" onClick={() => setCancelando(true)}>Cancelar</button>
          )}
          {puedeBorrar && (
            <button className="secundario peligro" onClick={borrar}>Borrar</button>
          )}
          <Link to="/solicitudes" className="boton secundario">Volver</Link>
        </div>
      </div>

      {error && <div className="error">{error}</div>}

      {puedeGenerarReporte && (
        <div className="aviso-pendiente" role="status">
          <span>🔔 Tienes un reporte pendiente de esta OF{ofDeSolicitud(s) ? ` (${ofDeSolicitud(s)})` : ''}.</span>
          <button className="chico" onClick={() => navigate(rutaGenerarReporte(s))}>Generar reporte</button>
        </div>
      )}

      {cancelando && (
        <div className="tarjeta">
          <h4>Cancelar solicitud</h4>
          <p className="meta">Queda registrada con traza; no se borra.</p>
          <div className="fila" style={{ marginTop: 8 }}>
            <label className="ancho-total">Motivo de la cancelación
              <input value={motivo} onChange={e => setMotivo(e.target.value)} autoFocus placeholder="ej. duplicada, material caduco, ya no se requiere…" />
            </label>
          </div>
          <div className="acciones">
            <button className="peligro" disabled={trabajando || !motivo.trim()} onClick={cancelar}>Confirmar cancelación</button>
            <button className="secundario" onClick={() => { setCancelando(false); setMotivo(''); }}>Volver</button>
          </div>
        </div>
      )}

      <div className="tarjeta">
        <h3>{esMP ? 'Materia prima' : 'Identificación de la pieza'}</h3>
        <div className="datos-grid">
          <Campo etiqueta="Cliente" valor={s.cliente_nombre} />
          <Campo etiqueta="Referencia" valor={s.referencia} />
          <Campo etiqueta="Denominación" valor={s.denominacion} />
          {esMP ? (
            <>
              <Campo etiqueta="Proveedor" valor={s.proveedor} />
              <Campo etiqueta="N° de etiqueta" valor={s.numero_etiqueta} />
              <Campo etiqueta="Color del material" valor={s.color_material} />
              <Campo etiqueta="Fecha de caducidad" valor={fecha(s.fecha_caducidad)} />
            </>
          ) : (
            <>
              <Campo etiqueta="OF Cromado" valor={s.of_cromado} />
              <Campo etiqueta="OF Inyección" valor={s.of_inyeccion} />
              <Campo etiqueta="OF Ensamble" valor={s.of_ensamble} />
              <Campo etiqueta="OF Pintura" valor={s.of_pintura} />
            </>
          )}
        </div>
      </div>

      <div className="tarjeta">
        <h3>Ensayos solicitados</h3>
        <table className="tabla mediciones" style={{ width: '100%' }}>
          <thead>
            <tr>
              <th style={{ width: '38%' }}>Tipo de ensayo</th>
              <th className="derecha" style={{ width: 120 }}>N° muestras</th>
              <th>Observaciones</th>
            </tr>
          </thead>
          <tbody>
            {s.lineas.map(l => (
              <tr key={l.id}>
                <td style={{ textAlign: 'left' }}>{l.ensayo}</td>
                <td className="derecha">{l.num_muestras ?? '—'}</td>
                <td style={{ textAlign: 'left' }}>{l.observaciones || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {s.notas && (
        <div className="tarjeta">
          <h4>Observaciones generales</h4>
          <p>{s.notas}</p>
        </div>
      )}

      <div className="tarjeta">
        <div className="datos-grid">
          <Campo etiqueta="Solicitada por" valor={s.solicitada_por_nombre} />
          <Campo etiqueta="Fecha de solicitud" valor={fecha(s.creada_en)} />
          <Campo etiqueta="Atendida por" valor={s.atendida_por_nombre} />
          <Campo etiqueta="Fecha de atención" valor={fecha(s.atendida_en)} />
          {s.estado === 'completada' && <Campo etiqueta="Completada" valor={fecha(s.cerrada_en)} />}
          {s.estado === 'cancelada' && <Campo etiqueta="Motivo de cancelación" valor={s.motivo_cancelacion} />}
        </div>
      </div>

      {dialogoConfirmar}
    </div>
  );
}
