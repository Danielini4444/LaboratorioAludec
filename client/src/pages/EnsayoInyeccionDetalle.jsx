import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../App.jsx';
import { esMetrologia } from './ReportesEnsayo.jsx';
import { folioIny } from './EnsayosInyeccion.jsx';
import { useConfirmar } from '../components/Confirmar.jsx';
import { useAviso } from '../components/Aviso.jsx';
import Lightbox from '../components/Lightbox.jsx';
import CamaraCaptura from '../components/CamaraCaptura.jsx';
import Cargando from '../components/Cargando.jsx';

const FILA_VACIA = {
  descripcion: '', exigencia: '', resultado: '', caracteristica: '', observaciones: '', conformidad: ''
};

function FormFila({ ensayo, fila, onGuardada, onCancelar }) {
  const [form, setForm] = useState(() => fila ? {
    descripcion: fila.descripcion || '',
    exigencia: fila.exigencia || '',
    resultado: fila.resultado || '',
    caracteristica: fila.caracteristica || '',
    observaciones: fila.observaciones || '',
    conformidad: fila.conformidad || ''
  } : { ...FILA_VACIA });
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  const set = (campo) => (e) => setForm({ ...form, [campo]: e.target.value });

  const enviar = async (e) => {
    e.preventDefault();
    setError('');
    setGuardando(true);
    try {
      const cuerpo = { ...form, conformidad: form.conformidad || null };
      if (fila) await api(`/ensayos-inyeccion/filas/${fila.id}`, { method: 'PUT', body: cuerpo });
      else await api(`/ensayos-inyeccion/${ensayo.id}/filas`, { method: 'POST', body: cuerpo });
      onGuardada();
    } catch (e) {
      setError(e.message);
      setGuardando(false);
    }
  };

  return (
    <form className="tarjeta formulario" onSubmit={enviar}>
      <h3>{fila ? `Completar ensayo ${fila.numero}` : 'Agregar ensayo'}</h3>

      <div className="fila">
        <label className="ancho-total">Ensayo-Descripción
          <input value={form.descripcion} onChange={set('descripcion')} required
            placeholder="ej. Dimensional, Apariencia, Ensayo de tracción" />
        </label>
      </div>
      <div className="fila">
        <label>Exigencia
          <input value={form.exigencia} onChange={set('exigencia')} placeholder="lo que pide la especificación" />
        </label>
        <label>Resultado
          <input value={form.resultado} onChange={set('resultado')} placeholder="lo obtenido en el ensayo" />
        </label>
      </div>
      <div className="fila">
        <label>Característica
          <input value={form.caracteristica} onChange={set('caracteristica')} />
        </label>
        <label>Observaciones
          <input value={form.observaciones} onChange={set('observaciones')} />
        </label>
        <label>Conformidad
          <select value={form.conformidad} onChange={set('conformidad')}>
            <option value="">— sin dictamen —</option>
            <option value="OK">OK</option>
            <option value="NOK">NOK</option>
          </select>
        </label>
      </div>

      {error && <div className="error">{error}</div>}
      <div className="acciones">
        <button type="submit" disabled={guardando}>{guardando ? 'Guardando…' : fila ? 'Guardar cambios' : 'Guardar ensayo'}</button>
        <button type="button" className="secundario" onClick={onCancelar}>Cancelar</button>
      </div>
    </form>
  );
}

const VALORACION_SUGERIDA =
  'Las piezas se encuentran acorde a las especificaciones requeridas por cliente por lo que la conformidad de estas es "Aceptado".';

function FormAprobar({ ensayo, onAprobado, onCancelar }) {
  const [valoracion, setValoracion] = useState(ensayo.valoracion_final || VALORACION_SUGERIDA);
  const [error, setError] = useState('');

  const enviar = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api(`/ensayos-inyeccion/${ensayo.id}/aprobar`, {
        method: 'PUT',
        body: { valoracion_final: valoracion }
      });
      onAprobado();
    } catch (e) { setError(e.message); }
  };

  return (
    <form className="tarjeta formulario" onSubmit={enviar}>
      <h3>Aprobar y emitir</h3>
      <label>Valoración final
        <textarea rows="3" value={valoracion} onChange={e => setValoracion(e.target.value)} required />
      </label>
      {ensayo.filas.some(f => f.conformidad === 'NOK') && (
        <div className="error">Hay ensayos con conformidad NOK — revisa la valoración final antes de emitir.</div>
      )}
      {error && <div className="error">{error}</div>}
      <div className="acciones">
        <button type="submit">Aprobar ensayo</button>
        <button type="button" className="secundario" onClick={onCancelar}>Cancelar</button>
      </div>
    </form>
  );
}

