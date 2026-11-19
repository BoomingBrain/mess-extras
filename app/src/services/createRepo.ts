import { createMemoryRepo } from './memoryRepo';
import { localPersistence } from './localRepo';
import { createSupabaseRepo } from './supabaseRepo';
import { generateSeed } from '../domain/seed';
import { istDate } from '../domain/time';
import type { Repo } from './repo';

/** Supabase when configured; otherwise local mode (data lives in this browser). */
export function createRepo(): Repo {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  if (url && key) return createSupabaseRepo(url, key);
  return createMemoryRepo(generateSeed({ today: istDate(new Date()), weeks: 6, seed: 42 }), localPersistence());
}
