// Usage: npm run db:seed   (reads VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY from env)
import { createSupabaseRepo } from '../src/services/supabaseRepo';
import { generateSeed } from '../src/domain/seed';
import { istDate } from '../src/domain/time';

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_ANON_KEY;
if (!url || !key) throw new Error('Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY');
const seed = generateSeed({ today: istDate(new Date()), weeks: 6, seed: 42 });
await createSupabaseRepo(url, key).resetDemo(seed);
console.log(`Seeded ${seed.users.length} users, ${seed.items.length} items, ${seed.offerings.length} offerings`);
