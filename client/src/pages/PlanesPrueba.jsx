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

export default function PlanesPrueba() {
  const { user } = useAuth();
  const [params] = useSearchParams();
  const puedeEditar = esMetrologia(user);

  const [planes, setPlanes] = useState(null);
  const [clientes, setClientes] = useState([]);
  const [error, setError] = useState('');
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

  const setPrueba = (i, campo, valor) =>
    setPruebas(ps => ps.map((p, j) => (j === i ? { ...p, [campo]: valor } : p)));
  const agregarFila = () => setPruebas(ps => [...ps, { ...PRUEBA_VACIA }]);
  const quitarFila = (i) => setPruebas(ps => (ps.length > 1 ? ps.filter((_, j) => j !== i) : ps));

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

          <div className="barra-guardar">
            <button type="submit" disabled={guardando}>{guardando ? 'Guardando…' : 'Crear plan'}</button>
          </div>
        </form>
      )}

      <h3>Planes existentes <span className="conteo">({grupos.length})</span></h3>
      {!grupos.length && <div className="vacio">Todavía no hay planes cargados.</div>}
      {grupos.map(g => (
        <div className="tarjeta" key={`${g.cliente_id}|${g.plan_norma}`}>
          <div className="ensayo-titulo">
            <strong>{g.cliente_nombre}</strong>
            <span className="badge">{g.plan_norma || 'sin norma'}</span>
            <span className="meta">{g.pruebas.length} pruebas</span>
            {puedeEditar && (
              <span className="acciones">
                <button className="chico secundario peligro" onClick={() => borrar(g)}>Borrar</button>
              </span>
            )}
          </div>
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
        </div>
      ))}

      {dialogoConfirmar}
      {vistaAviso}
    </div>
  );
}
