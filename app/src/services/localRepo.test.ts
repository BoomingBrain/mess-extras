import { localPersistence } from './localRepo';
import { createMemoryRepo } from './memoryRepo';
import { generateSeed } from '../domain/seed';

const seed = () => generateSeed({ today: '2026-11-19', weeks: 2, seed: 1 });

describe('local persistence', () => {
  beforeEach(() => localStorage.clear());

  it('survives a reload', async () => {
    const a = createMemoryRepo(seed(), localPersistence('t'));
    await a.setClock({ demoNow: '2026-11-19T11:30:00.000Z', demoSetAt: '2026-11-19T05:00:00.000Z' });
    const b = createMemoryRepo(seed(), localPersistence('t'));
    expect((await b.getClock()).demoNow).toBe('2026-11-19T11:30:00.000Z');
  });

  it('starts from the seed when storage is empty or corrupt', async () => {
    localStorage.setItem('t', '{not json');
    const r = createMemoryRepo(seed(), localPersistence('t'));
    expect((await r.listUsers()).length).toBe(61);
  });
});
