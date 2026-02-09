import type { Config } from 'jest';

const config: Config = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    roots: ['<rootDir>/src'],
    testMatch: ['**/__tests__/**/*.test.ts'],
    moduleNameMapper: {
        '^vscode$': '<rootDir>/src/__mocks__/vscode.ts',
    },
    transform: {
        '^.+\\.ts$': ['ts-jest', {
            tsconfig: 'tsconfig.test.json',
            diagnostics: { ignoreCodes: [151002] },
        }],
    },
    collectCoverageFrom: [
        'src/**/*.ts',
        '!src/types/**',
        '!src/extension.ts',
        '!src/__mocks__/**',
        '!src/__tests__/**',
    ],
    coverageDirectory: 'coverage',
    coverageReporters: ['text', 'text-summary', 'lcov'],
    clearMocks: true,
    restoreMocks: true,
};

export default config;
