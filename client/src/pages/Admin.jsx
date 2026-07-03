import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useAuth, ROLES_NOMBRE } from '../App.jsx';
import { CAMPOS_NORMA, textoLimite } from '../especs.js';

const ROLES_DE_AREA = ['admin_area', 'usuario_area'];

function Usuarios({ soloLectura }) {
  const [usuarios, setUsuarios] = useState([]);
  const [areas, setAreas] = useState([]);
  const [form, setForm] = useState({ usuario: '', nombre: '', password: '', rol: 'usuario_area', area_id: '' });
  const [error, setError] = useState('');

  const cargar = () => api('/usuarios').then(setUsuarios).catch(() => {});
  useEffect(() => {
    cargar();
    api('/areas').then(setAreas).catch(() => {});
  }, []);

  const set = (campo) => (e) => setForm({ ...form, [campo]: e.target.value });
  const esDeArea = ROLES_DE_AREA.includes(form.rol);

  const crear = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api('/usuarios', {
        method: 'POST',
        body: { ...form, area_id: esDeArea ? Number(form.area_id) : null }
      });
      setForm({ usuario: '', nombre: '', password: '', rol: 'usuario_area', area_id: '' });
      cargar();
    } catch (e) { setError(e.message); }
  };

  const alternarActivo = async (u) => {
    try {
      await api(`/usuarios/${u.id}`, { method: 'PUT', body: { activo: !u.activo } });
      cargar();
    } catch (e) { alert(e.message); }
  };

  const resetPassword = async (u) => {
    const nueva = prompt(`Nueva contraseña para ${u.usuario} (mínimo 6 caracteres):`);
    if (!nueva) return;
    try {
      await api(`/usuarios/${u.id}`, { method: 'PUT', body: { password: nueva } });
      alert('Contraseña actualizada');
    } catch (e) { alert(e.message); }
  };

  return (
    <div>
      {!soloLectura && (
        <form className="tarjeta formulario" onSubmit={crear}>
          <h3>Nuevo usuario</h3>
          <div className="fila">
            <label>Usuario<input value={form.usuario} onChange={set('usuario')} required /></label>
            <label>Nombre<input value={form.nombre} onChange={set('nombre')} required /></label>
            <label>Contraseña<input type="password" value={form.password} onChange={set('password')} required minLength={6} /></label>
            <label>Rol
              <select value={form.rol} onChange={set('rol')}>
                {Object.entries(ROLES_NOMBRE).map(([v, n]) => <option key={v} value={v}>{n}</option>)}
              </select>
            </label>
            {esDeArea && (
              <label>Área
                <select value={form.area_id} onChange={set('area_id')} required>
                  <option value="">— elegir —</option>
                  {areas.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
                </select>
              </label>
            )}
          </div>
          {error && <div className="error">{error}</div>}
          <button type="submit">Crear usuario</button>
        </form>
      )}
      <table className="tabla">
        <thead><tr><th>Usuario</th><th>Nombre</th><th>Rol</th><th>Área</th><th>Estado</th>{!soloLectura && <th></th>}</tr></thead>
        <tbody>
          {usuarios.map(u => (
            <tr key={u.id} className={u.activo ? '' : 'inactivo'}>
              <td>{u.usuario}</td>
              <td>{u.nombre}</td>
              <td>{ROLES_NOMBRE[u.rol]}</td>
              <td>{u.area_nombre || '—'}</td>
              <td>{u.activo ? 'Activo' : 'Inactivo'}</td>
              {!soloLectura && (
                <td className="acciones">
                  <button className="chico secundario" onClick={() => alternarActivo(u)}>
                    {u.activo ? 'Desactivar' : 'Activar'}
                  </button>
                  <button className="chico secundario" onClick={() => resetPassword(u)}>Contraseña</button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Piezas({ soloLectura }) {
  const [piezas, setPiezas] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [filtroCliente, setFiltroCliente] = useState('');
  const [form, setForm] = useState({ referencia: '', denominacion: '', cliente_id: '' });
  const [error, setError] = useState('');

  const cargar = (q = busqueda, cid = filtroCliente) =>
    api(`/piezas?q=${encodeURIComponent(q)}&cliente_id=${cid}`).then(setPiezas).catch(() => {});
  useEffect(() => { cargar(); }, [filtroCliente]);
  useEffect(() => {
    api('/clientes').then(setClientes).catch(() => {});
  }, []);

  const set = (campo) => (e) => setForm({ ...form, [campo]: e.target.value });

  const crear = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api('/piezas', { method: 'POST', body: { ...form, cliente_id: Number(form.cliente_id) } });
      setForm({ referencia: '', denominacion: '', cliente_id: '' });
      cargar();
    } catch (e) { setError(e.message); }
  };

  const cambiarCliente = async (pieza, clienteId) => {
    try {
      await api(`/piezas/${pieza.id}`, { method: 'PUT', body: { cliente_id: Number(clienteId) } });
      cargar();
    } catch (e) { alert(e.message); }
  };

  const alternarActiva = async (pieza) => {
    try {
      await api(`/piezas/${pieza.id}`, { method: 'PUT', body: { activa: !pieza.activa } });
      cargar();
    } catch (e) { alert(e.message); }
  };

  return (
    <div>
      {!soloLectura && (
        <form className="tarjeta formulario" onSubmit={crear}>
          <h3>Nueva pieza</h3>
          <div className="fila">
            <label>Referencia<input value={form.referencia} onChange={set('referencia')} required /></label>
            <label>Denominación<input value={form.denominacion} onChange={set('denominacion')} required /></label>
            <label>Cliente
              <select value={form.cliente_id} onChange={set('cliente_id')} required>
                <option value="">— elegir —</option>
                {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </label>
          </div>
          {error && <div className="error">{error}</div>}
          <button type="submit">Agregar pieza</button>
        </form>
      )}
      <div className="barra-busqueda">
        <select value={filtroCliente} onChange={e => setFiltroCliente(e.target.value)}>
          <option value="">Todos los clientes</option>
          {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>
        <input
          placeholder="Buscar por referencia o denominación…"
          value={busqueda}
          onChange={e => { setBusqueda(e.target.value); cargar(e.target.value); }}
        />
        <span className="meta">{piezas.length} pieza(s)</span>
      </div>
      <table className="tabla">
        <thead><tr><th>Referencia</th><th>Denominación</th><th>Cliente</th><th>Estado</th>{!soloLectura && <th></th>}</tr></thead>
        <tbody>
          {piezas.map(p => (
            <tr key={p.id} className={p.activa ? '' : 'inactivo'}>
              <td>{p.referencia}</td>
              <td>{p.denominacion}</td>
              <td>
                {soloLectura ? p.cliente_nombre : (
                  <select value={p.cliente_id} onChange={e => cambiarCliente(p, e.target.value)}>
                    {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                  </select>
                )}
              </td>
              <td>{p.activa ? 'Activa' : 'Inactiva'}</td>
              {!soloLectura && (
                <td>
                  <button className="chico secundario" onClick={() => alternarActiva(p)}>
                    {p.activa ? 'Desactivar' : 'Activar'}
                  </button>
                </td>
              )}
            </tr>
          ))}
          {!piezas.length && <tr><td colSpan="5" className="vacio">Sin piezas</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function Equipos({ soloLectura }) {
  const [equipos, setEquipos] = useState([]);
  const [form, setForm] = useState({ nombre: '', referencia_interna: '', fecha_calibracion: '' });
  const [error, setError] = useState('');

  const cargar = () => api('/equipos').then(setEquipos).catch(() => {});
  useEffect(() => { cargar(); }, []);

  const set = (campo) => (e) => setForm({ ...form, [campo]: e.target.value });

  const crear = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api('/equipos', {
        method: 'POST',
        body: { ...form, fecha_calibracion: form.fecha_calibracion || null, referencia_interna: form.referencia_interna || null }
      });
      setForm({ nombre: '', referencia_interna: '', fecha_calibracion: '' });
      cargar();
    } catch (e) { setError(e.message); }
  };

  const actualizar = async (id, cambios) => {
    try {
      await api(`/equipos/${id}`, { method: 'PUT', body: cambios });
      cargar();
    } catch (e) { alert(e.message); }
  };

  return (
    <div>
      {!soloLectura && (
        <form className="tarjeta formulario" onSubmit={crear}>
          <h3>Nuevo equipo</h3>
          <div className="fila">
            <label>Nombre<input value={form.nombre} onChange={set('nombre')} required /></label>
            <label>ID interno<input value={form.referencia_interna} onChange={set('referencia_interna')} placeholder="LM-INS-001" /></label>
            <label>Última calibración<input type="date" value={form.fecha_calibracion} onChange={set('fecha_calibracion')} /></label>
          </div>
          {error && <div className="error">{error}</div>}
          <button type="submit">Agregar equipo</button>
        </form>
      )}
      <table className="tabla">
        <thead><tr><th>Equipo</th><th>ID interno</th><th>Última calibración</th><th>Estado</th>{!soloLectura && <th></th>}</tr></thead>
        <tbody>
          {equipos.map(q => (
            <tr key={q.id} className={q.activo ? '' : 'inactivo'}>
              <td>{q.nombre}</td>
              <td>{q.referencia_interna || '—'}</td>
              <td>
                {soloLectura ? (q.fecha_calibracion ? new Date(q.fecha_calibracion).toLocaleDateString('es-MX') : '—') : (
                  <input
                    type="date"
                    defaultValue={q.fecha_calibracion ? q.fecha_calibracion.slice(0, 10) : ''}
                    onBlur={e => { if (e.target.value && e.target.value !== (q.fecha_calibracion || '').slice(0, 10)) actualizar(q.id, { fecha_calibracion: e.target.value }); }}
                  />
                )}
              </td>
              <td>{q.activo ? 'Activo' : 'Inactivo'}</td>
              {!soloLectura && (
                <td>
                  <button className="chico secundario" onClick={() => actualizar(q.id, { activo: !q.activo })}>
                    {q.activo ? 'Desactivar' : 'Activar'}
                  </button>
                </td>
              )}
            </tr>
          ))}
          {!equipos.length && <tr><td colSpan="5" className="vacio">Sin equipos</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function FormNorma({ espec, clientes, onGuardada, onCancelar }) {
  const [clienteId, setClienteId] = useState(espec ? String(espec.cliente_id) : '');
  const [norma, setNorma] = useState(espec ? espec.norma : '');
  const [limites, setLimites] = useState(() => {
    const base = {};
    for (const [clave] of CAMPOS_NORMA) {
      const l = (espec && espec.limites[clave]) || {};
      base[clave] = { min: l.min ?? '', max: l.max ?? '', min_pct: l.min_pct ?? '', max_pct: l.max_pct ?? '' };
    }
    return base;
  });
  const [error, setError] = useState('');

  const setLim = (clave, extremo, v) =>
    setLimites(ls => ({ ...ls, [clave]: { ...ls[clave], [extremo]: v } }));

  const enviar = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const cuerpo = { cliente_id: Number(clienteId), norma, limites };
      if (espec) await api(`/especificaciones/${espec.id}`, { method: 'PUT', body: cuerpo });
      else await api('/especificaciones', { method: 'POST', body: cuerpo });
      onGuardada();
    } catch (e) { setError(e.message); }
  };

  return (
    <form className="tarjeta formulario" onSubmit={enviar}>
      <h3>{espec ? `${espec.cliente_nombre} — ${espec.norma}` : 'Nueva norma'}</h3>
      <div className="fila">
        <label>Cliente
          <select value={clienteId} onChange={e => setClienteId(e.target.value)} required disabled={!!espec}>
            <option value="">— elegir —</option>
            {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </label>
        <label>Norma<input value={norma} onChange={e => setNorma(e.target.value)} required /></label>
      </div>
      <table className="tabla mediciones">
        <thead>
          <tr>
            <th>Medición</th><th>Mínimo</th><th>Máximo</th>
            <th>Mín. % del Ni total</th><th>Máx. % del Ni total</th>
          </tr>
        </thead>
        <tbody>
          {CAMPOS_NORMA.map(([clave, etiqueta, unidad, admitePct]) => (
            <tr key={clave}>
              <td>{etiqueta} ({unidad})</td>
              <td><input type="number" step="any" value={limites[clave].min} onChange={e => setLim(clave, 'min', e.target.value)} /></td>
              <td><input type="number" step="any" value={limites[clave].max} onChange={e => setLim(clave, 'max', e.target.value)} /></td>
              <td>{admitePct ? <input type="number" step="any" value={limites[clave].min_pct} onChange={e => setLim(clave, 'min_pct', e.target.value)} /> : '—'}</td>
              <td>{admitePct ? <input type="number" step="any" value={limites[clave].max_pct} onChange={e => setLim(clave, 'max_pct', e.target.value)} /> : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="meta">Vacío = sin límite (N/E). Los porcentajes se evalúan contra el Ni total del punto de medición del STEP.</div>
      {error && <div className="error">{error}</div>}
      <div className="acciones">
        <button type="submit">Guardar norma</button>
        <button type="button" className="secundario" onClick={onCancelar}>Cancelar</button>
      </div>
    </form>
  );
}

function Normas({ soloLectura }) {
  const [especs, setEspecs] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [editando, setEditando] = useState(null); // null | 'nueva' | espec

  const cargar = () => api('/especificaciones?todas=1').then(setEspecs).catch(() => {});
  useEffect(() => {
    cargar();
    api('/clientes').then(setClientes).catch(() => {});
  }, []);

  const alternarActiva = async (e) => {
    try {
      await api(`/especificaciones/${e.id}`, { method: 'PUT', body: { activa: !e.activa } });
      cargar();
    } catch (err) { alert(err.message); }
  };

  const resumen = (e) => CAMPOS_NORMA
    .filter(([clave]) => e.limites[clave])
    .map(([clave, etiqueta]) => `${etiqueta}: ${textoLimite(e.limites, clave)}`)
    .join('  ·  ');

  return (
    <div>
      {editando && (
        <FormNorma
          espec={editando === 'nueva' ? null : editando}
          clientes={clientes}
          onGuardada={() => { setEditando(null); cargar(); }}
          onCancelar={() => setEditando(null)}
        />
      )}
      {!soloLectura && !editando && (
        <div className="barra-busqueda">
          <button onClick={() => setEditando('nueva')}>Nueva norma</button>
        </div>
      )}
      {especs.map(e => (
        <div className="tarjeta" key={e.id}>
          <div className="ensayo-titulo">
            <strong>{e.cliente_nombre}</strong> · {e.norma}
            {!e.activa && <span className="badge mal">Inactiva</span>}
            {!soloLectura && (
              <span className="acciones">
                <button className="chico" onClick={() => setEditando(e)}>Editar</button>
                <button className="chico secundario" onClick={() => alternarActiva(e)}>
                  {e.activa ? 'Desactivar' : 'Activar'}
                </button>
              </span>
            )}
          </div>
          <div className="meta">{resumen(e) || 'sin límites definidos'}</div>
        </div>
      ))}
      {!especs.length && <div className="vacio">Sin normas registradas</div>}
    </div>
  );
}

function ListaSimple({ recurso, titulo, soloLectura }) {
  const [items, setItems] = useState([]);
  const [nombre, setNombre] = useState('');
  const [error, setError] = useState('');

  const cargar = () => api(`/${recurso}`).then(setItems).catch(() => {});
  useEffect(() => { cargar(); }, [recurso]);

  const crear = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api(`/${recurso}`, { method: 'POST', body: { nombre } });
      setNombre('');
      cargar();
    } catch (e) { setError(e.message); }
  };

  return (
    <div>
      {!soloLectura && (
        <form className="tarjeta formulario" onSubmit={crear}>
          <h3>{titulo}</h3>
          <div className="fila">
            <label>Nombre<input value={nombre} onChange={e => setNombre(e.target.value)} required /></label>
          </div>
          {error && <div className="error">{error}</div>}
          <button type="submit">Agregar</button>
        </form>
      )}
      <table className="tabla">
        <thead><tr><th>Nombre</th></tr></thead>
        <tbody>
          {items.map(i => <tr key={i.id}><td>{i.nombre}{i.activa === false ? ' (inactiva)' : ''}</td></tr>)}
          {!items.length && <tr><td className="vacio">Vacío</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

export default function Admin() {
  const { user } = useAuth();
  const [tab, setTab] = useState('usuarios');
  const soloLectura = user.rol !== 'admin';

  return (
    <div>
      <div className="encabezado-pagina">
        <h2>Administración {soloLectura && <span className="badge">solo lectura</span>}</h2>
        <p className="descripcion">Usuarios del sistema, catálogo de piezas, normas por cliente y clientes.</p>
      </div>
      <div className="tabs">
        {['usuarios', 'piezas', 'normas', 'equipos', 'clientes'].map(t => (
          <button key={t} className={tab === t ? 'tab activo' : 'tab'} onClick={() => setTab(t)}>
            {t[0].toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>
      {tab === 'usuarios' && <Usuarios soloLectura={soloLectura} />}
      {tab === 'piezas' && <Piezas soloLectura={soloLectura} />}
      {tab === 'normas' && <Normas soloLectura={soloLectura} />}
      {tab === 'equipos' && <Equipos soloLectura={soloLectura} />}
      {tab === 'clientes' && <ListaSimple recurso="clientes" titulo="Nuevo cliente" soloLectura={soloLectura} />}
    </div>
  );
}
