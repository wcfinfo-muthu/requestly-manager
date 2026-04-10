export default {
    testEnvironment: 'node',
    transform: {},
    collectCoverageFrom: [
        'src/**/*.js',
        '!src/ui/**',
        '!src/config.js',
        '!src/content.js',
    ],
    coverageThreshold: {
        global: {
            branches: 70,
            functions: 70,
            lines: 70,
            statements: 70,
        },
    },
    testMatch: [
        '**/__tests__/**/*.test.js',
        '**/?(*.)+(spec|test).js',
    ],
};
