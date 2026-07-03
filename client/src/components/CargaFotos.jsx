import { useEffect, useRef, useState } from 'react';

// Zona de carga de fotos dentro de un formulario: se eligen una por una o
// varias de golpe (clic o arrastrar y soltar) y se van ACUMULANDO antes de
// guardar. Cada miniatura se puede quitar. Solo JPG/PNG (lo que admite el PDF).
//
// Uso:
//   <CargaFotos titulo="Evidencia" archivos={archivos} onCambio={setArchivos} />
const TIPOS = ['image/jpeg', 'image/png'];
const clave = (a) => `${a.name}|${a.size}|${a.lastModified}`;

export default function CargaFotos({ titulo, archivos, onCambio }) {
  const inputRef = useRef(null);
  const [urls, setUrls] = useState([]);
  const [arrastrando, setArrastrando] = useState(false);

  useEffect(() => {
    const nuevas = archivos.map(a => URL.createObjectURL(a));
    setUrls(nuevas);
    return () => nuevas.forEach(u => URL.revokeObjectURL(u));
  }, [archivos]);

  // agrega los nuevos archivos a los que ya había, sin duplicar
  const agregar = (lista) => {
    const validos = [...lista].filter(a => TIPOS.includes(a.type));
    const existentes = new Set(archivos.map(clave));
    const nuevos = validos.filter(a => !existentes.has(clave(a)));
    if (nuevos.length) onCambio([...archivos, ...nuevos]);
  };

  const quitar = (i) => onCambio(archivos.filter((_, j) => j !== i));

  return (
    <div className="campo-carga">
      {titulo && <span className="etiqueta-carga">{titulo}</span>}
      <div
        className={`zona-carga${arrastrando ? ' arrastrando' : ''}`}
        onClick={() => inputRef.current.click()}
        onDragOver={e => { e.preventDefault(); setArrastrando(true); }}
        onDragLeave={() => setArrastrando(false)}
        onDrop={e => { e.preventDefault(); setArrastrando(false); agregar(e.dataTransfer.files); }}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <path d="M17 8l-5-5-5 5" /><path d="M12 3v12" />
        </svg>
        <span>Arrastra fotos aquí o <strong>haz clic para elegir</strong></span>
        <span className="hint">JPG o PNG · una o varias · se van acumulando</span>
      </div>
      <input
        ref={inputRef} type="file" accept="image/jpeg,image/png" multiple hidden
        onChange={e => { agregar(e.target.files); e.target.value = ''; }}
      />
      {!!archivos.length && (
        <div className="previsualizacion">
          {urls.map((u, i) => (
            <span className="miniatura-prev" key={i}>
              <img src={u} alt={archivos[i].name} title={archivos[i].name} />
              <button type="button" className="quitar" title="Quitar" onClick={() => quitar(i)}>×</button>
            </span>
          ))}
          <span className="conteo-carga">{archivos.length} foto{archivos.length !== 1 ? 's' : ''}</span>
        </div>
      )}
    </div>
  );
}
