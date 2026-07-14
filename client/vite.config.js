import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
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
