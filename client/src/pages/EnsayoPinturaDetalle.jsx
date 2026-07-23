import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../App.jsx';
import { esMetrologia } from './ReportesEnsayo.jsx';
import { folioPin } from './EnsayosPintura.jsx';
import { textoRangoCapa, fueraDeRangoCapa } from '../especsPintura.js';
import { useConfirmar } from '../components/Confirmar.jsx';
import { useAviso } from '../components/Aviso.jsx';
import Lightbox from '../components/Lightbox.jsx';
import CamaraCaptura from '../components/CamaraCaptura.jsx';
import Cargando from '../components/Cargando.jsx';

const FILA_VACIA = {
  descripcion: '', exigencia: '', resultado: '', caracteristica: '', observaciones: '', conformidad: ''
};

// Combina las capas del spec con los espesores ya guardados de la pieza para
// armar las filas de captura: primero las capas del spec (en orden, con su
// valor guardado si existe), luego cualquier capa guardada que no esté en el
// spec (capas libres, para no perder datos si se cambió/quitó el spec).
function filasDeCapa(capasSpec, guardados) {
  const porNombre = new Map((guardados || []).map(e => [e.capa, e.valor]));
  const filas = (capasSpec || []).map(c => ({
    capa: c.nombre,
    valor: porNombre.has(c.nombre) && porNombre.get(c.nombre) !== null ? String(porNombre.get(c.nombre)) : '',
    fija: true,
  }));
  const nombresSpec = new Set((capasSpec || []).map(c => c.nombre));
  for (const e of guardados || []) {
    if (!nombresSpec.has(e.capa)) {
      filas.push({ capa: e.capa, valor: e.valor === null ? '' : String(e.valor), fija: false });
    }
  }
  if (!filas.length) filas.push({ capa: '', valor: '', fija: false });
  return filas;
}

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
      if (fila) await api(`/ensayos-pintura/filas/${fila.id}`, { method: 'PUT', body: cuerpo });
      else await api(`/ensayos-pintura/${ensayo.id}/filas`, { method: 'POST', body: cuerpo });
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
            placeholder="ej. Adherencia, Espesor, Brillo, Resistencia a la niebla salina" />
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
      await api(`/ensayos-pintura/${ensayo.id}/aprobar`, {
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

// Capa del spec por nombre, para validar el valor capturado contra su rango.
const capaSpecDe = (capasSpec, nombre) => (capasSpec || []).find(c => c.nombre === nombre) || null;

// Tarjeta de una pieza del apartado de espesores: un valor por CAPA (validado
// contra el rango del spec), una imagen y un comentario. Editable con el
// informe abierto. capasSpec: capas de la especificación elegida (o []).
function PiezaEspesores({ pieza, capasSpec, puedeEditar, onBorrar, onAbrir, avisar }) {
  const [filas, setFilas] = useState(() => filasDeCapa(capasSpec, pieza.espesores));
  const [comentario, setComentario] = useState(pieza.comentario || '');
  const [tieneImagen, setTieneImagen] = useState(!!pieza.tiene_imagen);
  const [imgKey, setImgKey] = useState(0);
  const [guardando, setGuardando] = useState(false);
  const [sucio, setSucio] = useState(false);
  const inputImg = useRef(null);
  const [camaraImgAbierta, setCamaraImgAbierta] = useState(false);

  const marcarSucio = () => setSucio(true);
  const setValor = (i, v) => { setFilas(fs => fs.map((f, j) => j === i ? { ...f, valor: v } : f)); marcarSucio(); };
  const setNombreCapa = (i, v) => { setFilas(fs => fs.map((f, j) => j === i ? { ...f, capa: v } : f)); marcarSucio(); };
  const agregarCapaLibre = () => { setFilas(fs => [...fs, { capa: '', valor: '', fija: false }]); marcarSucio(); };
  const quitarFila = (i) => { setFilas(fs => fs.filter((_, j) => j !== i)); marcarSucio(); };

  const guardar = async () => {
    setGuardando(true);
    try {
      await api(`/ensayos-pintura/piezas/${pieza.id}`, {
        method: 'PUT',
        body: { comentario, espesores: filas.map(f => ({ capa: f.capa, valor: f.valor })) }
      });
      setSucio(false);
      avisar('Pieza guardada', 'ok');
    } catch (e) { avisar(e.message); }
    finally { setGuardando(false); }
  };

  const subirImagen = async (e) => {
    const archivo = e.target.files[0];
    e.target.value = '';
    if (!archivo) return;
    const fd = new FormData();
    fd.append('imagen', archivo);
    try {
      await api(`/imagenes/ensayo-pin-pieza/${pieza.id}`, { method: 'POST', body: fd });
      setTieneImagen(true);
      setImgKey(k => k + 1);
    } catch (err) { avisar(err.message); }
  };

  const borrarImagen = async () => {
    try {
      await api(`/imagenes/ensayo-pin-pieza/${pieza.id}/imagen`, { method: 'DELETE' });
      setTieneImagen(false);
    } catch (err) { avisar(err.message); }
  };

  const src = `/api/imagenes/ensayo-pin-pieza/${pieza.id}/archivo?v=${imgKey}`;

  return (
    <div className="tarjeta">
      <div className="ensayo-titulo">
        <strong>Pieza {pieza.numero}</strong>
        {puedeEditar && (
          <span className="acciones">
            <button className="chico" onClick={guardar} disabled={guardando || !sucio}>
              {guardando ? 'Guardando…' : 'Guardar pieza'}
            </button>
            <button className="chico secundario" onClick={() => onBorrar(pieza)}>Borrar pieza</button>
          </span>
        )}
      </div>

      <div style={{ marginTop: 8 }}>
        <span className="meta">Espesores por capa (µm)</span>
        <table className="tabla mediciones" style={{ width: '100%', marginTop: 4 }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left' }}>Capa</th>
              <th style={{ width: 120 }}>Valor (µm)</th>
              <th style={{ width: 120 }}>Rango</th>
              <th style={{ width: 70 }}>Conf.</th>
              {puedeEditar && <th style={{ width: 40 }}></th>}
            </tr>
          </thead>
          <tbody>
            {filas.map((f, i) => {
              const spec = capaSpecDe(capasSpec, f.capa);
              const fuera = fueraDeRangoCapa(spec, f.valor);
              const tieneValor = f.valor !== '' && f.valor !== null && f.valor !== undefined;
              return (
                <tr key={i}>
                  <td style={{ textAlign: 'left' }}>
                    {f.fija
                      ? f.capa
                      : (puedeEditar
                          ? <input value={f.capa} onChange={e => setNombreCapa(i, e.target.value)}
                              placeholder="nombre de capa" style={{ width: '100%', textAlign: 'left' }} />
                          : (f.capa || '—'))}
                  </td>
                  <td>
                    {puedeEditar
                      ? <input type="number" step="any" inputMode="decimal" value={f.valor}
                          className={fuera ? 'fuera' : ''} onChange={e => setValor(i, e.target.value)} />
                      : <span className={fuera ? 'fuera' : ''}>{tieneValor ? f.valor : '—'}</span>}
                  </td>
                  <td>{textoRangoCapa(spec)}</td>
                  <td>
                    {!tieneValor || !spec
                      ? <span className="meta">—</span>
                      : <span className={`badge ${fuera ? 'mal' : 'ok'}`}>{fuera ? 'NOK' : 'OK'}</span>}
                  </td>
                  {puedeEditar && (
                    <td>{!f.fija && <button type="button" className="btn-quitar-fila" title="Quitar capa"
                      onClick={() => quitarFila(i)}>×</button>}</td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
        {puedeEditar && (
          <button type="button" className="boton secundario chico" onClick={agregarCapaLibre} style={{ marginTop: 8 }}>
            + Capa libre
          </button>
        )}
      </div>

      <div style={{ marginTop: 10 }}>
        <span className="meta">Imagen</span>
        <div className="imagenes" style={{ alignItems: 'flex-start', marginTop: 4 }}>
          {tieneImagen ? (
            <span className="miniatura">
              <img src={src} alt={`Pieza ${pieza.numero}`} onClick={() => onAbrir(src)} />
              {puedeEditar && <button type="button" className="quitar" onClick={borrarImagen}>×</button>}
            </span>
          ) : (
            <span className="meta">Sin imagen</span>
          )}
          {puedeEditar && (
            <>
              <button type="button" className="chico secundario" onClick={() => inputImg.current.click()}>
                {tieneImagen ? 'Reemplazar imagen' : '+ Imagen'}
              </button>
              <button type="button" className="chico secundario" onClick={() => setCamaraImgAbierta(true)}>📷 Tomar foto</button>
              <input ref={inputImg} type="file" accept="image/jpeg,image/png" hidden onChange={subirImagen} />
              {camaraImgAbierta && (
                <CamaraCaptura
                  onCaptura={file => subirImagen({ target: { files: [file] } })}
                  onCerrar={() => setCamaraImgAbierta(false)}
                />
              )}
            </>
          )}
        </div>
      </div>

      <div style={{ marginTop: 10 }}>
        <label className="ancho-total">Comentario
          {puedeEditar
            ? <textarea rows="2" value={comentario}
                onChange={e => { setComentario(e.target.value); marcarSucio(); }}
                placeholder="comentario de la pieza" style={{ width: '100%' }} />
            : <div>{comentario || <span className="meta">Sin comentario</span>}</div>}
        </label>
      </div>
    </div>
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
      await api(`/imagenes/ensayo-pin-img/${foto.id}`, { method: 'PUT', body: { descripcion: texto } });
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
      await api(`/imagenes/ensayo-pin/${ensayo.id}`, { method: 'POST', body: fd });
      onCambio();
    } catch (err) { avisar(err.message); }
  };

  const borrar = async (id) => {
    if (!await confirmar({ titulo: 'Borrar foto', mensaje: '¿Borrar esta foto del informe?', textoConfirmar: 'Borrar', peligro: true })) return;
    try {
      await api(`/imagenes/ensayo-pin-img/${id}`, { method: 'DELETE' });
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
                src={`/api/imagenes/ensayo-pin-img/${foto.id}/archivo`}
                alt={foto.descripcion || foto.nombre_original || 'foto'}
                onClick={() => onAbrir(`/api/imagenes/ensayo-pin-img/${foto.id}/archivo`)}
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

export default function EnsayoPinturaDetalle() {
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

  const [especs, setEspecs] = useState([]); // especificaciones de pintura activas del cliente

  const cargar = useCallback(() => {
    api(`/ensayos-pintura/${id}`).then(setEnsayo).catch(e => setError(e.message));
  }, [id]);
  useEffect(() => { cargar(); }, [cargar]);

  useEffect(() => {
    if (!ensayo?.cliente_id) return;
    api(`/especificaciones-pintura?cliente_id=${ensayo.cliente_id}`).then(setEspecs).catch(() => {});
  }, [ensayo?.cliente_id]);

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

  // Elige (o quita) la especificación de espesores de pintura del informe.
  const cambiarEspec = async (espId) => {
    try {
      await api(`/ensayos-pintura/${id}`, {
        method: 'PUT',
        body: { especificacion_pintura_id: espId ? Number(espId) : null }
      });
      cargar();
    } catch (e) { avisar(e.message); }
  };

  const firmar = async () => {
    if (!await confirmar({
      titulo: `Firmar ensayo ${folioPin(ensayo.folio)}`,
      mensaje: `Vas a firmar digitalmente como ${user.nombre}. La firma queda registrada con fecha y hora, y el PDF saldrá con un QR de verificación.`,
      textoConfirmar: 'Firmar'
    })) return;
    try {
      await api(`/ensayos-pintura/${id}/firmar`, { method: 'PUT' });
      avisar('Ensayo firmado', 'ok');
      cargar();
    } catch (e) { avisar(e.message); }
  };

  const anular = async () => {
    if (!motivo.trim()) return avisar('Indica el motivo de la anulación');
    try {
      await api(`/ensayos-pintura/${id}/anular`, { method: 'PUT', body: { motivo: motivo.trim() } });
      setAnulando(false);
      setMotivo('');
      avisar('Ensayo anulado', 'ok');
      cargar();
    } catch (e) { avisar(e.message); }
  };

  // Borrado definitivo: solo admin, aplica aunque esté aprobado o firmado.
  const borrar = async () => {
    if (!await confirmar({
      titulo: `Borrar ensayo ${folioPin(ensayo.folio)}`,
      mensaje: 'El informe se borra DEFINITIVAMENTE con sus ensayos, espesores y fotos, sin dejar traza (a diferencia de Anular). Aplica aunque esté aprobado o firmado. Esta acción no se puede deshacer.',
      textoConfirmar: 'Borrar definitivamente',
      peligro: true
    })) return;
    try {
      await api(`/ensayos-pintura/${id}`, { method: 'DELETE' });
      navigate('/pintura');
    } catch (e) { avisar(e.message); }
  };

  const borrarFila = async (filaId) => {
    if (!await confirmar({ titulo: 'Borrar ensayo', mensaje: '¿Borrar esta fila de ensayo?', textoConfirmar: 'Borrar', peligro: true })) return;
    try {
      await api(`/ensayos-pintura/filas/${filaId}`, { method: 'DELETE' });
      cargar();
    } catch (e) { avisar(e.message); }
  };

  const agregarPieza = async () => {
    try {
      await api(`/ensayos-pintura/${id}/piezas`, { method: 'POST', body: {} });
      cargar();
    } catch (e) { avisar(e.message); }
  };

  const borrarPieza = async (pieza) => {
    if (!await confirmar({ titulo: `Borrar pieza ${pieza.numero}`, mensaje: '¿Borrar esta pieza y sus espesores del informe?', textoConfirmar: 'Borrar', peligro: true })) return;
    try {
      await api(`/ensayos-pintura/piezas/${pieza.id}`, { method: 'DELETE' });
      cargar();
    } catch (e) { avisar(e.message); }
  };

  return (
    <div>
      <div className="encabezado-detalle pegajoso">
        <div>
          <h2>
            {folioPin(ensayo.folio)}
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
          <a className="boton" href={`/api/ensayos-pintura/${ensayo.id}/pdf`} target="_blank" rel="noreferrer">
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
            <h3>Anular ensayo {folioPin(ensayo.folio)}</h3>
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

      <div className="encabezado-detalle" style={{ marginTop: 8 }}>
        <h3>Espesores por pieza</h3>
        {captura && <button className="chico" onClick={agregarPieza}>+ Pieza</button>}
      </div>

      <div className="tarjeta">
        <div className="fila">
          <label>Especificación de espesores (por cliente)
            {captura ? (
              <select value={ensayo.especificacion_pintura_id || ''} onChange={e => cambiarEspec(e.target.value)}>
                <option value="">— sin especificación —</option>
                {especs.map(e => <option key={e.id} value={e.id}>{e.norma}</option>)}
              </select>
            ) : (
              <div className="val">{ensayo.especificacion ? ensayo.especificacion.norma : '—'}</div>
            )}
          </label>
        </div>
        {ensayo.especificacion?.capas?.length ? (
          <div className="meta" style={{ marginTop: 4 }}>
            Capas: {ensayo.especificacion.capas.map(c => `${c.nombre} (${textoRangoCapa(c)})`).join('  ·  ')}
          </div>
        ) : (
          <div className="meta" style={{ marginTop: 4 }}>
            Sin especificación: las capas se capturan libres, sin validación. Se dan de alta en Administración › Pintura.
          </div>
        )}
      </div>

      {!ensayo.piezas.length && (
        <div className="vacio">Todavía no hay piezas. {captura ? 'Agrega una por cada pieza con sus espesores por capa, imagen y comentario.' : ''}</div>
      )}
      {ensayo.piezas.map(p => (
        <PiezaEspesores
          key={`${p.id}-${ensayo.especificacion_pintura_id || 'none'}`}
          pieza={p}
          capasSpec={ensayo.especificacion?.capas || []}
          puedeEditar={captura}
          onBorrar={borrarPieza}
          onAbrir={setFoto}
          avisar={avisar}
        />
      ))}

      <FotosEnsayo
        ensayo={ensayo}
        puedeEditar={captura}
        onCambio={cargar}
        onAbrir={setFoto}
        confirmar={confirmar}
        avisar={avisar}
      />

      <Link to="/pintura">← Volver a ensayos de pintura</Link>

      <Lightbox src={foto} onClose={() => setFoto(null)} />
      {dialogoConfirmar}
      {vistaAviso}
    </div>
  );
}
