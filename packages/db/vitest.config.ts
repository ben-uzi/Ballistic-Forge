import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    // Spinning up an in-process Postgres per file is slower than a unit test.
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
});
