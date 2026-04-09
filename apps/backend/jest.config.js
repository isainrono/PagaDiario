/** @type {import('jest').Config} */
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': ['ts-jest', {
      tsconfig: {
        strict: true,
        esModuleInterop: true,
        experimentalDecorators: true,
        emitDecoratorMetadata: true,
      },
    }],
  },
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@monopoly/types$': '<rootDir>/../../packages/types/src/index.ts',
  },
};
