// Indicador de carga reutilizable mientras llega la respuesta de la API.
export default function Cargando({ texto = 'Cargando…' }) {
  return (
    <div className="cargando">
      <span className="spinner" aria-hidden="true" />
      {texto}
    </div>
  );
}
