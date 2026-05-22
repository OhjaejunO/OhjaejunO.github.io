// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';

import react from '@astrojs/react';

// https://astro.build/config
export default defineConfig({
  site: 'https://ojaejun1995-sys.github.io',

  markdown: {
    shikiConfig: {
      theme: 'github-dark',
      wrap: false,
    },
  },

  vite: {
    plugins: [tailwindcss()]
  },

  integrations: [react()]
});