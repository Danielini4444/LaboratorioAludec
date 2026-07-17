import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../App.jsx';
import { esMetrologia } from './ReportesEnsayo.jsx';
import Cargando from '../components/Cargando.jsx';
import { useConfirmar } from '../components/Confirmar.jsx';
import { useAviso } from '../components/Aviso.jsx';
import { val } from '../validaciones.js';

const PRUEBA_VACIA = { norma: '', ensayo: '', caracteristica: '' };

// Tabla editable de pruebas de un plan (la usan el alta y la edición).
function EditorFilas({ pruebas, onCambio }) {
  const setPrueba = (i, campo, valor) =>
    onCambio(pruebas.map((p, j) => (j === i ? { ...p, [campo]: valor } : p)));
  const agregarFila = () => onCambio([...pruebas, { ...PRUEBA_VACIA }]);
  const quitarFila = (i) => { if (pruebas.length > 1) onCambio(pruebas.filter((_, j) => j !== i)); };

  return (
    <>
      <div className="tabla-scroll">
        <table className="tabla mediciones">
          <thead>
            <tr>
              <th style={{ width: 28 }}>#</th>
              <th>Ensayo realizado</th>
              <th>Norma / apartado</th>
              <th>Característica a evaluar</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {pruebas.map((p, i) => (
              <tr key={i}>
                <td>{i + 1}</td>
                <td>
                  <input style={{ width: '100%' }} value={p.ensayo} onChange={e => setPrueba(i, 'ensayo', e.target.value)}
                    {...val('nombreCatalogo')} placeholder="ej. Stone Chip, Corrosión CASS" />
                </td>
                <td>
                  <input style={{ width: '100%' }} value={p.norma} onChange={e => setPrueba(i, 'norma', e.target.value)}
                    {...val('norma')} placeholder="(igual a la del plan)" />
                </td>
                <td>
                  <input style={{ width: '100%' }} value={p.caracteristica} onChange={e => setPrueba(i, 'caracteristica', e.target.value)}
                    placeholder="criterio de aceptación" />
                </td>
                <td>
                  <button type="button" className="btn-quitar-fila" title="Quitar"
                    onClick={() => quitarFila(i)}>×</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="acciones">
        <button type="button" className="secundario chico" onClick={agregarFila}>+ Agregar prueba</button>
      </div>
    </>
  );
}

// Edición de un plan existente: misma tabla del alta, precargada; al guardar
// se reemplaza el plan completo (permite renombrar la norma, agregar,
// modificar y quitar pruebas).
function EditorPlan({ grupo, onGuardado, onCancelar }) {
  const [norma, setNorma] = useState(grupo.plan_norma || '');
  const [pruebas, setPruebas] = useState(grupo.pruebas.map(p => ({
    norma: p.norma || '', ensayo: p.ensayo || '', caracteristica: p.caracteristica || ''
  })));
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  const guardar = async (e) => {
    e.preventDefault();
    setError('');
    setGuardando(true);
    try {
      const r = await api(`/planes/${grupo.cliente_id}?plan_norma=${encodeURIComponent(grupo.plan_norma)}`, {
        method: 'PUT',
        body: { plan_norma: norma, pruebas }
      });
      onGuardado(r);
    } catch (e) {
      setError(e.message);
      setGuardando(false);
    }
  };

  return (
    <form className="formulario" onSubmit={guardar}>
      <div className="fila" style={{ marginTop: 10 }}>
        <label>Norma del plan
          <input value={norma} onChange={e => setNorma(e.target.value)} required {...val('norma')} />
        </label>
      </div>
      <EditorFilas pruebas={pruebas} onCambio={setPruebas} />
      {error && <div className="error">{error}</div>}
      <div className="acciones" style={{ marginTop: 10 }}>
        <button type="submit" disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar cambios'}</button>
        <button type="button" className="secundario" onClick={onCancelar}>Cancelar</button>
      </div>
    </form>
  );
}

export default function PlanesPrueba() {
  const { user } = useAuth();
  const [params] = useSearchParams();
  const puedeEditar = esMetrologia(user);

  const [planes, setPlanes] = useState(null);
  const [clientes, setClientes] = useState([]);
  const [error, setError] = useState('');
  const [editando, setEditando] = useState(null); // clave cliente|norma del plan en edición
  const [confirmar, dialogoConfirmar] = useConfirmar();
  const [avisar, vistaAviso] = useAviso();

  // formulario de nuevo plan
  const [clienteId, setClienteId] = useState(params.get('cliente_id') || '');
  const [planNorma, setPlanNorma] = useState('');
  const [pruebas, setPruebas] = useState([{ ...PRUEBA_VACIA }]);
  const [guardando, setGuardando] = useState(false);

  const cargar = () => api('/planes').then(setPlanes).catch(e => setError(e.message));
  useEffect(() => { cargar(); }, []);
  useEffect(() => { api('/clientes').then(setClientes).catch(() => {}); }, []);

  // agrupar por cliente + norma del plan para listarlos
  const grupos = useMemo(() => {
    const m = new Map();
    for (const p of planes || []) {
      const clave = `${p.cliente_id}|${p.plan_norma}`;
      if (!m.has(clave)) m.set(clave, { cliente_id: p.cliente_id, cliente_nombre: p.cliente_nombre, plan_norma: p.plan_norma, pruebas: [] });
      m.get(clave).pruebas.push(p);
    }
    return [...m.values()];
  }, [planes]);

  const guardar = async (e) => {
    e.preventDefault();
    setError('');
    setGuardando(true);
    try {
      const r = await api('/planes', {
        method: 'POST',
        body: { cliente_id: Number(clienteId), plan_norma: planNorma, pruebas }
      });
      avisar(`Plan "${r.plan_norma}" creado con ${r.pruebas} pruebas`, 'ok');
      setPlanNorma('');
      setPruebas([{ ...PRUEBA_VACIA }]);
      cargar();
    } catch (e) {
      setError(e.message);
    } finally {
      setGuardando(false);
    }
  };

  const borrar = async (g) => {
    if (!await confirmar({
      titulo: 'Borrar plan',
      mensaje: `¿Borrar el plan "${g.plan_norma}" de ${g.cliente_nombre} (${g.pruebas.length} pruebas)? No afecta a los reportes ya creados.`,
      textoConfirmar: 'Borrar', peligro: true
    })) return;
    try {
      await api(`/planes/${g.cliente_id}?plan_norma=${encodeURIComponent(g.plan_norma)}`, { method: 'DELETE' });
      cargar();
    } catch (e) { avisar(e.message); }
  };

  if (planes === null && !error) return <Cargando />;

  return (
    <div>
      <div className="encabezado-pagina">
        <h2>Planes de prueba de cromado</h2>
        <p className="descripcion">
          Las pruebas que por defecto lleva la validación de cromado de cada cliente. Se precargan al reporte y el analista las completa.
        </p>
      </div>

      {error && <div className="error">{error}</div>}

      {puedeEditar && (
        <form className="tarjeta formulario" onSubmit={guardar}>
          <h3>Nuevo plan</h3>
          <div className="fila">
            <label>Cliente
              <select value={clienteId} onChange={e => setClienteId(e.target.value)} required>
                <option value="">— elegir —</option>
                {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </label>
            <label>Norma del plan
              <input value={planNorma} onChange={e => setPlanNorma(e.target.value)}
                required {...val('norma')} placeholder="ej. GMW 14668, PS.50014" />
            </label>
          </div>

          <h4 className="sub-seccion">Pruebas del plan</h4>
          <EditorFilas pruebas={pruebas} onCambio={setPruebas} />

          <div className="barra-guardar">
            <button type="submit" disabled={guardando}>{guardando ? 'Guardando…' : 'Crear plan'}</button>
          </div>
        </form>
      )}

      <h3>Planes existentes <span className="conteo">({grupos.length})</span></h3>
      {!grupos.length && <div className="vacio">Todavía no hay planes cargados.</div>}
      {grupos.map(g => {
        const clave = `${g.cliente_id}|${g.plan_norma}`;
        const enEdicion = editando === clave;
        return (
          <div className="tarjeta" key={clave}>
            <div className="ensayo-titulo">
              <strong>{g.cliente_nombre}</strong>
              <span className="badge">{g.plan_norma || 'sin norma'}</span>
              <span className="meta">{g.pruebas.length} pruebas</span>
              {puedeEditar && !enEdicion && (
                <span className="acciones">
                  <button className="chico" onClick={() => setEditando(clave)}>Editar</button>
                  <button className="chico secundario peligro" onClick={() => borrar(g)}>Borrar</button>
                </span>
              )}
            </div>
            {enEdicion ? (
              <EditorPlan
                grupo={g}
                onGuardado={(r) => {
                  setEditando(null);
                  avisar(`Plan "${r.plan_norma}" actualizado (${r.pruebas} pruebas)`, 'ok');
                  cargar();
                }}
                onCancelar={() => setEditando(null)}
              />
            ) : (
              <table className="tabla mediciones" style={{ marginTop: 10 }}>
                <thead>
                  <tr><th>#</th><th>Ensayo</th><th>Norma</th><th>Característica</th></tr>
                </thead>
                <tbody>
                  {g.pruebas.map(p => (
                    <tr key={p.id}>
                      <td>{p.orden}</td>
                      <td>{p.ensayo}</td>
                      <td>{p.norma || '—'}</td>
                      <td>{p.caracteristica || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        );
      })}

      {dialogoConfirmar}
      {vistaAviso}
    </div>
  );
}
