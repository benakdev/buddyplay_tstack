import tailwindcss from '@tailwindcss/vite';
import { devtools } from '@tanstack/devtools-vite';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import viteReact from '@vitejs/plugin-react';
import { nitro } from 'nitro/vite';
import { defineConfig } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';

const config = defineConfig({
  server: {
    cors: true
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
    viteReact(),
    nitro()
  ],
  build: {
    outDir: 'dist'
  },
  resolve: {
    alias: [{ find: 'use-sync-external-store/shim/index.js', replacement: 'react' }]
  }
});

export default config;
