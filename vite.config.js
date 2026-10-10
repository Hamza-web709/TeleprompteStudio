import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  // Use relative asset paths for maximum static hosting compatibility (root or subfolder)
  base: './',
  server: {
    port: 3200,
    host: '0.0.0.0',
    strictPort: true
  },
  preview: {
    port: 3201,
    host: '0.0.0.0',
    strictPort: true
  },
  build: {
    target: 'es2022',
    outDir: 'dist',
    sourcemap: false, // Omit source maps in production to stay within hosting upload limits
    assetsInlineLimit: 4096,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        remote: resolve(__dirname, 'remote.html')
      },
      output: {
        manualChunks(id) {
          if (id.includes('pdfjs-dist') || id.includes('jspdf')) {
            return 'pdf-vendor';
          }
          if (id.includes('docx') || id.includes('mammoth')) {
            return 'doc-vendor';
          }
        }
      }
    }
  }
});
