import { PGlite } from '@electric-sql/pglite';
import { readFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const dir = path.join(process.cwd(), 'data', 'pglite');
mkdirSync(path.dirname(dir), { recursive: true });
const db = new PGlite(dir);
await db.waitReady;
const schema = readFileSync(path.join(process.cwd(), 'db', 'schema.sql'), 'utf8');
await db.exec(schema);
const r = await db.query("SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema='public'");
console.log('таблиц в базе:', r.rows[0].n);
await db.close();
