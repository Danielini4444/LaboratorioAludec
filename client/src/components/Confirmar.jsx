import { useCallback, useState } from 'react';

// Reemplaza confirm() del navegador por un diálogo dentro de la app.
// Uso:
//   const [confirmar, dialogoConfirmar] = useConfirmar();
//   if (!await confirmar({ titulo, mensaje, peligro: true })) return;
//   ...y renderizar {dialogoConfirmar} una vez en la página.
export function useConfirmar() {
  const [estado, setEstado] = useState(null);

  const confirmar = useCallback(
    (opciones) => new Promise(resolve => setEstado({ ...opciones, resolve })),
    []
  );

  const cerrar = (valor) => {
    if (estado) estado.resolve(valor);
    setEstado(null);
  };

  const dialogo = estado ? (
    <div className="modal-fondo" onClick={() => cerrar(false)}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        {estado.titulo && <h3>{estado.titulo}</h3>}
        <p>{estado.mensaje}</p>
        <div className="acciones">
          <button type="button" className="secundario" onClick={() => cerrar(false)}>
            {estado.textoCancelar || 'Cancelar'}
          </button>
          <button
            type="button"
            className={estado.peligro ? 'peligro' : ''}
            onClick={() => cerrar(true)}
            autoFocus
          >
            {estado.textoConfirmar || 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  ) : null;

  return [confirmar, dialogo];
}
