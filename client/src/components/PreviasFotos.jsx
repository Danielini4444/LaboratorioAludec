import { useEffect, useState } from 'react';

// Muestra miniaturas de los archivos elegidos en un <input type="file">
// antes de guardarlos, para que se vea qué se va a subir.
export default function PreviasFotos({ archivos }) {
  const [urls, setUrls] = useState([]);

  useEffect(() => {
    const nuevas = archivos.map(a => URL.createObjectURL(a));
    setUrls(nuevas);
    return () => nuevas.forEach(u => URL.revokeObjectURL(u));
  }, [archivos]);

  if (!archivos.length) return null;
  return (
    <div className="previsualizacion">
      {urls.map((u, i) => (
        <span className="miniatura-prev" key={i}>
          <img src={u} alt={archivos[i].name} />
        </span>
      ))}
    </div>
  );
}
