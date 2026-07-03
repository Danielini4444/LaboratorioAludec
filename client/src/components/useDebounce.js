import { useEffect, useState } from 'react';

// Retrasa un valor que cambia rápido (ej. lo que se teclea en una búsqueda)
// para no pegarle a la API en cada tecla.
export function useDebounce(valor, ms = 300) {
  const [retrasado, setRetrasado] = useState(valor);
  useEffect(() => {
    const t = setTimeout(() => setRetrasado(valor), ms);
    return () => clearTimeout(t);
  }, [valor, ms]);
  return retrasado;
}
