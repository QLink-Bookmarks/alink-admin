import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

const serverProxy = (server: 'dev' | 'prod', target: string) => {
  const prefix = `/server/${server}`;
  return {
    target,
    changeOrigin: true,
    rewrite: (path: string) => path.slice(prefix.length),
    cookiePathRewrite: { '/api/auth/admin': `${prefix}/api/auth/admin` },
  };
};

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  return {
    plugins: [react(), tailwindcss()],
    server: {
      host: 'localhost',
      port: Number(process.env.ADMIN_E2E_PORT ?? 8101),
      strictPort: true,
      proxy: {
        '/server/dev/api': serverProxy(
          'dev',
          env.VITE_DEV_PROXY_TARGET || 'https://dev.api.archivelink.app',
        ),
        '/server/prod/api': serverProxy(
          'prod',
          env.VITE_PROD_PROXY_TARGET || 'https://api.archivelink.app',
        ),
      },
    },
  };
});
