import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';

// Imprimir por OF: busca una orden de fabricación, muestra todo lo capturado
// con ella (registros de espesores y tests de cromado) y arma un solo PDF
// con los documentos, pruebas y secciones que se marquen.

// Secciones del FM-15-01-03 que se pueden imprimir por separado.
const SECCIONES = [
  { clave: 'thickness', nombre: 'Thickness', disponible: () => true },
  { clave: 'step', nombre: 'S.T.E.P.', disponible: r => r.num_step > 0 },
  { clave: 'poros', nombre: 'Poros', disponible: r => r.num_poros > 0 }
];

export default function ImprimirOF() {
  const [busqueda, setBusqueda] = useState('');
  const [ofs, setOfs] = useState([]);
  const [of, setOf] = useState('');
  const [docs, setDocs] = useState(null);
  const [selSecciones, setSelSecciones] = useState(new Set()); // "registroId:seccion"
  const [selPruebas, setSelPruebas] = useState(new Set());
  const [selVacios, setSelVacios] = useState(new Set()); // reportes sin pruebas
  const [error, setError] = useState('');

  useEffect(() => {
    if (of) return;
    api(`/of?q=${encodeURIComponent(busqueda)}`).then(setOfs).catch(() => {});
  }, [busqueda, of]);

  const alternar = (set, setSet, id) => {
    const s = new Set(set);
    if (s.has(id)) s.delete(id); else s.add(id);
    setSet(s);
  };

  const disponibles = (r) => SECCIONES.filter(s => s.disponible(r));

  const elegir = async (valor) => {
    setError('');
    try {
      const d = await api(`/of/documentos?of=${encodeURIComponent(valor)}`);
      setOf(valor);
      setDocs(d);
      // todo marcado de inicio: lo normal es imprimir el paquete completo
      setSelSecciones(new Set(d.registros.flatMap(r => disponibles(r).map(s => `${r.id}:${s.clave}`))));
      setSelPruebas(new Set(d.reportes.flatMap(r => r.pruebas.map(p => p.id))));
      setSelVacios(new Set(d.reportes.filter(r => !r.pruebas.length).map(r => r.id)));
    } catch (e) { setError(e.message); }
  };

  const volver = () => { setOf(''); setDocs(null); setError(''); };

  // un reporte se imprime si tiene alguna prueba marcada (o, sin pruebas, si está marcado él)
  const reporteImpreso = (r) =>
    r.pruebas.length ? r.pruebas.some(p => selPruebas.has(p.id)) : selVacios.has(r.id);
  // un registro se imprime si tiene alguna sección marcada
  const seccionesDe = (r) => disponibles(r).filter(s => selSecciones.has(`${r.id}:${s.clave}`));

  const totalDocs = docs
    ? docs.registros.filter(r => seccionesDe(r).length).length +
      docs.reportes.filter(reporteImpreso).length
    : 0;

  const alternarReporte = (r) => {
    if (!r.pruebas.length) return alternar(selVacios, setSelVacios, r.id);
    const s = new Set(selPruebas);
    const todas = r.pruebas.every(p => s.has(p.id));
    for (const p of r.pruebas) { if (todas) s.delete(p.id); else s.add(p.id); }
    setSelPruebas(s);
  };

  const alternarRegistro = (r) => {
    const s = new Set(selSecciones);
    const todas = disponibles(r).every(x => s.has(`${r.id}:${x.clave}`));
    for (const x of disponibles(r)) {
      if (todas) s.delete(`${r.id}:${x.clave}`); else s.add(`${r.id}:${x.clave}`);
    }
    setSelSecciones(s);
  };

  const alternarTodosRegistros = () => {
    const todos = docs.registros.every(r => disponibles(r).every(x => selSecciones.has(`${r.id}:${x.clave}`)));
    setSelSecciones(todos
      ? new Set()
      : new Set(docs.registros.flatMap(r => disponibles(r).map(x => `${r.id}:${x.clave}`))));
  };

  const imprimir = () => {
    const params = new URLSearchParams({ of });
    const regs = [];
    for (const r of docs.registros) {
      const marcadas = seccionesDe(r);
      if (!marcadas.length) continue;
      regs.push(r.id);
      params.set(`secciones_${r.id}`, marcadas.map(s => s.clave).join(','));
    }
    if (regs.length) params.set('registros', regs.join(','));
    const reps = [];
    for (const r of docs.reportes) {
      if (!r.pruebas.length) {
        if (selVacios.has(r.id)) reps.push(r.id);
        continue;
      }
      const marcadas = r.pruebas.filter(p => selPruebas.has(p.id));
      if (!marcadas.length) continue;
      reps.push(r.id);
      if (marcadas.length < r.pruebas.length) {
        params.set(`pruebas_${r.id}`, marcadas.map(p => p.id).join(','));
      }
    }
    if (reps.length) params.set('reportes', reps.join(','));
    window.open(`/api/of/pdf?${params.toString()}`, '_blank');
  };

  if (!of) {
    return (
      <div>
        <div className="encabezado-pagina">
          <h2>Imprimir por OF</h2>
          <p className="descripcion">Junta en un solo PDF lo de una orden de fabricación — tests de cromado (FM-15-30) y registros de espesores (FM-15-01-03) — escogiendo qué imprimir</p>
        </div>
        {error && <div className="error">{error}</div>}
        <div className="barra-busqueda">
          <input
            placeholder="Buscar OF…"
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            autoFocus
          />
        </div>
        <table className="tabla">
          <thead>
            <tr><th>OF</th><th>Registros de espesores</th><th>Tests de cromado</th><th></th></tr>
          </thead>
          <tbody>
            {ofs.map(o => (
              <tr key={o.of}>
                <td><a href="#" onClick={e => { e.preventDefault(); elegir(o.of); }}>{o.of}</a></td>
                <td>{o.registros}</td>
                <td>{o.reportes}</td>
                <td><button className="chico secundario" onClick={() => elegir(o.of)}>Elegir</button></td>
              </tr>
            ))}
            {!ofs.length && (
              <tr><td colSpan="4" className="vacio">
                {busqueda ? 'Ninguna OF coincide con la búsqueda.' : 'Todavía no hay documentos con OF capturada.'}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div>
      <div className="encabezado-detalle">
        <div className="encabezado-pagina">
          <h2>OF {of}</h2>
          <p className="descripcion">
            {docs.reportes.length} test{docs.reportes.length === 1 ? '' : 's'} de cromado · {docs.registros.length} registro{docs.registros.length === 1 ? '' : 's'} de espesores
          </p>
        </div>
        <div className="acciones">
          <button className="secundario" onClick={volver}>← Otra OF</button>
          <button disabled={!totalDocs} onClick={imprimir}>
            Imprimir selección{totalDocs ? ` (${totalDocs} doc${totalDocs === 1 ? '' : 's'})` : ''} · PDF
          </button>
        </div>
      </div>
      {error && <div className="error">{error}</div>}

      <h3>Test de cromado · FM-15-30</h3>
      {!docs.reportes.length && <p className="meta">Esta OF no tiene reportes de test de cromado.</p>}
      {docs.reportes.map(r => (
        <div className="tarjeta" key={r.id}>
          <label className="inline" style={{ fontSize: '1em' }}>
            <input
              type="checkbox"
              checked={r.pruebas.length ? r.pruebas.every(p => selPruebas.has(p.id)) : selVacios.has(r.id)}
              onChange={() => alternarReporte(r)}
            />
            <Link to={`/reportes/${r.id}`}>Ens_{r.folio}</Link>
            <span className="meta">{r.cliente_nombre} · {r.referencia} — {r.denominacion}</span>
            {r.conclusion
              ? <span className={`badge ${r.conclusion === 'CUMPLE' ? 'ok' : 'mal'}`}>{r.conclusion === 'CUMPLE' ? 'CUMPLE' : 'NO CUMPLE'}</span>
              : <span className="badge pendiente">en proceso</span>}
            {r.aprobado && <span className="badge">aprobado</span>}
          </label>
          {r.pruebas.length ? (
            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4, paddingLeft: 24 }}>
              {r.pruebas.map(p => (
                <label className="inline" key={p.id} style={{ fontWeight: 400 }}>
                  <input
                    type="checkbox"
                    checked={selPruebas.has(p.id)}
                    onChange={() => alternar(selPruebas, setSelPruebas, p.id)}
                  />
                  Prueba {p.numero}: {[p.norma, [p.apartado, p.ensayo].filter(Boolean).join(' ')].filter(Boolean).join(' — ')}
                  {p.valoracion && <span className={`badge ${p.valoracion === 'OK' ? 'ok' : 'mal'}`}>{p.valoracion}</span>}
                </label>
              ))}
            </div>
          ) : (
            <p className="meta" style={{ margin: '6px 0 0 24px' }}>Sin pruebas registradas todavía (se imprime solo la carátula).</p>
          )}
        </div>
      ))}

      <h3 style={{ marginTop: 24 }}>Laboratorio químico · Registro de espesores FM-15-01-03</h3>
      {!docs.registros.length && <p className="meta">Esta OF no tiene registros de espesores.</p>}
      {docs.registros.length > 0 && (
        <table className="tabla">
          <thead>
            <tr>
              <th>
                <input
                  type="checkbox"
                  checked={docs.registros.every(r => disponibles(r).every(x => selSecciones.has(`${r.id}:${x.clave}`)))}
                  onChange={alternarTodosRegistros}
                />
              </th>
              <th>No.</th><th>Cliente</th><th>Fecha</th><th>Referencia</th>
              <th>Barra</th><th>Piezas</th><th>Resultado</th><th>Qué imprimir</th>
            </tr>
          </thead>
          <tbody>
            {docs.registros.map(r => (
              <tr key={r.id}>
                <td>
                  <input
                    type="checkbox"
                    checked={disponibles(r).every(x => selSecciones.has(`${r.id}:${x.clave}`))}
                    onChange={() => alternarRegistro(r)}
                  />
                </td>
                <td><Link to={`/registros/${r.id}`}>{r.reporte_no}</Link></td>
                <td>{r.cliente_nombre}</td>
                <td>{new Date(r.fecha_prueba).toLocaleDateString('es-MX')}</td>
                <td>{r.referencia}</td>
                <td>{r.barra || '—'}</td>
                <td>{r.num_piezas}</td>
                <td>
                  {r.resultado
                    ? <span className={`badge ${r.resultado === 'PASS' ? 'ok' : 'mal'}`}>{r.resultado}</span>
                    : '—'}
                  {r.aprobado && <span className="badge">aprobado</span>}
                </td>
                <td>
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    {SECCIONES.map(s => {
                      const hay = s.disponible(r);
                      return (
                        <label className="inline" key={s.clave} style={{ fontWeight: 400, opacity: hay ? 1 : 0.45 }} title={hay ? '' : 'Este registro no tiene datos de esta sección'}>
                          <input
                            type="checkbox"
                            disabled={!hay}
                            checked={hay && selSecciones.has(`${r.id}:${s.clave}`)}
                            onChange={() => alternar(selSecciones, setSelSecciones, `${r.id}:${s.clave}`)}
                          />
                          {s.nombre}
                        </label>
                      );
                    })}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
