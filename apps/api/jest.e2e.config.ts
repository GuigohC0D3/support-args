import type { Config } from 'jest';

const config: Config = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testRegex: '.e2e-spec.ts$',
  transform: { '^.+\\.(t|j)s$': ['ts-jest', { tsconfig: { types: ['jest', 'node'], esModuleInterop: true, allowSyntheticDefaultImports: true } }] },
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@support-hub/database$': '<rootDir>/../../packages/database/src',
  },
};

export default config;
