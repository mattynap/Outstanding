import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['packages/*/{src,test,scripts}/**/*.test.ts'],
    environment: 'node',
  },
});
