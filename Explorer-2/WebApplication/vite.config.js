import { defineConfig } from 'vite';
import { resolve } from 'path';
import vue from '@vitejs/plugin-vue';
import fs from 'fs';

// https://vitejs.dev/config/
export default defineConfig({
  assetsInclude: ['**/*.svg', '**/*.png', '**/*.jpg', '**/*.jpeg', '**/*.gif', '**/*.woff2', '**/*.woff', '**/*.ttf', 'bootstrap'],
  base: '',
  plugins: [vue()],
  server: {
    host: true, // Accessible from your network
    port: 3000,
    https: {
      key: fs.readFileSync('/etc/letsencrypt/live/haske.online/privkey.pem'),
      cert: fs.readFileSync('/etc/letsencrypt/live/haske.online/cert.pem'),
    },
    hmr: {
      overlay: false, // Optionally disable error overlay
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),  // Add the alias here
    },
  },
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        landing: resolve(__dirname, 'token-landing.html'),
        retrieve: resolve(__dirname, 'retrieve-and-view.html'),
      },
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            return id.split('node_modules/')[1].split('/')[0].toString();
          }
        },
      },
    },
  },
  css: {
    postcss: {
      plugins: [
        {
          postcssPlugin: 'internal:charset-removal',
          AtRule: {
            charset: (atRule) => {
              if (atRule.name === 'charset') {
                atRule.remove();
              }
            },
          },
        },
      ],
    },
  },
});

