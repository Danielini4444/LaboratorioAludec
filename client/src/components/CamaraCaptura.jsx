import { useEffect, useRef, useState } from 'react';

// Modal que abre la cámara del dispositivo (webcam de la laptop o cámara del
// móvil) usando getUserMedia, muestra la vista en vivo y captura una foto JPG.
//   onCaptura(file) -> se llama con el archivo de la foto tomada.
//   onCerrar()      -> cerrar/cancelar sin capturar.
// Requiere HTTPS (o localhost); si no, el navegador bloquea la cámara.
export default function CamaraCaptura({ onCaptura, onCerrar }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [error, setError] = useState('');
  const [listo, setListo] = useState(false);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error('sin soporte');
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' }, audio: false,
        });
        if (cancelado) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
        setListo(true);
      } catch {
        setError('No se pudo acceder a la cámara. Revisa los permisos del navegador y que la página use HTTPS.');
      }
    })();
    return () => {
      cancelado = true;
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    };
  }, []);

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
      onCaptura(file);
      onCerrar();
    }, 'image/jpeg', 0.92);
  };

  return (
    <div className="modal-fondo" onClick={onCerrar}>
      <div className="modal-camara" onClick={e => e.stopPropagation()}>
        {error
          ? <p className="error">{error}</p>
          : <video ref={videoRef} playsInline muted />}
        <div className="acciones-camara">
          {!error && (
            <button type="button" disabled={!listo} onClick={capturar}>
              📷 Capturar
            </button>
          )}
          <button type="button" className="secundario" onClick={onCerrar}>
            {error ? 'Cerrar' : 'Cancelar'}
          </button>
        </div>
      </div>
    </div>
  );
}
