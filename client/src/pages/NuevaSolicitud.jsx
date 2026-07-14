import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../api.js';
import { ensayosDe } from '../ensayosCatalogo.js';
import { val } from '../validaciones.js';

const LINEA_VACIA = { ensayo: '', num_muestras: '', observaciones: '' };

const FORM_VACIO = {
  tipo: 'SE', area_id: '', cliente_id: '', referencia: '', denominacion: '',
  of_cromado: '', of_inyeccion: '', of_ensamble: '', of_pintura: '',
  proveedor: '', numero_etiqueta: '', color_material: '', fecha_caducidad: '',
  notas: '',
};

export default function NuevaSolicitud() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ ...FORM_VACIO });
  const [lineas, setLineas] = useState([{ ...LINEA_VACIA }]);
  const [clientes, setClientes] = useState([]);
  const [areas, setAreas] = useState([]);
  const [piezas, setPiezas] = useState([]);
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    api('/clientes').then(setClientes).catch(() => {});
    api('/areas').then(setAreas).catch(() => {});
    api('/piezas').then(ps => setPiezas(ps.filter(p => p.activa))).catch(() => {});
  }, []);

  const set = (campo) => (e) => setForm({ ...form, [campo]: e.target.value });
  const esMP = form.tipo === 'SEMP';

  const piezasFiltradas = form.cliente_id
    ? piezas.filter(p => String(p.cliente_id) === form.cliente_id)
    : piezas;

  // Referencia → autocompleta denominación (y cliente), como el VLOOKUP del Excel.
  const setConAutocompletado = (campo) => (e) => {
    const valor = e.target.value;
    const pieza = piezasFiltradas.find(p => (p[campo] || '').toLowerCase() === valor.toLowerCase());
    if (pieza) {
      setForm(f => ({ ...f, [campo]: valor, referencia: pieza.referencia, denominacion: pieza.denominacion, cliente_id: String(pieza.cliente_id) }));
    } else {
      setForm(f => ({ ...f, [campo]: valor }));
    }
  };

  const setLinea = (i, campo) => (e) => {
    const copia = lineas.slice();
    copia[i] = { ...copia[i], [campo]: e.target.value };
    setLineas(copia);
  };
  const agregarLinea = () => setLineas([...lineas, { ...LINEA_VACIA }]);
  const quitarLinea = (i) => setLineas(lineas.length === 1 ? [{ ...LINEA_VACIA }] : lineas.filter((_, j) => j !== i));

  const cambiarTipo = (tipo) => { setForm({ ...form, tipo }); setLineas([{ ...LINEA_VACIA }]); };

  const enviar = async (e) => {
    e.preventDefault();
    setError('');
    setGuardando(true);
    try {
      const solicitud = await api('/solicitudes-ensayo', {
        method: 'POST',
        body: {
          ...form,
          cliente_id: form.cliente_id ? Number(form.cliente_id) : null,
          area_id: Number(form.area_id),
          fecha_caducidad: esMP ? (form.fecha_caducidad || null) : null,
          lineas: lineas
            .filter(l => l.ensayo.trim())
            .map(l => ({ ensayo: l.ensayo, num_muestras: l.num_muestras ? Number(l.num_muestras) : null, observaciones: l.observaciones })),
        },
      });
      navigate(`/solicitudes/${solicitud.id}`);
    } catch (e) {
      setError(e.message);
      setGuardando(false);
    }
  };

  const catalogo = ensayosDe(form.tipo);

  return (
    <form className="formulario" onSubmit={enviar}>
      <div className="encabezado-pagina">
        <h2>Nueva solicitud de ensayos</h2>
        <p className="descripcion">Se asigna el N° de solicitud al guardar. El área del laboratorio la toma y la cierra al terminar.</p>
      </div>

      <div className="tarjeta">
        <h3 className="paso"><span className="num">1</span> Formato y destino</h3>
        <div className="fila">
          <label>Formato
            <select value={form.tipo} onChange={e => cambiarTipo(e.target.value)}>
              <option value="SE">SE · Solicitud de ensayos (producto) — FM-15-01</option>
              <option value="SEMP">SEMP · Ensayos de materia prima — FM-15-01A</option>
            </select>
          </label>
          <label>Área que atiende
            <select value={form.area_id} onChange={set('area_id')} required>
              <option value="">— elegir —</option>
              {areas.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
            </select>
          </label>
        </div>
      </div>

      <div className="tarjeta">
        <h3 className="paso"><span className="num">2</span> {esMP ? 'Materia prima' : 'Identificación de la pieza'}</h3>
        <div className="fila">
          <label>Cliente
            <select value={form.cliente_id} onChange={set('cliente_id')}>
              <option value="">— elegir —</option>
              {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </label>
          <label>Referencia
            <input value={form.referencia} onChange={setConAutocompletado('referencia')} required {...val('referencia')} list="sol-referencias" />
            <datalist id="sol-referencias">
              {piezasFiltradas.map(p => <option key={p.id} value={p.referencia}>{p.denominacion}</option>)}
            </datalist>
          </label>
          <label>Denominación
            <input value={form.denominacion} onChange={setConAutocompletado('denominacion')} {...val('denominacion')} list="sol-denominaciones" />
            <datalist id="sol-denominaciones">
              {piezasFiltradas.map(p => <option key={p.id} value={p.denominacion} />)}
            </datalist>
          </label>
        </div>

        {esMP ? (
          <div className="fila">
            <label>Proveedor<input value={form.proveedor} onChange={set('proveedor')} {...val('proveedor')} /></label>
            <label>N° de etiqueta<input value={form.numero_etiqueta} onChange={set('numero_etiqueta')} {...val('numeroEtiqueta')} /></label>
            <label>Color del material<input value={form.color_material} onChange={set('color_material')} {...val('colorMaterial')} /></label>
            <label>Fecha de caducidad<input type="date" value={form.fecha_caducidad} onChange={set('fecha_caducidad')} /></label>
          </div>
        ) : (
          <div className="fila">
            <label>OF Cromado<input value={form.of_cromado} onChange={set('of_cromado')} {...val('of')} inputMode="numeric" /></label>
            <label>OF Inyección<input value={form.of_inyeccion} onChange={set('of_inyeccion')} {...val('of')} inputMode="numeric" /></label>
            <label>OF Ensamble<input value={form.of_ensamble} onChange={set('of_ensamble')} {...val('of')} inputMode="numeric" /></label>
            <label>OF Pintura<input value={form.of_pintura} onChange={set('of_pintura')} {...val('of')} inputMode="numeric" /></label>
          </div>
        )}
      </div>

      <div className="tarjeta">
        <h3 className="paso"><span className="num">3</span> Ensayos solicitados</h3>
        <div className="tabla-scroll">
          <table className="tabla mediciones" style={{ minWidth: 640, width: '100%' }}>
            <thead>
              <tr>
                <th style={{ width: '38%' }}>Tipo de ensayo</th>
                <th style={{ width: 130 }}>N° muestras</th>
                <th>Observaciones</th>
                <th style={{ width: 40 }}></th>
              </tr>
            </thead>
            <tbody>
              {lineas.map((l, i) => (
                <tr key={i}>
                  <td>
                    <input list={`cat-ensayos-${form.tipo}`} value={l.ensayo} onChange={setLinea(i, 'ensayo')}
                      placeholder="elige o escribe…" style={{ width: '100%', textAlign: 'left' }} />
                  </td>
                  <td><input type="number" min="1" step="1" value={l.num_muestras} onChange={setLinea(i, 'num_muestras')} /></td>
                  <td><input value={l.observaciones} onChange={setLinea(i, 'observaciones')} style={{ width: '100%', textAlign: 'left' }} /></td>
                  <td><button type="button" className="btn-quitar-fila" onClick={() => quitarLinea(i)} title="Quitar">×</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <datalist id={`cat-ensayos-${form.tipo}`}>
          {catalogo.map(e => <option key={e} value={e} />)}
        </datalist>
        <button type="button" className="boton secundario chico" onClick={agregarLinea} style={{ marginTop: 10 }}>+ Agregar ensayo</button>
      </div>

      <div className="tarjeta">
        <div className="fila">
          <label className="ancho-total">Observaciones generales
            <input value={form.notas} onChange={set('notas')} placeholder="ej. material caduco, validación de lote, ajuste de mantenimiento…" />
          </label>
        </div>
      </div>

      {error && <div className="error">{error}</div>}
      <div className="barra-guardar">
        <button type="submit" disabled={guardando}>{guardando ? 'Creando…' : 'Crear solicitud'}</button>
        <Link to="/solicitudes" className="boton secundario">Cancelar</Link>
      </div>
    </form>
  );
}
