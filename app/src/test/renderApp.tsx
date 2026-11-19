import { render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { AppProviders } from '../ui/AppProviders';
import { createMemoryRepo } from '../services/memoryRepo';
import { generateSeed } from '../domain/seed';
import { runTick } from '../services/tick';
import type { Repo } from '../services/repo';

export const TODAY = '2026-11-19'; // Thursday: paneer

/** A memory repo seeded for TODAY, demo clock frozen-ish at `demoNow` (real clock is used for the offset). */
export async function makeRepo(demoNow: Date): Promise<Repo> {
  const repo = createMemoryRepo(generateSeed({ today: TODAY, weeks: 6, seed: 42 }));
  await repo.setClock({ demoNow: demoNow.toISOString(), demoSetAt: new Date().toISOString() });
  await runTick(repo, demoNow);
  return repo;
}

export function renderApp(ui: ReactNode, opts: { repo: Repo; userId?: string; path?: string }) {
  try { localStorage.clear(); } catch { /* ignore */ }
  if (opts.userId) localStorage.setItem('mess-extras-session', opts.userId);
  return render(
    <MemoryRouter initialEntries={[opts.path ?? '/']}>
      <AppProviders repo={opts.repo}>{ui}</AppProviders>
    </MemoryRouter>,
  );
}
