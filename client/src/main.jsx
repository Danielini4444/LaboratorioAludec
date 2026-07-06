import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import './styles.css';
import { cargarConfig, iniciarSso } from './sso.js';

// En modo sso el login pasa ANTES de montar la app (redirect al login central
// del QMS y vuelta); en standalone se monta directo y Login.jsx hace su trabajo.
(async () => {
  const config = await cargarConfig();
  if (config.auth_mode === 'sso') await iniciarSso(config.sso);

  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </React.StrictMode>
  );
})();
