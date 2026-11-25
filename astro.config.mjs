import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
export default defineConfig({
  site: process.env.PUBLIC_ORIGIN || 'https://defterde.com',
  output: 'server',
  outDir: './dist/site',
  adapter: node({ mode: 'middleware' }),
  trailingSlash: 'always',
  prefetch: false,
  devToolbar: { enabled: false },
  // The public CSP permits external scripts only, including small page bundles.
  vite: { build: { cssMinify: true, assetsInlineLimit: 0 } },
});
