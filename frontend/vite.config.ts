import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@/components': path.resolve(__dirname, './src/components'),
      '@/hooks': path.resolve(__dirname, './src/hooks'),
      '@/stores': path.resolve(__dirname, './src/stores'),
      '@/utils': path.resolve(__dirname, './src/utils'),
      '@/types': path.resolve(__dirname, './src/types'),
      '@/layouts': path.resolve(__dirname, './src/layouts'),
      '@/panels': path.resolve(__dirname, './src/panels'),
      '@/services': path.resolve(__dirname, './src/services'),
      '@bbos/shared': path.resolve(__dirname, '../shared/src'),
    },
  },
  server: {
    port: 3000,
    host: true,
    headers: {
      // Enable WebUSB and Web Serial APIs
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Opener-Policy': 'same-origin'
    },
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        ws: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          flexlayout: ['flexlayout-react'],
          monaco: ['monaco-editor', '@monaco-editor/react'],
          rjsf: ['@rjsf/core', '@rjsf/utils', '@rjsf/antd'],
          antd: ['antd', '@ant-design/icons'],
        },
      },
    },
  },
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'flexlayout-react',
      'socket.io-client',
      '@rjsf/core',
      '@rjsf/antd',
      'antd',
    ],
  },
}) 