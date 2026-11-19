// Usage: DATABASE_URL=postgres://... npm run db:setup
import { readFileSync } from 'node:fs';
import pg from 'pg';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('Set DATABASE_URL (Supabase → Project Settings → Database → Connection string)');
const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await client.connect();
await client.query(readFileSync(new URL('../supabase/migrations/001_schema.sql', import.meta.url), 'utf8'));
await client.end();
console.log('Schema applied.');
