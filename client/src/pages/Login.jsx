import { useState } from 'react';
import { useAuth } from '../App.jsx';
import { val } from '../validaciones.js';

export default function Login() {
  const { login } = useAuth();
  const [usuario, setUsuario] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  const enviar = async (e) => {
    e.preventDefault();
    setError('');
    setEnviando(true);
    try {
      await login(usuario, password);
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="login-fondo">
      <form className="login-caja" onSubmit={enviar}>
        <div className="login-marca">
          <img className="logo" src="/logo.png" alt="ALUDEC" />
          <div className="lema">Laboratorio · Registro de espesores y STEP</div>
        </div>
        <label>
          Usuario
          <input value={usuario} onChange={e => setUsuario(e.target.value)} autoFocus required {...val('usuario')} />
        </label>
        <label>
          Contraseña
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} required />
        </label>
        {error && <div className="error">{error}</div>}
        <button type="submit" disabled={enviando}>{enviando ? 'Entrando…' : 'Entrar'}</button>
      </form>
    </div>
  );
}
