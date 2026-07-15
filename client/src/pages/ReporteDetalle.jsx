import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../App.jsx';
import { esMetrologia } from './ReportesEnsayo.jsx';
import { useConfirmar } from '../components/Confirmar.jsx';
import { useAviso } from '../components/Aviso.jsx';
import CargaFotos from '../components/CargaFotos.jsx';
import Lightbox from '../components/Lightbox.jsx';
import Cargando from '../components/Cargando.jsx';
import { val } from '../validaciones.js';

const PRUEBA_VACIA = {
  ensayo: '', norma: '', apartado: '', criterios: '', equipo_id: '',
  condiciones: '', fecha_inicio: '', fecha_fin: '', resultado: '', tipo_falla: '', valoracion: '', comentario: ''
};

function FormPrueba({ reporte, equipos, prueba, onGuardada, onCancelar }) {
  const [form, setForm] = useState(() => prueba ? {
    ensayo: prueba.ensayo || '',
    norma: prueba.norma || '',
    apartado: prueba.apartado || '',
    criterios: prueba.criterios || '',
    equipo_id: prueba.equipo_id ? String(prueba.equipo_id) : '',
    condiciones: prueba.condiciones || '',
    fecha_inicio: prueba.fecha_inicio ? prueba.fecha_inicio.slice(0, 16) : '',
    fecha_fin: prueba.fecha_fin ? prueba.fecha_fin.slice(0, 16) : '',
    resultado: prueba.resultado || '',
    tipo_falla: prueba.tipo_falla || '',
    valoracion: prueba.valoracion || '',
    comentario: prueba.comentario || ''
  } : { ...PRUEBA_VACIA });
  const [archivos, setArchivos] = useState([]);
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);
  const formRef = useRef(null);

  // El formulario se monta arriba de la lista de pruebas; al abrirlo desde un
  // botón "Completar" que puede estar bien abajo, se lleva la vista hacia él
  // (si no, parece que "no se despliega" porque queda fuera de pantalla).
  useEffect(() => {
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const set = (campo) => (e) => setForm({ ...form, [campo]: e.target.value });

  const enviar = async (e) => {
    e.preventDefault();
    setError('');
    setGuardando(true);
    try {
      const cuerpo = {
        ...form,
        equipo_id: form.equipo_id ? Number(form.equipo_id) : null,
        fecha_inicio: form.fecha_inicio || null,
        fecha_fin: form.fecha_fin || null,
        valoracion: form.valoracion || null
      };
      const guardada = prueba
        ? await api(`/reportes/pruebas/${prueba.id}`, { method: 'PUT', body: cuerpo })
        : await api(`/reportes/${reporte.id}/pruebas`, { method: 'POST', body: cuerpo });
      if (archivos.length) {
        const fd = new FormData();
        for (const a of archivos) fd.append('imagenes', a);
        await api(`/imagenes/prueba/${guardada.id}`, { method: 'POST', body: fd });
      }
      onGuardada();
    } catch (e) {
      setError(e.message);
      setGuardando(false);
    }
  };

  return (
    <form ref={formRef} className="tarjeta formulario" onSubmit={enviar}>
      <h3>{prueba ? `Completar prueba ${prueba.numero}: ${prueba.ensayo}` : 'Agregar prueba'}</h3>

      <h4 className="sub-seccion primera">Identificación de la prueba</h4>
      <div className="fila">
        <label>Ensayo
          <input value={form.ensayo} onChange={set('ensayo')} required {...val('nombreCatalogo')} placeholder="ej. Grind Saw Test, Stone Chip" />
        </label>
        <label>Norma
          <input value={form.norma} onChange={set('norma')} {...val('norma')} placeholder="ej. TL 528 D-21, WSS-M1P83-E2" />
        </label>
        <label>Apartado de la norma
          <input value={form.apartado} onChange={set('apartado')} {...val('apartado')} placeholder="ej. 3.5.1" />
        </label>
        <label>Equipo utilizado
          <select value={form.equipo_id} onChange={set('equipo_id')}>
            <option value="">—</option>
            {equipos.map(q => (
              <option key={q.id} value={q.id}>{q.nombre}{q.referencia_interna ? ` (${q.referencia_interna})` : ''}</option>
            ))}
          </select>
        </label>
      </div>

      <h4 className="sub-seccion">Criterios y condiciones</h4>
      <div className="fila">
        <label>Criterios de aceptación
          <input value={form.criterios} onChange={set('criterios')} placeholder="ej. Max. GT1, sin desprendimiento, Rating 5B min" />
        </label>
        <label>Condiciones de ensayo
          <input value={form.condiciones} onChange={set('condiciones')} placeholder="ej. velocidad 50 mm/min, curado 72 h" />
        </label>
      </div>

      <h4 className="sub-seccion">Tiempos y valoración</h4>
      <div className="fila">
        <label>Inicio<input type="datetime-local" value={form.fecha_inicio} onChange={set('fecha_inicio')} /></label>
        <label>Fin<input type="datetime-local" value={form.fecha_fin} onChange={set('fecha_fin')} /></label>
        <label>Valoración
          <select value={form.valoracion} onChange={set('valoracion')}>
            <option value="">— sin dictamen —</option>
            <option value="OK">OK</option>
            <option value="NOK">NOK</option>
          </select>
        </label>
      </div>

      <h4 className="sub-seccion">Resultado y evidencia</h4>
      <div className="fila">
        <label>Resultado (datos individuales)
          <input value={form.resultado} onChange={set('resultado')} placeholder="ej. P1: 53.04 N · P2: 55.04 N · sin desprendimiento" />
        </label>
        <label>Tipo de falla
          <input value={form.tipo_falla} onChange={set('tipo_falla')} placeholder="si aplica" />
        </label>
        <CargaFotos titulo="Evidencia (JPG/PNG)" archivos={archivos} onCambio={setArchivos} />
      </div>

      <h4 className="sub-seccion">Comentarios</h4>
      <label>Comentarios
        <textarea rows="3" value={form.comentario} onChange={set('comentario')} placeholder="Observaciones o notas de esta prueba" />
      </label>

      {error && <div className="error">{error}</div>}
      <div className="acciones">
        <button type="submit" disabled={guardando}>{guardando ? 'Guardando…' : prueba ? 'Guardar cambios' : 'Guardar prueba'}</button>
        <button type="button" className="secundario" onClick={onCancelar}>Cancelar</button>
      </div>
    </form>
  );
}

const AREAS_SOLICITANTES = ['Control Proceso', 'Calidad', 'Producción', 'Ingeniería'];

// Edita los datos de cabecera del reporte (OF, área solicitante, proyecto,
// recepción, piezas, material, información previa) mientras no esté aprobado.
function FormCabecera({ reporte, onGuardada, onCancelar }) {
  const [form, setForm] = useState({
    of: reporte.of || '',
    area_solicitante: reporte.area_solicitante || '',
    proyecto: reporte.proyecto || '',
    descripcion_material: reporte.descripcion_material || '',
    fecha_recepcion: reporte.fecha_recepcion ? reporte.fecha_recepcion.slice(0, 10) : '',
    cantidad_piezas: reporte.cantidad_piezas != null ? String(reporte.cantidad_piezas) : '',
    informacion_previa: reporte.informacion_previa || '',
    realizado_por: reporte.realizado_por != null ? String(reporte.realizado_por) : ''
  });
  const [usuarios, setUsuarios] = useState([]);
  const [error, setError] = useState('');
  const set = (campo) => (e) => setForm({ ...form, [campo]: e.target.value });

  useEffect(() => { api('/usuarios/seleccionables').then(setUsuarios).catch(() => {}); }, []);

  const enviar = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api(`/reportes/${reporte.id}`, {
        method: 'PUT',
        body: {
          of: form.of,
          area_solicitante: form.area_solicitante,
          proyecto: form.proyecto,
          descripcion_material: form.descripcion_material,
          informacion_previa: form.informacion_previa,
          fecha_recepcion: form.fecha_recepcion || null,
          cantidad_piezas: form.cantidad_piezas ? Number(form.cantidad_piezas) : null,
          realizado_por: form.realizado_por ? Number(form.realizado_por) : null
        }
      });
      onGuardada();
    } catch (e) { setError(e.message); }
  };

  return (
    <form className="tarjeta formulario" onSubmit={enviar}>
      <h3>Editar datos del reporte</h3>
      <div className="fila">
        <label>OF<input value={form.of} onChange={set('of')} {...val('of')} inputMode="numeric" placeholder="la asigna producción" /></label>
        <label>Área solicitante
          <input value={form.area_solicitante} onChange={set('area_solicitante')} list="edit-areas" placeholder="Control Proceso, Calidad…" />
          <datalist id="edit-areas">{AREAS_SOLICITANTES.map(a => <option key={a} value={a} />)}</datalist>
        </label>
        <label>Proyecto<input value={form.proyecto} onChange={set('proyecto')} {...val('proyecto')} /></label>
      </div>
      <div className="fila">
        <label>Fecha de recepción<input type="date" value={form.fecha_recepcion} onChange={set('fecha_recepcion')} /></label>
        <label>Piezas recibidas<input type="number" min="1" step="1" value={form.cantidad_piezas} onChange={set('cantidad_piezas')} /></label>
        <label>Analista (realizó)
          <select value={form.realizado_por} onChange={set('realizado_por')}>
            <option value="">— elegir —</option>
            {usuarios.map(u => <option key={u.id} value={u.id}>{u.nombre}</option>)}
          </select>
        </label>
      </div>
      <label>Descripción del material ensayado
        <input value={form.descripcion_material} onChange={set('descripcion_material')} placeholder="ej. pieza completa cromada…" />
      </label>
      <label>Información previa
        <input value={form.informacion_previa} onChange={set('informacion_previa')} placeholder="ej. piezas de validación Satin Chrome SM322" />
      </label>
      {error && <div className="error">{error}</div>}
      <div className="acciones">
        <button type="submit">Guardar datos</button>
        <button type="button" className="secundario" onClick={onCancelar}>Cancelar</button>
      </div>
    </form>
  );
}

