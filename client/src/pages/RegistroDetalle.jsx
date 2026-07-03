import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../App.jsx';
import { textoLimite, fueraDeLimite, niTotalBase } from '../especs.js';
import { esQuimico } from './Registros.jsx';
import { useConfirmar } from '../components/Confirmar.jsx';
import { useAviso } from '../components/Aviso.jsx';
import Lightbox from '../components/Lightbox.jsx';
import Cargando from '../components/Cargando.jsx';

function Valor({ limites, clave, valor, unidad = '', base = null }) {
  if (valor === null || valor === undefined) return <td>—</td>;
  const fuera = fueraDeLimite(limites, clave, valor, base);
  return <td className={fuera ? 'valor-fuera' : ''}>{valor}{unidad && ` ${unidad}`}{fuera && ' *'}</td>;
}

// Fotos de una sección del registro: muestra (general), step o poros (por pieza).
function FotosSeccion({ registroId, piezaId, seccion, titulo, imagenes, puedeEditar, onCambio, onAbrir, confirmar, avisar }) {
  const inputRef = useRef(null);

  const agregar = async (e) => {
    const archivos = [...e.target.files];
    e.target.value = '';
    if (!archivos.length) return;
    const form = new FormData();
    form.append('seccion', seccion);
    if (piezaId) form.append('pieza_id', piezaId);
    for (const a of archivos) form.append('imagenes', a);
    try {
      await api(`/imagenes/registro/${registroId}`, { method: 'POST', body: form });
      onCambio();
    } catch (err) { avisar(err.message); }
  };

  const borrar = async (id) => {
    if (!await confirmar({ titulo: 'Borrar foto', mensaje: '¿Borrar esta foto?', textoConfirmar: 'Borrar', peligro: true })) return;
    try {
      await api(`/imagenes/${id}`, { method: 'DELETE' });
      onCambio();
    } catch (err) { avisar(err.message); }
  };

  if (!imagenes.length && !puedeEditar) return null;
  return (
    <div>
      <span className="meta">{titulo}:</span>
      <div className="imagenes">
        {imagenes.map(img => (
          <span className="miniatura" key={img.id}>
            <img
              src={`/api/imagenes/${img.id}/archivo`}
              alt={img.nombre || titulo}
              onClick={() => onAbrir(`/api/imagenes/${img.id}/archivo`)}
            />
            {puedeEditar && <button type="button" className="quitar" onClick={() => borrar(img.id)}>×</button>}
          </span>
        ))}
        {puedeEditar && (
          <>
            <button type="button" className="chico secundario" onClick={() => inputRef.current.click()}>+ Foto</button>
            <input ref={inputRef} type="file" accept="image/jpeg,image/png" multiple hidden onChange={agregar} />
          </>
        )}
      </div>
    </div>
  );
}

