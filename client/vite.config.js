import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import basicSsl from '@vitejs/plugin-basic-ssl';

export default defineConfig({
  // HTTPS con certificado autofirmado: sin esto, la cámara EN VIVO no funciona
  // al entrar por la red (http://IP), porque el navegador solo la permite en
  // contexto seguro (https o localhost). Cada equipo acepta el aviso una vez.
  plugins: [react(), tailwindcss(), basicSsl()],
  server: {
    port: 5173,
    // Sin esto, Vite solo escucha en localhost: nadie de la red (ni un
    // celular en el hotspot, ni otra máquina de la intranet) puede llegar,
    // aunque el firewall esté bien configurado.
    host: true,
    proxy: {
      '/api': 'http://localhost:3000'
    }
  }
});
