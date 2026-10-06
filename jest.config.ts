import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  // Busca archivos terminados en .test.ts dentro de la carpeta tests
  testMatch: ['**/tests/**/*.test.ts'], 
  verbose: true,
  forceExit: true, // Fuerza el cierre de Jest después de los tests (útil con conexiones de DB)
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
};

export default config;