import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useAuth, ROLES_NOMBRE } from '../App.jsx';
import { CAMPOS_NORMA, textoLimite } from '../especs.js';
import { textoRangoCapa } from '../especsPintura.js';
import { val, cumple } from '../validaciones.js';

const CAPA_VACIA = { nombre: '', espesor_min: '', espesor_max: '' };

const ROLES_DE_AREA = ['admin_area', 'usuario_area'];

function Usuarios({ soloLectura }) {
  const [usuarios, setUsuarios] = useState([]);
  const [areas, setAreas] = useState([]);
  const [form, setForm] = useState({ usuario: '', nombre: '', password: '', rol: 'usuario_area', area_id: '' });
  const [error, setError] = useState('');
  const [editando, setEditando] = useState(null); // id del usuario en edición
  const [formEdicion, setFormEdicion] = useState({ nombre: '', rol: '', area_id: '' });

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

  const empezarEdicion = (u) => {
    setEditando(u.id);
    setFormEdicion({ nombre: u.nombre, rol: u.rol, area_id: u.area_id ? String(u.area_id) : '' });
  };

  const setEd = (campo) => (e) => setFormEdicion({ ...formEdicion, [campo]: e.target.value });

  const guardarEdicion = async (u) => {
    const esArea = ROLES_DE_AREA.includes(formEdicion.rol);
    if (!cumple('nombrePersona', formEdicion.nombre.trim())) return alert('Nombre: de 3 a 60 caracteres, solo letras, espacios y guiones');
    if (esArea && !formEdicion.area_id) return alert('Los roles de área requieren un área asignada');
    try {
      await api(`/usuarios/${u.id}`, {
        method: 'PUT',
        body: { nombre: formEdicion.nombre.trim(), rol: formEdicion.rol, area_id: esArea ? Number(formEdicion.area_id) : null }
      });
      setEditando(null);
      cargar();
    } catch (e) { alert(e.message); }
  };

  const resetPassword = async (u) => {
    const nueva = prompt(`Nueva contraseña para ${u.usuario} (mínimo 6 caracteres):`);
    if (!nueva) return;
    if (!cumple('password', nueva)) return alert('La contraseña debe tener al menos 6 caracteres y no llevar espacios');
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
            <label>Usuario<input value={form.usuario} onChange={set('usuario')} required {...val('usuario')} /></label>
            <label>Nombre<input value={form.nombre} onChange={set('nombre')} required {...val('nombrePersona')} /></label>
            <label>Contraseña<input type="password" value={form.password} onChange={set('password')} required {...val('password')} /></label>
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
            editando === u.id ? (
              <tr key={u.id}>
                <td>{u.usuario}</td>
                <td><input value={formEdicion.nombre} onChange={setEd('nombre')} /></td>
                <td>
                  <select value={formEdicion.rol} onChange={setEd('rol')}>
                    {Object.entries(ROLES_NOMBRE).map(([v, n]) => <option key={v} value={v}>{n}</option>)}
                  </select>
                </td>
                <td>
                  {ROLES_DE_AREA.includes(formEdicion.rol) ? (
                    <select value={formEdicion.area_id} onChange={setEd('area_id')}>
                      <option value="">— elegir —</option>
                      {areas.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
                    </select>
                  ) : '—'}
                </td>
                <td>{u.activo ? 'Activo' : 'Inactivo'}</td>
                <td className="acciones">
                  <button className="chico" onClick={() => guardarEdicion(u)}>Guardar</button>
                  <button className="chico secundario" onClick={() => setEditando(null)}>Cancelar</button>
                </td>
              </tr>
            ) : (
              <tr key={u.id} className={u.activo ? '' : 'inactivo'}>
                <td>{u.usuario}</td>
                <td>{u.nombre}</td>
                <td>{ROLES_NOMBRE[u.rol]}</td>
                <td>{u.area_nombre || '—'}</td>
                <td>{u.activo ? 'Activo' : 'Inactivo'}</td>
                {!soloLectura && (
                  <td className="acciones">
                    <button className="chico" onClick={() => empezarEdicion(u)}>Editar</button>
                    <button className="chico secundario" onClick={() => alternarActivo(u)}>
                      {u.activo ? 'Desactivar' : 'Activar'}
                    </button>
                    <button className="chico secundario" onClick={() => resetPassword(u)}>Contraseña</button>
                  </td>
                )}
              </tr>
            )
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
  const [editando, setEditando] = useState(null); // id de la pieza en edición
  const [formEdicion, setFormEdicion] = useState({ referencia: '', denominacion: '', cliente_id: '' });

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

  const empezarEdicion = (p) => {
    setEditando(p.id);
    setFormEdicion({ referencia: p.referencia, denominacion: p.denominacion, cliente_id: String(p.cliente_id) });
  };

  const setEd = (campo) => (e) => setFormEdicion({ ...formEdicion, [campo]: e.target.value });

  const guardarEdicion = async (p) => {
    if (!cumple('referencia', formEdicion.referencia.trim())) return alert('Referencia: de 2 a 30 caracteres — letras, números, espacios, puntos o guiones');
    if (!cumple('denominacion', formEdicion.denominacion.trim())) return alert('Denominación: de 2 a 80 caracteres');
    try {
      await api(`/piezas/${p.id}`, {
        method: 'PUT',
        body: {
          referencia: formEdicion.referencia.trim(),
          denominacion: formEdicion.denominacion.trim(),
          cliente_id: Number(formEdicion.cliente_id)
        }
      });
      setEditando(null);
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
            <label>Referencia<input value={form.referencia} onChange={set('referencia')} required {...val('referencia')} /></label>
            <label>Denominación<input value={form.denominacion} onChange={set('denominacion')} required {...val('denominacion')} /></label>
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
            editando === p.id ? (
              <tr key={p.id}>
                <td><input value={formEdicion.referencia} onChange={setEd('referencia')} /></td>
                <td><input value={formEdicion.denominacion} onChange={setEd('denominacion')} /></td>
                <td>
                  <select value={formEdicion.cliente_id} onChange={setEd('cliente_id')}>
                    {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                  </select>
                </td>
                <td>{p.activa ? 'Activa' : 'Inactiva'}</td>
                <td className="acciones">
                  <button className="chico" onClick={() => guardarEdicion(p)}>Guardar</button>
                  <button className="chico secundario" onClick={() => setEditando(null)}>Cancelar</button>
                </td>
              </tr>
            ) : (
              <tr key={p.id} className={p.activa ? '' : 'inactivo'}>
                <td>{p.referencia}</td>
                <td>{p.denominacion}</td>
                <td>{p.cliente_nombre}</td>
                <td>{p.activa ? 'Activa' : 'Inactiva'}</td>
                {!soloLectura && (
                  <td className="acciones">
                    <button className="chico" onClick={() => empezarEdicion(p)}>Editar</button>
                    <button className="chico secundario" onClick={() => alternarActiva(p)}>
                      {p.activa ? 'Desactivar' : 'Activar'}
                    </button>
                  </td>
                )}
              </tr>
            )
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
  const [editando, setEditando] = useState(null); // id del equipo en edición
  const [formEdicion, setFormEdicion] = useState({ nombre: '', referencia_interna: '', fecha_calibracion: '' });

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

  const empezarEdicion = (q) => {
    setEditando(q.id);
    setFormEdicion({
      nombre: q.nombre,
      referencia_interna: q.referencia_interna || '',
      fecha_calibracion: q.fecha_calibracion ? q.fecha_calibracion.slice(0, 10) : ''
    });
  };

  const setEd = (campo) => (e) => setFormEdicion({ ...formEdicion, [campo]: e.target.value });

  const guardarEdicion = async (q) => {
    if (!cumple('nombreCatalogo', formEdicion.nombre.trim())) return alert('Nombre: de 2 a 60 caracteres');
    const refInterna = formEdicion.referencia_interna.trim();
    if (refInterna && !cumple('equipoId', refInterna)) return alert('ID interno: código alfanumérico con guiones, sin espacios (ej. LM-INS-001)');
    try {
      await api(`/equipos/${q.id}`, {
        method: 'PUT',
        body: {
          nombre: formEdicion.nombre.trim(),
          referencia_interna: refInterna || null,
          fecha_calibracion: formEdicion.fecha_calibracion || null
        }
      });
      setEditando(null);
      cargar();
    } catch (e) { alert(e.message); }
  };

  return (
    <div>
      {!soloLectura && (
        <form className="tarjeta formulario" onSubmit={crear}>
          <h3>Nuevo equipo</h3>
          <div className="fila">
            <label>Nombre<input value={form.nombre} onChange={set('nombre')} required {...val('nombreCatalogo')} /></label>
            <label>ID interno<input value={form.referencia_interna} onChange={set('referencia_interna')} {...val('equipoId')} placeholder="LM-INS-001" /></label>
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
            editando === q.id ? (
              <tr key={q.id}>
                <td><input value={formEdicion.nombre} onChange={setEd('nombre')} /></td>
                <td><input value={formEdicion.referencia_interna} onChange={setEd('referencia_interna')} placeholder="LM-INS-001" /></td>
                <td><input type="date" value={formEdicion.fecha_calibracion} onChange={setEd('fecha_calibracion')} /></td>
                <td>{q.activo ? 'Activo' : 'Inactivo'}</td>
                <td className="acciones">
                  <button className="chico" onClick={() => guardarEdicion(q)}>Guardar</button>
                  <button className="chico secundario" onClick={() => setEditando(null)}>Cancelar</button>
                </td>
              </tr>
            ) : (
              <tr key={q.id} className={q.activo ? '' : 'inactivo'}>
                <td>{q.nombre}</td>
                <td>{q.referencia_interna || '—'}</td>
                <td>{q.fecha_calibracion ? new Date(q.fecha_calibracion).toLocaleDateString('es-MX') : '—'}</td>
                <td>{q.activo ? 'Activo' : 'Inactivo'}</td>
                {!soloLectura && (
                  <td className="acciones">
                    <button className="chico" onClick={() => empezarEdicion(q)}>Editar</button>
                    <button className="chico secundario" onClick={() => actualizar(q.id, { activo: !q.activo })}>
                      {q.activo ? 'Desactivar' : 'Activar'}
                    </button>
                  </td>
                )}
              </tr>
            )
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
        <label>Norma<input value={norma} onChange={e => setNorma(e.target.value)} required {...val('norma')} /></label>
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

function Clientes({ soloLectura }) {
  const [clientes, setClientes] = useState([]);
  const [nombre, setNombre] = useState('');
  const [error, setError] = useState('');
  const [editando, setEditando] = useState(null); // id del cliente en edición
  const [nombreEdicion, setNombreEdicion] = useState('');

  const cargar = () => api('/clientes').then(setClientes).catch(() => {});
  useEffect(() => { cargar(); }, []);

  const crear = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api('/clientes', { method: 'POST', body: { nombre } });
      setNombre('');
      cargar();
    } catch (e) { setError(e.message); }
  };

  const guardarEdicion = async (c) => {
    if (!cumple('nombreCatalogo', nombreEdicion.trim())) return alert('Nombre: de 2 a 60 caracteres');
    try {
      await api(`/clientes/${c.id}`, { method: 'PUT', body: { nombre: nombreEdicion.trim() } });
      setEditando(null);
      cargar();
    } catch (e) { alert(e.message); }
  };

  return (
    <div>
      {!soloLectura && (
        <form className="tarjeta formulario" onSubmit={crear}>
          <h3>Nuevo cliente</h3>
          <div className="fila">
            <label>Nombre<input value={nombre} onChange={e => setNombre(e.target.value)} required {...val('nombreCatalogo')} /></label>
          </div>
          {error && <div className="error">{error}</div>}
          <button type="submit">Agregar</button>
        </form>
      )}
      <table className="tabla">
        <thead><tr><th>Nombre</th>{!soloLectura && <th></th>}</tr></thead>
        <tbody>
          {clientes.map(c => (
            editando === c.id ? (
              <tr key={c.id}>
                <td><input value={nombreEdicion} onChange={e => setNombreEdicion(e.target.value)} /></td>
                <td className="acciones">
                  <button className="chico" onClick={() => guardarEdicion(c)}>Guardar</button>
                  <button className="chico secundario" onClick={() => setEditando(null)}>Cancelar</button>
                </td>
              </tr>
            ) : (
              <tr key={c.id}>
                <td>{c.nombre}</td>
                {!soloLectura && (
                  <td className="acciones">
                    <button className="chico" onClick={() => { setEditando(c.id); setNombreEdicion(c.nombre); }}>Editar</button>
                  </td>
                )}
              </tr>
            )
          ))}
          {!clientes.length && <tr><td className="vacio">Vacío</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function FormEspecPintura({ espec, clientes, onGuardada, onCancelar }) {
  const [clienteId, setClienteId] = useState(espec ? String(espec.cliente_id) : '');
  const [norma, setNorma] = useState(espec ? espec.norma : '');
  const [capas, setCapas] = useState(() =>
    espec && espec.capas.length
      ? espec.capas.map(c => ({
          nombre: c.nombre,
          espesor_min: c.espesor_min ?? '',
          espesor_max: c.espesor_max ?? ''
        }))
      : [{ ...CAPA_VACIA }]);
  const [error, setError] = useState('');

  const setCapa = (i, campo, v) => setCapas(cs => cs.map((c, j) => j === i ? { ...c, [campo]: v } : c));
  const agregarCapa = () => setCapas(cs => [...cs, { ...CAPA_VACIA }]);
  const quitarCapa = (i) => setCapas(cs => cs.length === 1 ? [{ ...CAPA_VACIA }] : cs.filter((_, j) => j !== i));

  const enviar = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const cuerpo = { cliente_id: Number(clienteId), norma, capas: capas.filter(c => c.nombre.trim()) };
      if (espec) await api(`/especificaciones-pintura/${espec.id}`, { method: 'PUT', body: cuerpo });
      else await api('/especificaciones-pintura', { method: 'POST', body: cuerpo });
      onGuardada();
    } catch (e) { setError(e.message); }
  };

  return (
    <form className="tarjeta formulario" onSubmit={enviar}>
      <h3>{espec ? `${espec.cliente_nombre} — ${espec.norma}` : 'Nueva especificación de pintura'}</h3>
      <div className="fila">
        <label>Cliente
          <select value={clienteId} onChange={e => setClienteId(e.target.value)} required disabled={!!espec}>
            <option value="">— elegir —</option>
            {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </label>
        <label>Norma<input value={norma} onChange={e => setNorma(e.target.value)} required {...val('norma')} /></label>
      </div>
      <table className="tabla mediciones">
        <thead>
          <tr><th>Capa</th><th>Mínimo (µm)</th><th>Máximo (µm)</th><th style={{ width: 40 }}></th></tr>
        </thead>
        <tbody>
          {capas.map((c, i) => (
            <tr key={i}>
              <td><input value={c.nombre} onChange={e => setCapa(i, 'nombre', e.target.value)}
                placeholder="Primer, Base, Transparente, Total…" style={{ width: '100%', textAlign: 'left' }} /></td>
              <td><input type="number" step="any" value={c.espesor_min} onChange={e => setCapa(i, 'espesor_min', e.target.value)} /></td>
              <td><input type="number" step="any" value={c.espesor_max} onChange={e => setCapa(i, 'espesor_max', e.target.value)} /></td>
              <td><button type="button" className="btn-quitar-fila" onClick={() => quitarCapa(i)} title="Quitar">×</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="meta">Vacío = sin límite. Cada capa se valida contra su rango al capturar el ensayo de pintura.</div>
      <button type="button" className="boton secundario chico" onClick={agregarCapa} style={{ marginTop: 10 }}>+ Agregar capa</button>
      {error && <div className="error">{error}</div>}
      <div className="acciones" style={{ marginTop: 12 }}>
        <button type="submit">Guardar especificación</button>
        <button type="button" className="secundario" onClick={onCancelar}>Cancelar</button>
      </div>
    </form>
  );
}

function EspecsPintura({ soloLectura }) {
  const [especs, setEspecs] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [editando, setEditando] = useState(null); // null | 'nueva' | espec

  const cargar = () => api('/especificaciones-pintura?todas=1').then(setEspecs).catch(() => {});
  useEffect(() => {
    cargar();
    api('/clientes').then(setClientes).catch(() => {});
  }, []);

  const alternarActiva = async (e) => {
    try {
      await api(`/especificaciones-pintura/${e.id}`, { method: 'PUT', body: { activa: !e.activa } });
      cargar();
    } catch (err) { alert(err.message); }
  };

  const resumen = (e) => (e.capas || [])
    .map(c => `${c.nombre}: ${textoRangoCapa(c)}`)
    .join('  ·  ');

  return (
    <div>
      {editando && (
        <FormEspecPintura
          espec={editando === 'nueva' ? null : editando}
          clientes={clientes}
          onGuardada={() => { setEditando(null); cargar(); }}
          onCancelar={() => setEditando(null)}
        />
      )}
      {!soloLectura && !editando && (
        <div className="barra-busqueda">
          <button onClick={() => setEditando('nueva')}>Nueva especificación</button>
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
          <div className="meta">{resumen(e) || 'sin capas definidas'}</div>
        </div>
      ))}
      {!especs.length && <div className="vacio">Sin especificaciones de pintura registradas</div>}
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
        <p className="descripcion">Usuarios del sistema, catálogo de piezas, normas y especificaciones de pintura por cliente, equipos y clientes.</p>
      </div>
      <div className="tabs">
        {[
          ['usuarios', 'Usuarios'], ['piezas', 'Piezas'], ['normas', 'Normas'],
          ['pintura', 'Pintura'], ['equipos', 'Equipos'], ['clientes', 'Clientes']
        ].map(([t, etiqueta]) => (
          <button key={t} className={tab === t ? 'tab activo' : 'tab'} onClick={() => setTab(t)}>
            {etiqueta}
          </button>
        ))}
      </div>
      {tab === 'usuarios' && <Usuarios soloLectura={soloLectura} />}
      {tab === 'piezas' && <Piezas soloLectura={soloLectura} />}
      {tab === 'normas' && <Normas soloLectura={soloLectura} />}
      {tab === 'pintura' && <EspecsPintura soloLectura={soloLectura} />}
      {tab === 'equipos' && <Equipos soloLectura={soloLectura} />}
      {tab === 'clientes' && <Clientes soloLectura={soloLectura} />}
    </div>
  );
}
