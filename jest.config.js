/**
 * Jest configuration
 */
module.exports = {
  testEnvironment: "node",
  testMatch:       ["**/tests/**/*.test.js"],
  setupFilesAfterEnv: ["./src/tests/setup.js"],
  collectCoverageFrom: [
    "src/**/*.js",
    "!src/tests/**",
    "!src/config/**",
    "!src/prisma/**",
  ],
  coverageReporters: ["text", "lcov", "html"],
  coverageThreshold: {
    global: {
      branches:   70,
      functions:  70,
      lines:      70,
      statements: 70,
    },
  },
  testTimeout: 30000,
};
