import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const schema = readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');

try {
  await pool.query(schema);
  console.log('✓ Migration appliquée (schéma à jour).');
  process.exit(0);
} catch (err) {
  console.error('✗ Échec de la migration :', err.message);
  process.exit(1);
}