const VALORACION_SUGERIDA =
  'Las piezas se encuentran acorde a las especificaciones requeridas por cliente por lo que la conformidad de estas es "Aceptado".';

function FormAprobar({ reporte, onAprobado, onCancelar }) {
  const sugerida = reporte.pruebas.some(p => p.valoracion === 'NOK') ? 'NO_CUMPLE' : 'CUMPLE';
  const [conclusion, setConclusion] = useState(sugerida);
  const [valoracion, setValoracion] = useState(VALORACION_SUGERIDA);
  const [error, setError] = useState('');

  const enviar = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api(`/reportes/${reporte.id}/aprobar`, {
        method: 'PUT',
        body: { conclusion, valoracion_final: valoracion }
      });
      onAprobado();
    } catch (e) { setError(e.message); }
  };

  return (
    <form className="tarjeta formulario" onSubmit={enviar}>
      <h3>Aprobar y emitir</h3>
      <div className="fila">
        <label>Conclusión
          <select value={conclusion} onChange={e => setConclusion(e.target.value)}>
            <option value="CUMPLE">CUMPLE</option>
            <option value="NO_CUMPLE">NO CUMPLE</option>
          </select>
        </label>
      </div>
      <label>Valoración final
        <textarea rows="3" value={valoracion} onChange={e => setValoracion(e.target.value)} />
      </label>
      {reporte.pruebas.some(p => p.valoracion === 'NOK') && (
        <div className="error">Hay pruebas con valoración NOK — se sugiere NO CUMPLE.</div>
      )}
      {error && <div className="error">{error}</div>}
      <div className="acciones">
        <button type="submit">Aprobar reporte</button>
        <button type="button" className="secundario" onClick={onCancelar}>Cancelar</button>
      </div>
    </form>
  );
}

