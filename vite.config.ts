import tailwindcss from '@tailwindcss/vite';
import { devtools } from '@tanstack/devtools-vite';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import viteReact from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';

const config = defineConfig({
  server: {
    allowedHosts: ['0df8-142-114-163-193.ngrok-free.app', '.ngrok-free.app']
  },
  plugins: [
    devtools(),
    tsconfigPaths({ projects: ['./tsconfig.json'] }),
    tailwindcss(),
    tanstackStart({
      spa: {
        enabled: true,
        prerender: {
          crawlLinks: true,
          outputPath: 'index.html'
        }
      }
    }),
    viteReact()
  ],
  resolve: {
    alias: [{ find: 'use-sync-external-store/shim/index.js', replacement: 'react' }]
  }
});

export default config;
