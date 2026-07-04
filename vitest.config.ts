import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    // Define variáveis de ambiente determinísticas ANTES dos módulos carregarem.
    setupFiles: ['tests/setup.ts'],
  },
});
