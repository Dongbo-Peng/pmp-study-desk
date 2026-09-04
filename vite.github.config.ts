import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/postcss';
import { defineConfig } from 'vite';
import path from 'node:path';

export default defineConfig({
  root: 'github-pages',
  base: '/pmp-study-desk/',
  css: { postcss: { plugins: [tailwindcss()] } },
  plugins: [react()],
  resolve: { alias: { '@': path.resolve(import.meta.dirname, '.') } },
  build: {
    outDir: '../docs',
    emptyOutDir: true,
  },
});
