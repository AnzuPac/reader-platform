import os from 'node:os';
import path from 'node:path';

// Своя база на процесс-воркер: тесты не должны видеть записи друг друга.
if (!process.env.SQLITE_DIR) {
  process.env.SQLITE_DIR = path.join(os.tmpdir(), `reader-tests-${process.pid}`);
}
