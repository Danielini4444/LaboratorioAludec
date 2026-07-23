import { useCallback, useEffect, useRef, useState } from 'react';

// Modal que abre la cámara del dispositivo (webcam de la laptop o cámara del
// móvil) usando getUserMedia, muestra la vista en vivo y captura una foto JPG.
//   onCaptura(file) -> se llama con el archivo de la foto tomada.
//   onCerrar()      -> cerrar/cancelar sin capturar.
// Requiere contexto seguro (HTTPS o localhost); por http://IP el navegador la
// bloquea.

// Mensaje según el nombre del error de getUserMedia, para que el motivo real
// sea claro (permiso, cámara ocupada, sin cámara, etc.).
const MENSAJES = {
  NotAllowedError: 'Permiso de cámara bloqueado. Ábrelo desde el candado de la barra de direcciones y reintenta.',
  NotFoundError: 'No se encontró ninguna cámara conectada al equipo.',
  NotReadableError: 'La cámara está siendo usada por otra app o pestaña (Teams, Zoom, Meet, otra pestaña). Ciérrala y reintenta.',
  OverconstrainedError: 'La cámara no admite la configuración solicitada.',
  AbortError: 'El sistema no pudo iniciar la cámara. Reintenta.',
  SecurityError: 'El navegador bloqueó la cámara por seguridad.',
};

export default function CamaraCaptura({ onCaptura, onCerrar }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const tokenRef = useRef(0);
  const archivoRef = useRef(null);
  const [error, setError] = useState('');
  const [listo, setListo] = useState(false);
  // http://IP no es contexto seguro: la cámara EN VIVO (getUserMedia) queda
  // bloqueada por el navegador, pero la cámara NATIVA del dispositivo vía
  // selector de archivos sí funciona. En ese caso caemos a esa opción.
  const [nativa, setNativa] = useState(false);

  const detener = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  }, []);

  const abrir = useCallback(async () => {
    const miToken = ++tokenRef.current; // invalida intentos anteriores
    detener();
    setError('');
    setListo(false);

    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      // Sin contexto seguro no hay cámara en vivo: ofrecemos la nativa.
      setNativa(true);
      return;
    }

    // Intenta la cámara trasera; si no existe (típico en laptop) usa cualquiera.
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
    } catch (e1) {
      if (e1?.name === 'OverconstrainedError' || e1?.name === 'NotFoundError') {
        try {
          stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        } catch (e2) {
          if (miToken === tokenRef.current) setError(MENSAJES[e2?.name] || `No se pudo acceder a la cámara (${e2?.name || 'error'}).`);
          return;
        }
      } else {
        if (miToken === tokenRef.current) setError(MENSAJES[e1?.name] || `No se pudo acceder a la cámara (${e1?.name || 'error'}).`);
        return;
      }
    }

    // Otro intento (o el cierre) tomó el relevo: suelta este stream.
    if (miToken !== tokenRef.current) { stream.getTracks().forEach(t => t.stop()); return; }
    streamRef.current = stream;
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      await videoRef.current.play().catch(() => {});
    }
    setListo(true);
  }, [detener]);

  useEffect(() => {
    abrir();
    return () => { tokenRef.current++; detener(); };
  }, [abrir, detener]);

  const capturar = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    canvas.toBlob(blob => {
      if (!blob) return;
      const file = new File([blob], `foto-${Date.now()}.jpg`, { type: 'image/jpeg' });
      detener();
      onCaptura(file);
      onCerrar();
    }, 'image/jpeg', 0.92);
  };

  const cerrar = () => { detener(); onCerrar(); };

  // Cámara nativa del dispositivo (funciona sobre http://IP en celular/tablet).
  const usarNativa = (e) => {
    const archivo = e.target.files[0];
    e.target.value = '';
    if (archivo) onCaptura(archivo);
    onCerrar();
  };

  if (nativa) {
    return (
      <div className="modal-fondo" onClick={cerrar}>
        <div className="modal-camara" onClick={e => e.stopPropagation()}>
          <p className="error">
            Esta conexión (http) no permite la cámara en vivo. Usa la cámara del dispositivo:
          </p>
          <div className="acciones-camara">
            <button type="button" onClick={() => archivoRef.current.click()}>📷 Abrir cámara</button>
            <button type="button" className="secundario" onClick={cerrar}>Cancelar</button>
          </div>
          <input
            ref={archivoRef} type="file" accept="image/jpeg,image/png" capture="environment"
            hidden onChange={usarNativa}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="modal-fondo" onClick={cerrar}>
      <div className="modal-camara" onClick={e => e.stopPropagation()}>
        {error
          ? <p className="error">{error}</p>
          : <video ref={videoRef} playsInline muted />}
        <div className="acciones-camara">
          {error
            ? <button type="button" onClick={abrir}>Reintentar</button>
            : <button type="button" disabled={!listo} onClick={capturar}>📷 Capturar</button>}
          <button type="button" className="secundario" onClick={cerrar}>
            {error ? 'Cerrar' : 'Cancelar'}
          </button>
        </div>
      </div>
    </div>
  );
}