function FotosPrueba({ prueba, puedeEditar, onCambio, onAbrir, confirmar, avisar }) {
  const inputRef = useRef(null);

  const agregar = async (e) => {
    const archivos = [...e.target.files];
    e.target.value = '';
    if (!archivos.length) return;
    const fd = new FormData();
    for (const a of archivos) fd.append('imagenes', a);
    try {
      await api(`/imagenes/prueba/${prueba.id}`, { method: 'POST', body: fd });
      onCambio();
    } catch (err) { avisar(err.message); }
  };

  const borrar = async (id) => {
    if (!await confirmar({ titulo: 'Borrar foto', mensaje: '¿Borrar esta foto de evidencia?', textoConfirmar: 'Borrar', peligro: true })) return;
    try {
      await api(`/imagenes/prueba-img/${id}`, { method: 'DELETE' });
      onCambio();
    } catch (err) { avisar(err.message); }
  };

  if (!prueba.imagenes?.length && !puedeEditar) return null;
  return (
    <div className="imagenes">
      {(prueba.imagenes || []).map(img => (
        <span className="miniatura" key={img.id}>
          <img
            src={`/api/imagenes/prueba-img/${img.id}/archivo`}
            alt={img.nombre || 'evidencia'}
            onClick={() => onAbrir(`/api/imagenes/prueba-img/${img.id}/archivo`)}
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
  );
}

export default function ReporteDetalle() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [reporte, setReporte] = useState(null);
  const [equipos, setEquipos] = useState([]);
  const [plan, setPlan] = useState([]);
  const [agregando, setAgregando] = useState(false);
  const [editando, setEditando] = useState(null); // prueba en edición
  const [editandoCabecera, setEditandoCabecera] = useState(false);
  const [aprobando, setAprobando] = useState(false);
  const [error, setError] = useState('');
  const [foto, setFoto] = useState(null);
  const [anulando, setAnulando] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [confirmar, dialogoConfirmar] = useConfirmar();
  const [avisar, vistaAviso] = useAviso();

  const cargar = useCallback(() => {
    api(`/reportes/${id}`).then(setReporte).catch(e => setError(e.message));
  }, [id]);
  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => {
    api('/equipos').then(qs => setEquipos(qs.filter(q => q.activo))).catch(() => {});
  }, []);
  useEffect(() => {
    if (reporte) api(`/planes?cliente_id=${reporte.cliente_id}`).then(setPlan).catch(() => {});
  }, [reporte?.cliente_id]);

  // un botón por plan (Stellantis tiene PS.50014 y PS.50065)
  const planesPorNorma = {};
  for (const p of plan) (planesPorNorma[p.plan_norma] ??= []).push(p);

  const precargarPlan = async (planNorma, cuantas) => {
    if (!await confirmar({
      titulo: 'Precargar plan',
      mensaje: `Se crearán ${cuantas} pruebas del plan ${planNorma || 'de cromado'} con su norma y criterios. Luego las completas conforme se terminen.`,
      textoConfirmar: 'Precargar'
    })) return;
    try {
      await api(`/reportes/${id}/precargar-plan`, { method: 'POST', body: { plan_norma: planNorma } });
      cargar();
    } catch (e) { avisar(e.message); }
  };

  if (error) return <div className="error">{error}</div>;
  if (!reporte) return <Cargando />;

  const aprobado = !!reporte.aprobado_por;
  const anulado = !!reporte.anulado_por;
  const captura = !aprobado && !anulado && esMetrologia(user);
  const puedeAprobar = !aprobado && !anulado && reporte.pruebas.length > 0 &&
    (user.rol === 'admin' || (user.rol === 'admin_area' && user.area_nombre === 'Metrología'));
  // Firma digital: SOLO admin, admin de Químico y admin de Metrología,
  // sobre reportes ya aprobados y no anulados.
  const puedeFirmar = aprobado && !anulado && !reporte.firmado_por &&
    (user.rol === 'admin' || user.rol === 'admin_area');

  const firmar = async () => {
    if (!await confirmar({
      titulo: `Firmar reporte Ens_${reporte.folio}`,
      mensaje: `Vas a firmar digitalmente como ${user.nombre}. La firma queda registrada con fecha y hora, y el PDF saldrá con un QR de verificación.`,
      textoConfirmar: 'Firmar'
    })) return;
    try {
      await api(`/reportes/${id}/firmar`, { method: 'PUT' });
      avisar('Reporte firmado', 'ok');
      cargar();
    } catch (e) { avisar(e.message); }
  };

  const anular = async () => {
    if (!motivo.trim()) return avisar('Indica el motivo de la anulación');
    try {
      await api(`/reportes/${id}/anular`, { method: 'PUT', body: { motivo: motivo.trim() } });
      setAnulando(false);
      setMotivo('');
      avisar('Reporte anulado', 'ok');
      cargar();
    } catch (e) { avisar(e.message); }
  };

  // Borrado definitivo: solo admin, aplica aunque esté aprobado o firmado.
  const borrar = async () => {
    if (!await confirmar({
      titulo: `Borrar reporte Ens_${reporte.folio}`,
      mensaje: 'El reporte se borra DEFINITIVAMENTE con sus pruebas y fotos, sin dejar traza (a diferencia de Anular). Aplica aunque esté aprobado o firmado. Esta acción no se puede deshacer.',
      textoConfirmar: 'Borrar definitivamente',
      peligro: true
    })) return;
    try {
      await api(`/reportes/${id}`, { method: 'DELETE' });
      navigate('/reportes');
    } catch (e) { avisar(e.message); }
  };

  const borrarPrueba = async (pruebaId) => {
    if (!await confirmar({ titulo: 'Borrar prueba', mensaje: '¿Borrar esta prueba?', textoConfirmar: 'Borrar', peligro: true })) return;
    try {
      await api(`/reportes/pruebas/${pruebaId}`, { method: 'DELETE' });
      cargar();
    } catch (e) { avisar(e.message); }
  };

  return (
    <div>
      <div className="encabezado-detalle pegajoso">
        <div>
          <h2>
            Ens_{reporte.folio}
            {reporte.conclusion
              ? <span className={`badge ${reporte.conclusion === 'CUMPLE' ? 'ok' : 'mal'}`}>{reporte.conclusion === 'CUMPLE' ? 'CUMPLE' : 'NO CUMPLE'}</span>
              : <span className="badge pendiente">En proceso</span>}
            {reporte.firmado_por && <span className="badge ok">Firmado</span>}
            {anulado && <span className="badge mal">ANULADO</span>}
          </h2>
          <div className="subtitulo">
            {reporte.cliente_nombre} · {reporte.denominacion} · Ref. {reporte.referencia}
          </div>
        </div>
        <div className="acciones">
          <a className="boton" href={`/api/reportes/${reporte.id}/pdf`} target="_blank" rel="noreferrer">
            {aprobado ? 'PDF' : 'PDF (borrador)'}
          </a>
          {captura && reporte.pruebas.length === 0 && Object.entries(planesPorNorma).map(([norma, pruebas]) => (
            <button key={norma} onClick={() => precargarPlan(norma, pruebas.length)}>
              Precargar plan {norma || 'de cromado'} ({pruebas.length} pruebas)
            </button>
          ))}
          {captura && !editandoCabecera && <button className="secundario" onClick={() => setEditandoCabecera(true)}>Editar datos</button>}
          {captura && !agregando && <button onClick={() => setAgregando(true)}>Agregar prueba</button>}
          {puedeAprobar && !aprobando && <button onClick={() => setAprobando(true)}>Aprobar y emitir</button>}
          {puedeFirmar && <button onClick={firmar}>Firmar</button>}
          {user.rol === 'admin' && !anulado && (
            <button className="secundario peligro" onClick={() => setAnulando(true)}>Anular</button>
          )}
          {user.rol === 'admin' && (
            <button className="secundario peligro" onClick={borrar}>Borrar</button>
          )}
        </div>
      </div>

      {reporte.firmado_por && (
        <div className="meta">
          Firmado digitalmente por <strong>{reporte.firmado_por_nombre}</strong>
          {reporte.firmado_en && ` el ${new Date(reporte.firmado_en).toLocaleString('es-MX')}`}
          {' '}· el PDF incluye el QR de verificación.
        </div>
      )}

      {anulado && (
        <div className="error">
          <strong>Reporte anulado</strong> por {reporte.anulado_por_nombre}
          {reporte.anulado_en && ` el ${new Date(reporte.anulado_en).toLocaleString('es-MX')}`}.
          {' '}Motivo: {reporte.motivo_anulacion}
        </div>
      )}

      {anulando && (
        <div className="modal-fondo" onClick={() => setAnulando(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>Anular reporte Ens_{reporte.folio}</h3>
            <p>El reporte no se borra: queda visible y marcado como ANULADO, con tu nombre y la fecha. Indica el motivo (queda en la traza).</p>
            <textarea rows="3" value={motivo} onChange={e => setMotivo(e.target.value)}
              placeholder="Motivo de la anulación" style={{ width: '100%' }} autoFocus />
            <div className="acciones" style={{ justifyContent: 'flex-end', marginTop: 12 }}>
              <button type="button" className="secundario" onClick={() => setAnulando(false)}>Cancelar</button>
              <button type="button" className="peligro" onClick={anular}>Anular</button>
            </div>
          </div>
        </div>
      )}

      {editandoCabecera && (
        <FormCabecera
          reporte={reporte}
          onGuardada={() => { setEditandoCabecera(false); cargar(); }}
          onCancelar={() => setEditandoCabecera(false)}
        />
      )}

      {!editandoCabecera && (
      <div className="tarjeta">
        <div className="datos-grid">
          <div className="campo"><span className="etq">OF</span><span className="val">{reporte.of || '—'}</span></div>
          <div className="campo"><span className="etq">Área solicitante</span><span className="val">{reporte.area_solicitante || '—'}</span></div>
          <div className="campo"><span className="etq">Proyecto</span><span className="val">{reporte.proyecto || '—'}</span></div>
          <div className="campo"><span className="etq">Recepción</span><span className="val">{reporte.fecha_recepcion ? new Date(reporte.fecha_recepcion).toLocaleDateString('es-MX') : '—'}</span></div>
          <div className="campo"><span className="etq">Piezas recibidas</span><span className="val">{reporte.cantidad_piezas || '—'}</span></div>
          {reporte.descripcion_material && <div className="campo ancho-total"><span className="etq">Material ensayado</span><span className="val">{reporte.descripcion_material}</span></div>}
          {reporte.informacion_previa && <div className="campo ancho-total"><span className="etq">Información previa</span><span className="val">{reporte.informacion_previa}</span></div>}
          {reporte.valoracion_final && <div className="campo ancho-total"><span className="etq">Valoración final</span><span className="val">{reporte.valoracion_final}</span></div>}
          <div className="campo ancho-total"><span className="etq">Analista</span><span className="val">
            {reporte.realizado_por_nombre}
            {aprobado && <> · Aprobó: {reporte.aprobado_por_nombre} ({new Date(reporte.aprobado_en).toLocaleDateString('es-MX')})</>}
          </span></div>
        </div>
      </div>
      )}

      {agregando && (
        <FormPrueba
          reporte={reporte}
          equipos={equipos}
          onGuardada={() => { setAgregando(false); cargar(); }}
          onCancelar={() => setAgregando(false)}
        />
      )}

      {aprobando && (
        <FormAprobar
          reporte={reporte}
          onAprobado={() => { setAprobando(false); cargar(); }}
          onCancelar={() => setAprobando(false)}
        />
      )}

      <h3>Pruebas realizadas</h3>
      {captura && !reporte.pruebas.length && Object.keys(planesPorNorma).length === 0 && (
        <div className="nota-info">
          El cliente {reporte.cliente_nombre} no tiene un plan precargado de pruebas, realizarlas a mano o{' '}
          <Link to={`/planes?cliente_id=${reporte.cliente_id}`}>crear un plan de pruebas</Link>.
        </div>
      )}
      {!reporte.pruebas.length && <div className="vacio">Todavía no hay pruebas. Se agregan conforme se van terminando.</div>}
      {reporte.pruebas.map(p => (
        editando && editando.id === p.id ? (
          <FormPrueba
            key={p.id}
            reporte={reporte}
            equipos={equipos}
            prueba={editando}
            onGuardada={() => { setEditando(null); cargar(); }}
            onCancelar={() => setEditando(null)}
          />
        ) : (
        <div className="tarjeta" key={p.id}>
          <div className="ensayo-titulo">
            <strong>
              Prueba {p.numero}: {[p.norma, [p.apartado, p.ensayo].filter(Boolean).join(' ')].filter(Boolean).join(' — ')}
            </strong>
            {p.valoracion
              ? <span className={`badge ${p.valoracion === 'OK' ? 'ok' : 'mal'}`}>{p.valoracion}</span>
              : <span className="badge pendiente">pendiente</span>}
            <span className="acciones">
              {captura && <button className="chico" onClick={() => { setEditando(p); setAgregando(false); }}>Completar</button>}
              {captura && <button className="chico secundario" onClick={() => borrarPrueba(p.id)}>Borrar</button>}
            </span>
          </div>
          <div className="meta">
            {p.equipo_nombre && <>Equipo: {p.equipo_nombre}{p.equipo_referencia ? ` (${p.equipo_referencia})` : ''}{p.equipo_calibracion ? ` · calib. ${new Date(p.equipo_calibracion).toLocaleDateString('es-MX')}` : ''} · </>}
            {p.fecha_inicio && <>Inicio: {new Date(p.fecha_inicio).toLocaleString('es-MX')} · </>}
            {p.fecha_fin && <>Fin: {new Date(p.fecha_fin).toLocaleString('es-MX')} · </>}
            Realizó: {p.realizado_por_nombre}
          </div>
          {p.criterios && <div><span className="meta">Criterios:</span> {p.criterios}</div>}
          {p.condiciones && <div><span className="meta">Condiciones:</span> {p.condiciones}</div>}
          {p.resultado && <div><span className="meta">Resultado:</span> {p.resultado}</div>}
          {p.tipo_falla && <div><span className="meta">Tipo de falla:</span> {p.tipo_falla}</div>}
          {p.comentario && <div><span className="meta">Comentarios:</span> {p.comentario}</div>}
          <FotosPrueba prueba={p} puedeEditar={captura} onCambio={cargar} onAbrir={setFoto} confirmar={confirmar} avisar={avisar} />
        </div>
        )
      ))}
      <Link to="/reportes">← Volver a reportes</Link>

      <Lightbox src={foto} onClose={() => setFoto(null)} />
      {dialogoConfirmar}
      {vistaAviso}
    </div>
  );
}
