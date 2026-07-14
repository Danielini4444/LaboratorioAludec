import { useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../App.jsx';
import { val, cumple } from '../validaciones.js';

// Pantalla obligatoria de cambio de contraseña en el primer ingreso
// (los usuarios se crean con la contraseña por defecto conocida).
export default function CambiarPassword() {
  const { user, logout, refrescar } = useAuth();
  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');
  const [confirma, setConfirma] = useState('');
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  const enviar = async (e) => {
    e.preventDefault();
    setError('');
    if (!cumple('password', nueva)) return setError('La nueva contraseña debe tener al menos 6 caracteres y no llevar espacios');
    if (nueva !== confirma) return setError('Las contraseñas no coinciden');
    if (nueva === actual) return setError('La nueva contraseña debe ser distinta a la actual');
    setGuardando(true);
    try {
      await api('/auth/cambiar-password', { method: 'POST', body: { actual, nueva } });
      await refrescar();
    } catch (e) {
      setError(e.message);
      setGuardando(false);
    }
  };

  return (
    <div className="login-fondo">
      <form className="login-caja" onSubmit={enviar}>
        <div className="login-marca">
          <img className="logo" src="/logo.png" alt="ALUDEC" />
          <div className="lema">Cambia tu contraseña para continuar</div>
        </div>
        <p className="meta" style={{ margin: 0 }}>
          Hola {user.nombre}: por seguridad debes cambiar la contraseña inicial antes de usar el sistema.
        </p>
        <label>Contraseña actual
          <input type="password" value={actual} onChange={e => setActual(e.target.value)} required autoFocus />
        </label>
        <label>Nueva contraseña
          <input type="password" value={nueva} onChange={e => setNueva(e.target.value)} required {...val('password')} />
        </label>
        <label>Confirmar nueva contraseña
          <input type="password" value={confirma} onChange={e => setConfirma(e.target.value)} required />
        </label>
        {error && <div className="error">{error}</div>}
        <button type="submit" disabled={guardando}>{guardando ? 'Guardando…' : 'Cambiar contraseña'}</button>
        <button type="button" className="link" onClick={logout}>Cerrar sesión</button>
      </form>
    </div>
  );
}
