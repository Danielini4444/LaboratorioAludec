import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { api } from '../api.js';
import { textoLimite, fueraDeLimite, niTotalBase } from '../especs.js';
import { val } from '../validaciones.js';
import CargaFotos from '../components/CargaFotos.jsx';
import Cargando from '../components/Cargando.jsx';

const txt = (v) => (v === null || v === undefined ? '' : String(v));

const PIEZA_VACIA = (numero, densidad) => ({
  numero,
  posicion_rack: '',
  densidad,
  mediciones: [{ punto: 1, cr: '', ni_total: '', cu: '', comentario: '' }, { punto: 2, cr: '', ni_total: '', cu: '', comentario: '' }],
  step_punto: '',
  ni_sb: '', ni_br: '', ni_mps: '', dp_mp_br: '', dp_br_sb: '',
  ni_sb_pct: '', ni_br_pct: '',
  poros: '',
  fotos_step: [],
  fotos_poros: []
});

async function subirFotos(registroId, archivos, extra = {}) {
  if (!archivos.length) return;
  const form = new FormData();
  for (const [clave, valor] of Object.entries(extra)) form.append(clave, valor);
  for (const a of archivos) form.append('imagenes', a);
  await api(`/imagenes/registro/${registroId}`, { method: 'POST', body: form });
}

// Campos STEP de la pieza con su clave de especificación.
const CAMPOS_STEP = [
  ['ni_sb', 'Ni SB', 'sb_ni', 'µm'],
  ['ni_br', 'Ni Br', 'br_ni', 'µm'],
  ['ni_mps', 'Ni MPS', 'mp_ni', 'µm'],
  ['dp_mp_br', 'ΔP (NiMPS–NiB)', 'step_mp_br', 'mV'],
  ['dp_br_sb', 'ΔP (NiB–NiSB)', 'step_br_sb', 'mV']
];

const ETIQUETA_MEDICION = { cr: 'Cr', ni_total: 'Ni total', cu: 'Cu' };

function CeldaMedicion({ valor, onChange, limites, clave }) {
  return (
    <td>
      <input
        type="number" step="any" min="0" value={valor}
        className={fueraDeLimite(limites, clave, valor) ? 'fuera' : ''}
        onChange={e => onChange(e.target.value)}
      />
    </td>
  );
}