// Descripción de una foto: se edita inline y se guarda al salir del campo.
function DescripcionFoto({ foto, puedeEditar, avisar }) {
  const [texto, setTexto] = useState(foto.descripcion || '');
  useEffect(() => { setTexto(foto.descripcion || ''); }, [foto.descripcion]);

  if (!puedeEditar) {
    return <span className="meta" style={{ display: 'block', maxWidth: 150 }}>{foto.descripcion || 'Sin descripción'}</span>;
  }
  const guardar = async () => {
    if ((texto.trim() || '') === (foto.descripcion || '')) return;
    try {
      await api(`/imagenes/ensayo-iny-img/${foto.id}`, { method: 'PUT', body: { descripcion: texto } });
      foto.descripcion = texto.trim() || null;
    } catch (e) { avisar(e.message); }
  };
  return (
    <input value={texto} onChange={e => setTexto(e.target.value)} onBlur={guardar}
      placeholder="descripción de la foto" style={{ width: 150, fontSize: '0.85em' }} />
  );
}

// Apartado general de fotos del informe: cada foto con su descripción.
function FotosEnsayo({ ensayo, puedeEditar, onCambio, onAbrir, confirmar, avisar }) {
  const inputRef = useRef(null);
  const [camaraAbierta, setCamaraAbierta] = useState(false);

  const agregar = async (e) => {
    const archivos = [...e.target.files];
    e.target.value = '';
    if (!archivos.length) return;
    const fd = new FormData();
    for (const a of archivos) fd.append('imagenes', a);
    try {
      await api(`/imagenes/ensayo-iny/${ensayo.id}`, { method: 'POST', body: fd });
      onCambio();
    } catch (err) { avisar(err.message); }
  };

  const borrar = async (id) => {
    if (!await confirmar({ titulo: 'Borrar foto', mensaje: '¿Borrar esta foto del informe?', textoConfirmar: 'Borrar', peligro: true })) return;
    try {
      await api(`/imagenes/ensayo-iny-img/${id}`, { method: 'DELETE' });
      onCambio();
    } catch (err) { avisar(err.message); }
  };

  return (
    <div className="tarjeta">
      <h3>Fotos</h3>
      {!ensayo.fotos.length && (
        <div className="vacio">Todavía no hay fotos. {puedeEditar ? 'Sube las que necesites; cada una lleva su descripción.' : ''}</div>
      )}
      <div className="imagenes" style={{ alignItems: 'flex-start' }}>
        {ensayo.fotos.map(foto => (
          <span key={foto.id} style={{ display: 'inline-flex', flexDirection: 'column', gap: 4 }}>
            <span className="miniatura">
              <img
                src={`/api/imagenes/ensayo-iny-img/${foto.id}/archivo`}
                alt={foto.descripcion || foto.nombre_original || 'foto'}
                onClick={() => onAbrir(`/api/imagenes/ensayo-iny-img/${foto.id}/archivo`)}
              />
              {puedeEditar && <button type="button" className="quitar" onClick={() => borrar(foto.id)}>×</button>}
            </span>
            <DescripcionFoto foto={foto} puedeEditar={puedeEditar} avisar={avisar} />
          </span>
        ))}
        {puedeEditar && (
          <>
            <button type="button" className="chico secundario" onClick={() => inputRef.current.click()}>+ Foto</button>
            <button type="button" className="chico secundario" onClick={() => setCamaraAbierta(true)}>📷 Tomar foto</button>
            <input ref={inputRef} type="file" accept="image/jpeg,image/png" multiple hidden onChange={agregar} />
            {camaraAbierta && (
              <CamaraCaptura
                onCaptura={file => agregar({ target: { files: [file] } })}
                onCerrar={() => setCamaraAbierta(false)}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function EnsayoInyeccionDetalle() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [ensayo, setEnsayo] = useState(null);
  const [agregando, setAgregando] = useState(false);
  const [editando, setEditando] = useState(null); // fila en edición
  const [aprobando, setAprobando] = useState(false);
  const [error, setError] = useState('');
  const [foto, setFoto] = useState(null);
  const [anulando, setAnulando] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [confirmar, dialogoConfirmar] = useConfirmar();
  const [avisar, vistaAviso] = useAviso();

  const cargar = useCallback(() => {
    api(`/ensayos-inyeccion/${id}`).then(setEnsayo).catch(e => setError(e.message));
  }, [id]);
  useEffect(() => { cargar(); }, [cargar]);

  if (error) return <div className="error">{error}</div>;
  if (!ensayo) return <Cargando />;

  const aprobado = !!ensayo.aprobado_por;
  const anulado = !!ensayo.anulado_por;
  const captura = !aprobado && !anulado && esMetrologia(user);
  const puedeAprobar = !aprobado && !anulado && ensayo.filas.length > 0 &&
    (user.rol === 'admin' || user.rol === 'admin_area');
  const puedeFirmar = aprobado && !anulado && !ensayo.firmado_por &&
    (user.rol === 'admin' || user.rol === 'admin_area');
  // Anular y Borrar: admin global o cualquier admin de área.
  const puedeGestionar = user.rol === 'admin' || user.rol === 'admin_area';

  const firmar = async () => {
    if (!await confirmar({
      titulo: `Firmar ensayo ${folioIny(ensayo.folio)}`,
      mensaje: `Vas a firmar digitalmente como ${user.nombre}. La firma queda registrada con fecha y hora, y el PDF saldrá con un QR de verificación.`,
      textoConfirmar: 'Firmar'
    })) return;
    try {
      await api(`/ensayos-inyeccion/${id}/firmar`, { method: 'PUT' });
      avisar('Ensayo firmado', 'ok');
      cargar();
    } catch (e) { avisar(e.message); }
  };

  const anular = async () => {
    if (!motivo.trim()) return avisar('Indica el motivo de la anulación');
    try {
      await api(`/ensayos-inyeccion/${id}/anular`, { method: 'PUT', body: { motivo: motivo.trim() } });
      setAnulando(false);
      setMotivo('');
      avisar('Ensayo anulado', 'ok');
      cargar();
    } catch (e) { avisar(e.message); }
  };

  // Borrado definitivo: solo admin, aplica aunque esté aprobado o firmado.
  const borrar = async () => {
    if (!await confirmar({
      titulo: `Borrar ensayo ${folioIny(ensayo.folio)}`,
      mensaje: 'El informe se borra DEFINITIVAMENTE con sus ensayos y fotos, sin dejar traza (a diferencia de Anular). Aplica aunque esté aprobado o firmado. Esta acción no se puede deshacer.',
      textoConfirmar: 'Borrar definitivamente',
      peligro: true
    })) return;
    try {
      await api(`/ensayos-inyeccion/${id}`, { method: 'DELETE' });
      navigate('/inyeccion');
    } catch (e) { avisar(e.message); }
  };

  const borrarFila = async (filaId) => {
    if (!await confirmar({ titulo: 'Borrar ensayo', mensaje: '¿Borrar esta fila de ensayo?', textoConfirmar: 'Borrar', peligro: true })) return;
    try {
      await api(`/ensayos-inyeccion/filas/${filaId}`, { method: 'DELETE' });
      cargar();
    } catch (e) { avisar(e.message); }
  };

  return (
    <div>
      <div className="encabezado-detalle pegajoso">
        <div>
          <h2>
            {folioIny(ensayo.folio)}
            {aprobado
              ? <span className="badge ok">Emitido</span>
              : <span className="badge pendiente">En proceso</span>}
            {ensayo.firmado_por && <span className="badge ok">Firmado</span>}
            {anulado && <span className="badge mal">ANULADO</span>}
          </h2>
          <div className="subtitulo">
            {ensayo.cliente_nombre} · {ensayo.denominacion} · Ref. {ensayo.referencia}
          </div>
        </div>
        <div className="acciones">
          <a className="boton" href={`/api/ensayos-inyeccion/${ensayo.id}/pdf`} target="_blank" rel="noreferrer">
            {aprobado ? 'PDF' : 'PDF (borrador)'}
          </a>
          {captura && !agregando && <button onClick={() => { setAgregando(true); setEditando(null); }}>Agregar ensayo</button>}
          {puedeAprobar && !aprobando && <button onClick={() => setAprobando(true)}>Aprobar y emitir</button>}
          {puedeFirmar && <button onClick={firmar}>Firmar</button>}
          {puedeGestionar && !anulado && (
            <button className="secundario peligro" onClick={() => setAnulando(true)}>Anular</button>
          )}
          {puedeGestionar && (
            <button className="secundario peligro" onClick={borrar}>Borrar</button>
          )}
        </div>
      </div>

      {ensayo.firmado_por && (
        <div className="meta">
          Firmado digitalmente por <strong>{ensayo.firmado_por_nombre}</strong>
          {ensayo.firmado_en && ` el ${new Date(ensayo.firmado_en).toLocaleString('es-MX')}`}
          {' '}· el PDF incluye el QR de verificación.
        </div>
      )}

      {anulado && (
        <div className="error">
          <strong>Ensayo anulado</strong> por {ensayo.anulado_por_nombre}
          {ensayo.anulado_en && ` el ${new Date(ensayo.anulado_en).toLocaleString('es-MX')}`}.
          {' '}Motivo: {ensayo.motivo_anulacion}
        </div>
      )}

      {anulando && (
        <div className="modal-fondo" onClick={() => setAnulando(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>Anular ensayo {folioIny(ensayo.folio)}</h3>
            <p>El informe no se borra: queda visible y marcado como ANULADO, con tu nombre y la fecha. Indica el motivo (queda en la traza).</p>
            <textarea rows="3" value={motivo} onChange={e => setMotivo(e.target.value)}
              placeholder="Motivo de la anulación" style={{ width: '100%' }} autoFocus />
            <div className="acciones" style={{ justifyContent: 'flex-end', marginTop: 12 }}>
              <button type="button" className="secundario" onClick={() => setAnulando(false)}>Cancelar</button>
              <button type="button" className="peligro" onClick={anular}>Anular</button>
            </div>
          </div>
        </div>
      )}

      <div className="tarjeta">
        <div className="datos-grid">
          <div className="campo"><span className="etq">OF / Lote</span><span className="val">{ensayo.ofs?.length ? ensayo.ofs.join(', ') : '—'}</span></div>
          <div className="campo"><span className="etq">Solicitante</span><span className="val">{ensayo.solicitante || '—'}</span></div>
          <div className="campo"><span className="etq">Emisión</span><span className="val">{ensayo.fecha_emision ? new Date(ensayo.fecha_emision).toLocaleDateString('es-MX') : '—'}</span></div>
          {ensayo.informacion_previa && <div className="campo ancho-total"><span className="etq">Información previa</span><span className="val">{ensayo.informacion_previa}</span></div>}
          {ensayo.valoracion_final && <div className="campo ancho-total"><span className="etq">Valoración final</span><span className="val">{ensayo.valoracion_final}</span></div>}
          <div className="campo ancho-total"><span className="etq">Analista</span><span className="val">
            {ensayo.realizado_por_nombre}
            {aprobado && <> · Aprobó: {ensayo.aprobado_por_nombre} ({new Date(ensayo.aprobado_en).toLocaleDateString('es-MX')})</>}
          </span></div>
        </div>
      </div>

      {agregando && (
        <FormFila
          ensayo={ensayo}
          onGuardada={() => { setAgregando(false); cargar(); }}
          onCancelar={() => setAgregando(false)}
        />
      )}

      {editando && (
        <FormFila
          ensayo={ensayo}
          fila={editando}
          onGuardada={() => { setEditando(null); cargar(); }}
          onCancelar={() => setEditando(null)}
        />
      )}

      {aprobando && (
        <FormAprobar
          ensayo={ensayo}
          onAprobado={() => { setAprobando(false); cargar(); }}
          onCancelar={() => setAprobando(false)}
        />
      )}

      <h3>Ensayos realizados</h3>
      {!ensayo.filas.length && <div className="vacio">Todavía no hay ensayos. Se agregan conforme se van terminando.</div>}
      {ensayo.filas.map(f => (
        <div className="tarjeta" key={f.id}>
          <div className="ensayo-titulo">
            <strong>Ensayo {f.numero}: {f.descripcion}</strong>
            {f.conformidad
              ? <span className={`badge ${f.conformidad === 'OK' ? 'ok' : 'mal'}`}>{f.conformidad}</span>
              : <span className="badge pendiente">pendiente</span>}
            <span className="acciones">
              {captura && <button className="chico" onClick={() => { setEditando(f); setAgregando(false); }}>Completar</button>}
              {captura && <button className="chico secundario" onClick={() => borrarFila(f.id)}>Borrar</button>}
            </span>
          </div>
          <div className="meta">Realizó: {f.realizado_por_nombre}</div>
          {f.exigencia && <div><span className="meta">Exigencia:</span> {f.exigencia}</div>}
          {f.resultado && <div><span className="meta">Resultado:</span> {f.resultado}</div>}
          {f.caracteristica && <div><span className="meta">Característica:</span> {f.caracteristica}</div>}
          {f.observaciones && <div><span className="meta">Observaciones:</span> {f.observaciones}</div>}
        </div>
      ))}

      <FotosEnsayo
        ensayo={ensayo}
        puedeEditar={captura}
        onCambio={cargar}
        onAbrir={setFoto}
        confirmar={confirmar}
        avisar={avisar}
      />

      <Link to="/inyeccion">← Volver a ensayos de inyección</Link>

      <Lightbox src={foto} onClose={() => setFoto(null)} />
      {dialogoConfirmar}
      {vistaAviso}
    </div>
  );
}
