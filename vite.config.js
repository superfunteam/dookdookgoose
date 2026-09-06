import {defineConfig, loadEnv} from 'vite';
import dookPwa from './build/pwa-plugin.mjs';
import siteMetadata from './build/site-meta.mjs';

export default defineConfig(({mode}) => ({
  plugins: [siteMetadata({siteUrl: process.env.SITE_URL || loadEnv(mode, process.cwd(), '').SITE_URL}), dookPwa()],
  build: {rollupOptions: {
    input: {game: 'index.html', characters: 'character-lab.html'},
    output: {manualChunks(id) {
      if (id.includes('controls/OrbitControls')) return 'orbit-controls';
      if (id.includes('node_modules/three')) return 'three';
    }}
  }}
}));