export default function NuevoRegistro() {
  const navigate = useNavigate();
  const { id } = useParams();
  const edicion = Boolean(id);
  const [cargandoReg, setCargandoReg] = useState(edicion);
  const normaDeseada = useRef(null);
  const [clientes, setClientes] = useState([]);
  const [piezasCatalogo, setPiezasCatalogo] = useState([]);
  const [especs, setEspecs] = useState([]);
  const [especId, setEspecId] = useState('');

  const [cabecera, setCabecera] = useState({
    cliente_id: '', referencia: '', denominacion: '', of: '', barra: '',
    fecha_produccion: '', fecha_prueba: new Date().toISOString().slice(0, 10), observaciones: ''
  });
  const [piezas, setPiezas] = useState([PIEZA_VACIA(1, 'HCD'), PIEZA_VACIA(2, 'LCD')]);
  const [resultadoManual, setResultadoManual] = useState('');
  const [archivos, setArchivos] = useState([]);
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    api('/clientes').then(setClientes).catch(() => {});
    api('/piezas').then(ps => setPiezasCatalogo(ps.filter(p => p.activa))).catch(() => {});
  }, []);

  // en edición: cargar el registro y prefijar el formulario
  useEffect(() => {
    if (!edicion) return;
    api(`/registros/${id}`)
      .then(reg => {
        normaDeseada.current = reg.norma || null;
        setCabecera({
          cliente_id: String(reg.cliente_id),
          referencia: reg.referencia, denominacion: reg.denominacion,
          of: reg.of || '', barra: reg.barra || '',
          fecha_produccion: reg.fecha_produccion ? reg.fecha_produccion.slice(0, 10) : '',
          fecha_prueba: reg.fecha_prueba ? reg.fecha_prueba.slice(0, 10) : '',
          observaciones: reg.observaciones || ''
        });
        setPiezas(reg.piezas.map(p => ({
          id: p.id, numero: p.numero, posicion_rack: p.posicion_rack || '', densidad: p.densidad,
          mediciones: (p.mediciones.length ? p.mediciones : [{ punto: 1, cr: null, ni_total: null, cu: null, comentario: null }])
            .map(m => ({ punto: m.punto, cr: txt(m.cr), ni_total: txt(m.ni_total), cu: txt(m.cu), comentario: txt(m.comentario) })),
          step_punto: txt(p.step_punto), ni_sb: txt(p.ni_sb), ni_br: txt(p.ni_br), ni_mps: txt(p.ni_mps),
          dp_mp_br: txt(p.dp_mp_br), dp_br_sb: txt(p.dp_br_sb), poros: txt(p.poros),
          ni_sb_pct: txt(p.ni_sb_pct), ni_br_pct: txt(p.ni_br_pct),
          fotos_step: [], fotos_poros: []
        })));
        setResultadoManual(reg.resultado || '');
        setCargandoReg(false);
      })
      .catch(e => { setError(e.message); setCargandoReg(false); });
  }, [id]);

  // especificaciones del cliente elegido
  useEffect(() => {
    setEspecs([]);
    setEspecId('');
    if (!cabecera.cliente_id) return;
    api(`/especificaciones?cliente_id=${cabecera.cliente_id}`)
      .then(es => {
        setEspecs(es);
        const deseada = normaDeseada.current;
        const match = deseada ? es.find(e => e.norma === deseada) : null;
        if (match) setEspecId(String(match.id));
        else if (es.length === 1) setEspecId(String(es[0].id));
      })
      .catch(() => {});
  }, [cabecera.cliente_id]);

  const espec = especs.find(e => e.id === Number(especId));
  const limites = espec ? espec.limites : null;

  const set = (campo) => (e) => setCabecera({ ...cabecera, [campo]: e.target.value });

  // con cliente elegido, solo se sugieren sus referencias
  const piezasFiltradas = cabecera.cliente_id
    ? piezasCatalogo.filter(p => String(p.cliente_id) === cabecera.cliente_id)
    : piezasCatalogo;

  // referencia o denominación del catálogo → se llena el resto
  const setConAutocompletado = (campo) => (e) => {
    const valor = e.target.value;
    const pieza = piezasFiltradas.find(p => p[campo].toLowerCase() === valor.toLowerCase());
    if (pieza) {
      setCabecera(c => ({
        ...c, [campo]: valor,
        referencia: pieza.referencia,
        denominacion: pieza.denominacion,
        cliente_id: String(pieza.cliente_id)
      }));
    } else {
      setCabecera(c => ({ ...c, [campo]: valor }));
    }
  };

  const setPieza = (i, cambios) => setPiezas(ps => ps.map((p, j) => j === i ? { ...p, ...cambios } : p));
  const setMedicion = (i, m, campo, valor) => setPiezas(ps => ps.map((p, j) => {
    if (j !== i) return p;
    return { ...p, mediciones: p.mediciones.map((med, k) => k === m ? { ...med, [campo]: valor } : med) };
  }));

  const agregarPieza = () => setPiezas(ps => [...ps, PIEZA_VACIA(ps.length + 1, 'LCD')]);
  const quitarPieza = (i) => setPiezas(ps => ps.filter((_, j) => j !== i).map((p, j) => ({ ...p, numero: j + 1 })));
  const agregarPunto = (i) => setPiezas(ps => ps.map((p, j) =>
    j === i ? { ...p, mediciones: [...p.mediciones, { punto: p.mediciones.length + 1, cr: '', ni_total: '', cu: '', comentario: '' }] } : p
  ));
  const quitarPunto = (i, j) => setPiezas(ps => ps.map((p, k) =>
    k === i
      ? { ...p, mediciones: p.mediciones.filter((_, idx) => idx !== j).map((m, idx) => ({ ...m, punto: idx + 1 })) }
      : p
  ));

  // Evaluación en vivo: global y por pieza. Si algo medido queda fuera de límite → FAIL sugerido.
  const evaluacion = useMemo(() => {
    if (!limites) return { medidos: 0, fueras: [], porPieza: {} };
    let medidos = 0;
    const fueras = [];
    const porPieza = {};
    for (const p of piezas) {
      const pp = (porPieza[p.numero] = { medidos: 0, fueras: [] });
      const base = niTotalBase(p); // para límites porcentuales (% del Ni total)
      for (const m of p.mediciones) {
        for (const [campo, clave] of [['cr', 'cr'], ['ni_total', 'ni_t'], ['cu', 'cu']]) {
          if (m[campo] !== '') {
            medidos++; pp.medidos++;
            if (fueraDeLimite(limites, clave, m[campo])) {
              fueras.push(`Pieza ${p.numero} punto ${m.punto}: ${ETIQUETA_MEDICION[campo]}`);
              pp.fueras.push(`punto ${m.punto}: ${ETIQUETA_MEDICION[campo]}`);
            }
          }
        }
      }
      for (const [campo, etiqueta, clave] of CAMPOS_STEP) {
        if (p[campo] !== '') {
          medidos++; pp.medidos++;
          if (fueraDeLimite(limites, clave, p[campo], base)) {
            fueras.push(`Pieza ${p.numero}: ${etiqueta}`);
            pp.fueras.push(etiqueta);
          }
        }
      }
      if (p.poros !== '') {
        medidos++; pp.medidos++;
        if (fueraDeLimite(limites, 'microporos', p.poros)) {
          fueras.push(`Pieza ${p.numero}: poros`);
          pp.fueras.push('poros');
        }
      }
    }
    return { medidos, fueras, porPieza };
  }, [piezas, limites]);

  const resultadoSugerido = evaluacion.medidos ? (evaluacion.fueras.length ? 'FAIL' : 'PASS') : '';
  const resultado = resultadoManual || resultadoSugerido;

  // Estado de una pieza para la insignia del encabezado.
  const estadoPieza = (numero) => {
    if (!limites) return null;
    const pp = evaluacion.porPieza[numero];
    if (!pp || pp.medidos === 0) return null;
    return pp.fueras.length
      ? <span className="badge mal">{pp.fueras.length} fuera de especificación</span>
      : <span className="badge ok">en especificación</span>;
  };

  const enviar = async (e) => {
    e.preventDefault();
    setError('');
    setGuardando(true);
    try {
      const cuerpo = {
        ...cabecera,
        cliente_id: Number(cabecera.cliente_id),
        norma: espec ? espec.norma : (normaDeseada.current || null),
        fecha_produccion: cabecera.fecha_produccion || null,
        resultado: resultado || null,
        piezas: piezas.map(({ fotos_step, fotos_poros, ...p }) => p) // conserva id en edición
      };

      if (edicion) {
        await api(`/registros/${id}`, { method: 'PUT', body: cuerpo });
        navigate(`/registros/${id}`);
        return;
      }

      const registro = await api('/registros', { method: 'POST', body: cuerpo });
      await subirFotos(registro.id, archivos); // fotos de la muestra
      for (let i = 0; i < piezas.length; i++) {
        const piezaCreada = (registro.piezas || []).find(pc => pc.numero === i + 1);
        if (!piezaCreada) continue;
        await subirFotos(registro.id, piezas[i].fotos_step, { pieza_id: piezaCreada.id, seccion: 'step' });
        await subirFotos(registro.id, piezas[i].fotos_poros, { pieza_id: piezaCreada.id, seccion: 'poros' });
      }
      navigate(`/registros/${registro.id}`);
    } catch (e) {
      setError(e.message);
      setGuardando(false);
    }
  };

  if (cargandoReg) return <Cargando />;

  return (
    <form className="formulario" onSubmit={enviar}>
      <div className="encabezado-pagina">
        <h2>{edicion ? 'Editar registro de espesores' : 'Nuevo registro de espesores'}</h2>
        <p className="descripcion">
          {edicion
            ? 'Ajusta los datos y las mediciones. Las fotos se gestionan desde el detalle del registro.'
            : 'Elige el cliente y la pieza, captura las mediciones de cada pieza y guarda — los límites de la norma se aplican solos.'}
        </p>
      </div>

      <div className="tarjeta">
        <h3 className="paso"><span className="num">1</span> Cliente y pieza</h3>
        <div className="fila">
          <label>Cliente
            <select value={cabecera.cliente_id} onChange={set('cliente_id')} required>
              <option value="">— elegir —</option>
              {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </label>
          {especs.length > 1 ? (
            <label>Norma
              <select value={especId} onChange={e => setEspecId(e.target.value)} required>
                <option value="">— elegir —</option>
                {especs.map(e => <option key={e.id} value={e.id}>{e.norma}</option>)}
              </select>
            </label>
          ) : (
            <label>Norma<input value={espec ? espec.norma : ''} readOnly placeholder="según cliente" /></label>
          )}
          <label>Referencia
            <input value={cabecera.referencia} onChange={setConAutocompletado('referencia')} required {...val('referencia')} list="cat-referencias" placeholder="escribe para autocompletar" />
            <datalist id="cat-referencias">
              {piezasFiltradas.map(p => <option key={p.id} value={p.referencia}>{p.denominacion}</option>)}
            </datalist>
          </label>
          <label>Denominación
            <input value={cabecera.denominacion} onChange={setConAutocompletado('denominacion')} required {...val('denominacion')} list="cat-denominaciones" placeholder="escribe para autocompletar" />
            <datalist id="cat-denominaciones">
              {piezasFiltradas.map(p => <option key={p.id} value={p.denominacion} />)}
            </datalist>
          </label>
        </div>
        <div className="fila">
          <label>OF<input value={cabecera.of} onChange={set('of')} {...val('of')} inputMode="numeric" placeholder="la asigna producción" /></label>
          <label>Barra<input value={cabecera.barra} onChange={set('barra')} {...val('barra')} /></label>
          <label>Fecha de producción<input type="date" value={cabecera.fecha_produccion} onChange={set('fecha_produccion')} /></label>
          <label>Fecha de prueba<input type="date" value={cabecera.fecha_prueba} onChange={set('fecha_prueba')} required /></label>
        </div>
      </div>

      <h3 className="paso"><span className="num">2</span> Mediciones por pieza</h3>
      {piezas.map((p, i) => (
        <div className="tarjeta" key={i}>
          <div className="pieza-cabecera">
            <strong>Pieza {p.numero}</strong>
            <label className="inline">Posición de rack
              <input value={p.posicion_rack} onChange={e => setPieza(i, { posicion_rack: e.target.value })} {...val('posicionRack')} placeholder="FA3" />
            </label>
            <label className="inline">Densidad
              <select value={p.densidad} onChange={e => setPieza(i, { densidad: e.target.value })}>
                <option value="HCD">HCD (alta)</option>
                <option value="LCD">LCD (baja)</option>
              </select>
            </label>
            <span className="acciones">
              {estadoPieza(p.numero)}
              {piezas.length > 1 && (
                <button type="button" className="chico secundario" onClick={() => quitarPieza(i)}>Quitar pieza</button>
              )}
            </span>
          </div>

          <table className="tabla mediciones">
            <thead>
              <tr>
                <th>Punto</th>
                <th>Cr (µm) <span className="espec-hint">{textoLimite(limites, 'cr')}</span></th>
                <th>Ni total (µm) <span className="espec-hint">{textoLimite(limites, 'ni_t')}</span></th>
                <th>Cu (µm) <span className="espec-hint">{textoLimite(limites, 'cu')}</span></th>
                <th>Comentario</th>
                <th aria-label="acciones"></th>
              </tr>
            </thead>
            <tbody>
              {p.mediciones.map((m, j) => (
                <tr key={j}>
                  <td>{m.punto}</td>
                  <CeldaMedicion valor={m.cr} onChange={v => setMedicion(i, j, 'cr', v)} limites={limites} clave="cr" />
                  <CeldaMedicion valor={m.ni_total} onChange={v => setMedicion(i, j, 'ni_total', v)} limites={limites} clave="ni_t" />
                  <CeldaMedicion valor={m.cu} onChange={v => setMedicion(i, j, 'cu', v)} limites={limites} clave="cu" />
                  <td>
                    <input type="text" value={m.comentario} onChange={e => setMedicion(i, j, 'comentario', e.target.value)} placeholder="—" />
                  </td>
                  <td>
                    {p.mediciones.length > 1 && (
                      <button type="button" className="btn-quitar-fila" title="Quitar punto" onClick={() => quitarPunto(i, j)}>×</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button type="button" className="chico secundario" onClick={() => agregarPunto(i)}>+ Punto de medición</button>

          <h4 className="sub-seccion">STEP y poros</h4>
          <div className="fila">
            <label>Punto STEP
              <input type="number" min="1" step="1" value={p.step_punto} onChange={e => setPieza(i, { step_punto: e.target.value })} />
            </label>
            {CAMPOS_STEP.map(([campo, etiqueta, clave, unidad]) => (
              <label key={campo}>{etiqueta} ({unidad}) <span className="espec-hint">{textoLimite(limites, clave)}</span>
                <input
                  type="number" step="any" min={campo.startsWith('ni_') ? '0' : undefined} value={p[campo]}
                  className={fueraDeLimite(limites, clave, p[campo], niTotalBase(p)) ? 'fuera' : ''}
                  onChange={e => setPieza(i, { [campo]: e.target.value })}
                />
              </label>
            ))}
            <label>% Ni SB (del Ni total)
              <input type="number" step="any" min="0" value={p.ni_sb_pct}
                onChange={e => setPieza(i, { ni_sb_pct: e.target.value })} />
            </label>
            <label>% Ni Br (del Ni total)
              <input type="number" step="any" min="0" value={p.ni_br_pct}
                onChange={e => setPieza(i, { ni_br_pct: e.target.value })} />
            </label>
            <label>Poros (poros/cm²) <span className="espec-hint">{textoLimite(limites, 'microporos')}</span>
              <input
                type="number" min="0" step="1" value={p.poros}
                className={fueraDeLimite(limites, 'microporos', p.poros) ? 'fuera' : ''}
                onChange={e => setPieza(i, { poros: e.target.value })}
              />
            </label>
          </div>
          {!edicion && (
            <div className="fila">
              <CargaFotos titulo="Fotos STEP (gráficas de espesor y potencial)"
                archivos={p.fotos_step} onCambio={l => setPieza(i, { fotos_step: l })} />
              <CargaFotos titulo="Fotos de poros (microscopio)"
                archivos={p.fotos_poros} onCambio={l => setPieza(i, { fotos_poros: l })} />
            </div>
          )}
        </div>
      ))}
      <button type="button" className="secundario" onClick={agregarPieza}>+ Agregar pieza</button>

      <div className="tarjeta">
        <h3 className="paso"><span className="num">3</span> Resultado y evidencia</h3>
        {limites && evaluacion.medidos > 0 && (
          <div className="resumen-validacion">
            {evaluacion.fueras.length
              ? <div className="error">Fuera de especificación ({espec.norma}): {evaluacion.fueras.join(' · ')}</div>
              : <div className="dentro-espec">Todo lo capturado está dentro de especificación ({espec.norma}).</div>}
          </div>
        )}
        <div className="fila">
          <label>Resultado
            <select value={resultado} onChange={e => setResultadoManual(e.target.value)}>
              <option value="">—</option>
              <option value="PASS">PASS</option>
              <option value="FAIL">FAIL</option>
            </select>
          </label>
          <label>Observaciones
            <input value={cabecera.observaciones} onChange={set('observaciones')} placeholder="Without any alteration" />
          </label>
          {!edicion && (
            <CargaFotos titulo="Fotos de la muestra (con puntos de medición)"
              archivos={archivos} onCambio={setArchivos} />
          )}
        </div>
        {edicion && (
          <div className="nota-info">Las fotos (muestra, STEP y poros) se agregan o quitan desde el detalle del registro.</div>
        )}
        {resultadoSugerido && !resultadoManual && (
          <div className="meta">Resultado sugerido según especificación: <strong>{resultadoSugerido}</strong></div>
        )}
      </div>

      {error && <div className="error">{error}</div>}
      <div className="barra-guardar">
        <button type="submit" disabled={guardando}>
          {guardando ? 'Guardando…' : edicion ? 'Guardar cambios' : 'Guardar registro'}
        </button>
        <Link to={edicion ? `/registros/${id}` : '/registros'} className="boton secundario">Cancelar</Link>
      </div>
    </form>
  );
}
