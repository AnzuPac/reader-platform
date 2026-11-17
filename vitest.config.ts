import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Каждый воркер получает свою SQLite-базу (tests/setup-isolated-db.ts),
    // иначе параллельные файлы тестов дерутся за один файл и падают случайно.
    setupFiles: ['./tests/setup-isolated-db.ts'],
  },
});
