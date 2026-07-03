import { useEffect } from 'react';

// Visor de imagen a pantalla completa. Se abre con la URL de la foto y se
// cierra con clic en el fondo, el botón × o la tecla Escape.
export default function Lightbox({ src, alt = '', onClose }) {
  useEffect(() => {
    if (!src) return;
    const alTecla = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', alTecla);
    return () => window.removeEventListener('keydown', alTecla);
  }, [src, onClose]);

  if (!src) return null;
  return (
    <div className="lightbox" onClick={onClose} role="dialog" aria-modal="true">
      <button type="button" className="lightbox-cerrar" onClick={onClose} aria-label="Cerrar">×</button>
      <img src={src} alt={alt} onClick={e => e.stopPropagation()} />
    </div>
  );
}
