import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['test/**/*.test.js'],
    exclude: ['test/e2e/**'],
    setupFiles: ['./test/setup.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['shared/**/*.js', '*.js'],
      exclude: [
        'node_modules/**',
        'dist/**',
        'dist-dev/**',
        'test/**',
        'vite*.js',
        'vite-plugins/**'
      ]
    }
  }
});
