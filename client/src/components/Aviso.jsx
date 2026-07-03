import { useCallback, useRef, useState } from 'react';

// Reemplaza alert() por un aviso breve (toast) dentro de la app.
// Uso:
//   const [avisar, vistaAviso] = useAviso();
//   avisar('No se pudo subir la foto');           // error (rojo)
//   avisar('Registro aprobado', 'ok');            // éxito (verde)
//   ...y renderizar {vistaAviso} una vez en la página.
export function useAviso() {
  const [aviso, setAviso] = useState(null);
  const timer = useRef(null);

  const avisar = useCallback((mensaje, tipo = 'error') => {
    setAviso({ mensaje, tipo });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setAviso(null), 4000);
  }, []);

  const vista = aviso ? <div className={`toast toast-${aviso.tipo}`}>{aviso.mensaje}</div> : null;

  return [avisar, vista];
}