export default function RegistroDetalle() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [registro, setRegistro] = useState(null);
  const [error, setError] = useState('');
  const [foto, setFoto] = useState(null);
  const [anulando, setAnulando] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [confirmar, dialogoConfirmar] = useConfirmar();
  const [avisar, vistaAviso] = useAviso();

  const cargar = useCallback(() => {
    api(`/registros/${id}`).then(setRegistro).catch(e => setError(e.message));
  }, [id]);
  useEffect(() => { cargar(); }, [cargar]);

  if (error) return <div className="error">{error}</div>;
  if (!registro) return <Cargando />;

  const limites = registro.espec ? registro.espec.limites : null;
  const capturador = esQuimico(user);
  const fotosDe = (piezaId, seccion) =>
    registro.imagenes.filter(img => img.pieza_id === piezaId && img.seccion === seccion);
  const fotosMuestra = registro.imagenes.filter(img => !img.pieza_id);
  const puedeAprobar = !registro.aprobado_por && !registro.anulado_por &&
    (user.rol === 'admin' || (user.rol === 'admin_area' && user.area_nombre === 'Químico'));

  const aprobar = async () => {
    try {
      await api(`/registros/${id}/aprobar`, { method: 'PUT' });
      avisar('Registro aprobado', 'ok');
      cargar();
    } catch (e) { avisar(e.message); }
  };

  const anular = async () => {
    if (!motivo.trim()) return avisar('Indica el motivo de la anulación');
    try {
      await api(`/registros/${id}/anular`, { method: 'PUT', body: { motivo: motivo.trim() } });
      setAnulando(false);
      setMotivo('');
      avisar('Registro anulado', 'ok');
      cargar();
    } catch (e) { avisar(e.message); }
  };

  const fotosEditables = capturador && !registro.aprobado_por && !registro.anulado_por;
  const fotosProps = { puedeEditar: fotosEditables, onCambio: cargar, onAbrir: setFoto, confirmar, avisar };

  return (
    <div>
      <div className="encabezado-detalle pegajoso">
        <div>
          <h2>
            Reporte No. {registro.reporte_no} — {registro.cliente_nombre}
            {registro.resultado && (
              <span className={`badge ${registro.resultado === 'PASS' ? 'ok' : 'mal'}`}>{registro.resultado}</span>
            )}
            {registro.aprobado_por && <span className="badge ok">Aprobado</span>}
            {registro.anulado_por && <span className="badge mal">ANULADO</span>}
          </h2>
          <div className="subtitulo">
            {registro.denominacion} · Ref. {registro.referencia}
            {registro.norma && <> · Norma {registro.norma}</>}
          </div>
        </div>
        <div className="acciones">
          <a className="boton" href={`/api/registros/${registro.id}/pdf`} target="_blank" rel="noreferrer">PDF</a>
          {capturador && !registro.aprobado_por && !registro.anulado_por && (
            <Link className="boton secundario" to={`/registros/${registro.id}/editar`}>Editar</Link>
          )}
          {puedeAprobar && <button onClick={aprobar}>Aprobar</button>}
          {user.rol === 'admin' && !registro.anulado_por && (
            <button className="secundario peligro" onClick={() => setAnulando(true)}>Anular</button>
          )}
        </div>
      </div>

      {registro.anulado_por && (
        <div className="error">
          <strong>Registro anulado</strong> por {registro.anulado_por_nombre}
          {registro.anulado_en && ` el ${new Date(registro.anulado_en).toLocaleString('es-MX')}`}.
          {' '}Motivo: {registro.motivo_anulacion}
        </div>
      )}

      {anulando && (
        <div className="modal-fondo" onClick={() => setAnulando(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>Anular registro No. {registro.reporte_no}</h3>
            <p>El registro no se borra: queda visible y marcado como ANULADO, con tu nombre y la fecha. Indica el motivo (queda en la traza).</p>
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
          <div className="campo"><span className="etq">OF</span><span className="val">{registro.of || '—'}</span></div>
          <div className="campo"><span className="etq">Barra</span><span className="val">{registro.barra || '—'}</span></div>
          <div className="campo"><span className="etq">Producción</span><span className="val">{registro.fecha_produccion ? new Date(registro.fecha_produccion).toLocaleDateString('es-MX') : '—'}</span></div>
          <div className="campo"><span className="etq">Prueba</span><span className="val">{new Date(registro.fecha_prueba).toLocaleDateString('es-MX')}</span></div>
          <div className="campo"><span className="etq">Realizó</span><span className="val">{registro.realizado_por_nombre}</span></div>
          <div className="campo"><span className="etq">Aprobó</span><span className="val">{registro.aprobado_por_nombre || 'pendiente'}</span></div>
          {registro.observaciones && (
            <div className="campo ancho-total"><span className="etq">Observaciones</span><span className="val">{registro.observaciones}</span></div>
          )}
        </div>
      </div>

      {registro.piezas.map(p => (
        <div className="tarjeta" key={p.id}>
          <h4>Pieza {p.numero} — Rack {p.posicion_rack || '—'} · {p.densidad}</h4>
          {p.mediciones.length > 0 && (
            <table className="tabla mediciones">
              <thead>
                <tr>
                  <th>Punto</th>
                  <th>Cr (µm) <span className="espec-hint">{textoLimite(limites, 'cr')}</span></th>
                  <th>Ni total (µm) <span className="espec-hint">{textoLimite(limites, 'ni_t')}</span></th>
                  <th>Cu (µm) <span className="espec-hint">{textoLimite(limites, 'cu')}</span></th>
                </tr>
              </thead>
              <tbody>
                {p.mediciones.map(m => (
                  <tr key={m.punto}>
                    <td>{m.punto}</td>
                    <Valor limites={limites} clave="cr" valor={m.cr} />
                    <Valor limites={limites} clave="ni_t" valor={m.ni_total} />
                    <Valor limites={limites} clave="cu" valor={m.cu} />
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {(p.ni_sb !== null || p.ni_br !== null || p.ni_mps !== null || p.dp_mp_br !== null || p.dp_br_sb !== null || p.poros !== null) && (
            <div className="tabla-scroll">
              <table className="tabla mediciones">
                <thead>
                  <tr>
                    <th>Punto STEP</th>
                    <th>Ni SB (µm) <span className="espec-hint">{textoLimite(limites, 'sb_ni')}</span></th>
                    <th>Ni Br (µm) <span className="espec-hint">{textoLimite(limites, 'br_ni')}</span></th>
                    <th>Ni MPS (µm) <span className="espec-hint">{textoLimite(limites, 'mp_ni')}</span></th>
                    <th>ΔP MP–Br (mV) <span className="espec-hint">{textoLimite(limites, 'step_mp_br')}</span></th>
                    <th>ΔP Br–SB (mV) <span className="espec-hint">{textoLimite(limites, 'step_br_sb')}</span></th>
                    <th>Poros <span className="espec-hint">{textoLimite(limites, 'microporos')}</span></th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>{p.step_punto ?? '—'}</td>
                    <Valor limites={limites} clave="sb_ni" valor={p.ni_sb} base={niTotalBase(p)} />
                    <Valor limites={limites} clave="br_ni" valor={p.ni_br} base={niTotalBase(p)} />
                    <Valor limites={limites} clave="mp_ni" valor={p.ni_mps} base={niTotalBase(p)} />
                    <Valor limites={limites} clave="step_mp_br" valor={p.dp_mp_br} />
                    <Valor limites={limites} clave="step_br_sb" valor={p.dp_br_sb} />
                    <Valor limites={limites} clave="microporos" valor={p.poros} />
                  </tr>
                </tbody>
              </table>
            </div>
          )}
          <FotosSeccion
            registroId={registro.id} piezaId={p.id} seccion="step"
            titulo="Fotos STEP (gráficas)" imagenes={fotosDe(p.id, 'step')}
            {...fotosProps}
          />
          <FotosSeccion
            registroId={registro.id} piezaId={p.id} seccion="poros"
            titulo="Fotos de poros" imagenes={fotosDe(p.id, 'poros')}
            {...fotosProps}
          />
        </div>
      ))}

      <div className="tarjeta">
        <h4>Fotos de la muestra</h4>
        <FotosSeccion
          registroId={registro.id} seccion="muestra"
          titulo="Muestra con puntos de medición" imagenes={fotosMuestra}
          {...fotosProps}
        />
        {!fotosMuestra.length && !capturador && <span className="meta">Sin fotos</span>}
      </div>

      <div className="meta">* Fuera de especificación</div>
      <Link to="/registros">← Volver al registro</Link>

      <Lightbox src={foto} onClose={() => setFoto(null)} />
      {dialogoConfirmar}
      {vistaAviso}
    </div>
  );
}
