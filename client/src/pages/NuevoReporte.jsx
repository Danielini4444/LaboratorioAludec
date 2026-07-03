import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../api.js';

const AREAS_SOLICITANTES = ['Control Proceso', 'Calidad', 'Producción', 'Ingeniería'];

const FORM_VACIO = {
  cliente_id: '', referencia: '', denominacion: '', proyecto: '', area_solicitante: '',
  descripcion_material: '', of: '', fecha_recepcion: '', cantidad_piezas: '', informacion_previa: ''
};

export default function NuevoReporte() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ ...FORM_VACIO });
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

  const enviar = async (e) => {
    e.preventDefault();
    setError('');
    setGuardando(true);
    try {
      const reporte = await api('/reportes', {
        method: 'POST',
        body: {
          ...form,
          cliente_id: Number(form.cliente_id),
          cantidad_piezas: form.cantidad_piezas ? Number(form.cantidad_piezas) : null,
          fecha_recepcion: form.fecha_recepcion || null
        }
      });
      navigate(`/reportes/${reporte.id}`);
    } catch (e) {
      setError(e.message);
      setGuardando(false);
    }
  };

  return (
    <form className="formulario" onSubmit={enviar}>
      <div className="encabezado-pagina">
        <h2>Nuevo reporte de ensayos</h2>
        <p className="descripcion">Se asigna el folio al guardar; las pruebas se agregan después, conforme se van terminando.</p>
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
            <input value={form.referencia} onChange={setConAutocompletado('referencia')} required list="rep-referencias" />
            <datalist id="rep-referencias">
              {piezasFiltradas.map(p => <option key={p.id} value={p.referencia}>{p.denominacion}</option>)}
            </datalist>
          </label>
          <label>Denominación
            <input value={form.denominacion} onChange={setConAutocompletado('denominacion')} required list="rep-denominaciones" />
            <datalist id="rep-denominaciones">
              {piezasFiltradas.map(p => <option key={p.id} value={p.denominacion} />)}
            </datalist>
          </label>
        </div>
        <div className="fila">
          <label>Descripción del material ensayado
            <input value={form.descripcion_material} onChange={set('descripcion_material')}
              placeholder="ej. pieza completa cromada, componente soldado…" />
          </label>
          <label>OF<input value={form.of} onChange={set('of')} placeholder="la asigna producción" /></label>
        </div>
      </div>

      <div className="tarjeta">
        <h3 className="paso"><span className="num">2</span> Solicitud y recepción</h3>
        <div className="fila">
          <label>Área solicitante
            <input value={form.area_solicitante} onChange={set('area_solicitante')} list="rep-areas" placeholder="Control Proceso, Calidad…" />
            <datalist id="rep-areas">
              {AREAS_SOLICITANTES.map(a => <option key={a} value={a} />)}
            </datalist>
          </label>
          <label>Proyecto<input value={form.proyecto} onChange={set('proyecto')} /></label>
          <label>Fecha de recepción
            <input type="date" value={form.fecha_recepcion} onChange={set('fecha_recepcion')} />
          </label>
          <label>Cantidad de piezas recibidas
            <input type="number" min="1" value={form.cantidad_piezas} onChange={set('cantidad_piezas')} />
          </label>
        </div>
        <div className="fila">
          <label className="ancho-total">Información previa
            <input value={form.informacion_previa} onChange={set('informacion_previa')}
              placeholder="ej. piezas de validación Satin Chrome SM322" />
          </label>
        </div>
      </div>

      {error && <div className="error">{error}</div>}
      <div className="barra-guardar">
        <button type="submit" disabled={guardando}>{guardando ? 'Creando…' : 'Crear reporte (asigna folio)'}</button>
        <Link to="/reportes" className="boton secundario">Cancelar</Link>
      </div>
    </form>
  );
}
