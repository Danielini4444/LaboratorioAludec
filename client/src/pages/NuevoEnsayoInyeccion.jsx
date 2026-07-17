import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../api.js';
import { val } from '../validaciones.js';

const FORM_VACIO = {
  cliente_id: '', referencia: '', denominacion: '', solicitante: '', informacion_previa: ''
};

export default function NuevoEnsayoInyeccion() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ ...FORM_VACIO });
  const [ofs, setOfs] = useState([]);          // OF/lote: varias o ninguna
  const [ofActual, setOfActual] = useState('');
  const [clientes, setClientes] = useState([]);
  const [piezas, setPiezas] = useState([]);
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    api('/clientes').then(setClientes).catch(() => {});
    api('/piezas').then(ps => setPiezas(ps.filter(p => p.activa))).catch(() => {});
  }, []);

  const set = (campo) => (e) => setForm({ ...form, [campo]: e.target.value });

  const piezasFiltradas = form.cliente_id
    ? piezas.filter(p => String(p.cliente_id) === form.cliente_id)
    : piezas;

  // Escribir la referencia llena la denominación (y viceversa) desde el catálogo.
  const setConAutocompletado = (campo) => (e) => {
    const valor = e.target.value;
    const pieza = piezasFiltradas.find(p => p[campo].toLowerCase() === valor.toLowerCase());
    if (pieza) {
      setForm(f => ({
        ...f, [campo]: valor,
        referencia: pieza.referencia,
        denominacion: pieza.denominacion,
        cliente_id: String(pieza.cliente_id)
      }));
    } else {
      setForm(f => ({ ...f, [campo]: valor }));
    }
  };

  const agregarOf = () => {
    const of = ofActual.trim();
    if (!of) return;
    if (!ofs.includes(of)) setOfs([...ofs, of]);
    setOfActual('');
  };

  const quitarOf = (of) => setOfs(ofs.filter(o => o !== of));

  const enviar = async (e) => {
    e.preventDefault();
    setError('');
    setGuardando(true);
    try {
      // si quedó una OF escrita sin agregar, se incluye también
      const pendiente = ofActual.trim();
      const todas = pendiente && !ofs.includes(pendiente) ? [...ofs, pendiente] : ofs;
      const ensayo = await api('/ensayos-inyeccion', {
        method: 'POST',
        body: { ...form, cliente_id: Number(form.cliente_id), ofs: todas }
      });
      navigate(`/inyeccion/${ensayo.id}`);
    } catch (e) {
      setError(e.message);
      setGuardando(false);
    }
  };

  return (
    <form className="formulario" onSubmit={enviar}>
      <div className="encabezado-pagina">
        <h2>Nuevo ensayo de inyección</h2>
        <p className="descripcion">Se asigna el No. de ensayo al guardar; los ensayos se agregan después, conforme se van terminando.</p>
      </div>

      <div className="tarjeta">
        <h3 className="paso"><span className="num">1</span> Identificación de la pieza</h3>
        <div className="fila">
          <label>Cliente
            <select value={form.cliente_id} onChange={set('cliente_id')} required>
              <option value="">— elegir —</option>
              {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </label>
          <label>Referencia
            <input value={form.referencia} onChange={setConAutocompletado('referencia')} required {...val('referencia')} list="iny-referencias" />
            <datalist id="iny-referencias">
              {piezasFiltradas.map(p => <option key={p.id} value={p.referencia}>{p.denominacion}</option>)}
            </datalist>
          </label>
          <label>Denominación
            <input value={form.denominacion} onChange={setConAutocompletado('denominacion')} required {...val('denominacion')} list="iny-denominaciones" />
            <datalist id="iny-denominaciones">
              {piezasFiltradas.map(p => <option key={p.id} value={p.denominacion} />)}
            </datalist>
          </label>
        </div>
        <div className="fila">
          <label>OF / Lote (opcional, pueden ser varias)
            <span style={{ display: 'flex', gap: 8 }}>
              <input value={ofActual} onChange={e => setOfActual(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); agregarOf(); } }}
                placeholder="escribe una OF o lote y agrégala" />
              <button type="button" className="secundario" onClick={agregarOf} disabled={!ofActual.trim()}>Agregar</button>
            </span>
            {!!ofs.length && (
              <span className="acciones" style={{ marginTop: 6 }}>
                {ofs.map(of => (
                  <button key={of} type="button" className="chico secundario" title="Quitar"
                    onClick={() => quitarOf(of)}>{of} ×</button>
                ))}
              </span>
            )}
          </label>
        </div>
      </div>

      <div className="tarjeta">
        <h3 className="paso"><span className="num">2</span> Solicitud</h3>
        <div className="fila">
          <label>Solicitante
            <input value={form.solicitante} onChange={set('solicitante')} placeholder="quién solicita el ensayo" />
          </label>
        </div>
        <div className="fila">
          <label className="ancho-total">Información previa
            <input value={form.informacion_previa} onChange={set('informacion_previa')}
              placeholder="ej. piezas de validación de molde nuevo" />
          </label>
        </div>
      </div>

      {error && <div className="error">{error}</div>}
      <div className="barra-guardar">
        <button type="submit" disabled={guardando}>{guardando ? 'Creando…' : 'Crear ensayo (asigna No.)'}</button>
        <Link to="/inyeccion" className="boton secundario">Cancelar</Link>
      </div>
    </form>
  );
}
