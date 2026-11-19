import { createMemoryRepo } from './memoryRepo';
import { runTick } from './tick';
import { generateSeed } from '../domain/seed';
import { makeBooking } from '../domain/booking';
import { istAt } from '../domain/time';
import { mulberry32 } from '../domain/random';
import type { Repo } from './repo';

const today = '2026-11-19'; // Thursday → paneer only
const at = (hhmm: string) => istAt(today, hhmm);
const fresh = () => createMemoryRepo(generateSeed({ today, weeks: 6, seed: 42 }));

async function todays(repo: Repo) {
  return (await repo.listOfferings({ from: today, to: today }));
}

async function book(repo: Repo, userId: string, plates: number, hhmm: string) {
  const [o] = await todays(repo);
  const item = (await repo.listItems()).find((i) => i.id === o.itemId)!;
  const r = makeBooking({ id: `bk-${userId}-${hhmm}`, offering: o, item, userId, plates, now: at(hhmm), rand: mulberry32(9) });
  if (!r.ok) throw new Error(r.error);
  return repo.createBooking(r.value);
}

describe('runTick on the memory repo', () => {
  it('creates today\'s offering with a forecast and a purchase notification, idempotently', async () => {
    const repo = fresh();
    await runTick(repo, at('09:00'));
    const offs = await todays(repo);
    expect(offs).toHaveLength(1);
    expect(offs[0].itemId).toBe('item-paneer');
    expect(offs[0].forecastReason.startsWith('Last 4 Thursdays')).toBe(true);
    expect((await repo.sentKeys()).has(`purchase:${today}:item-paneer`)).toBe(true);
    const keys = (await repo.sentKeys()).size;
    await runTick(repo, at('09:05'));
    expect(await todays(repo)).toHaveLength(1);
    expect((await repo.sentKeys()).size).toBe(keys);
  });

  it('closes at 17:00 and charges each booking', async () => {
    const repo = fresh();
    await runTick(repo, at('09:00'));
    await book(repo, 'u-21BCE1001', 2, '10:00');
    await book(repo, 'u-21BCE1002', 1, '11:00');
    await book(repo, 'u-21BCE1003', 1, '12:00');
    await runTick(repo, at('17:00'));
    const [o] = await todays(repo);
    expect(o.status).toBe('closed');
    const charges = await Promise.all(['u-21BCE1001', 'u-21BCE1002', 'u-21BCE1003'].map((u) => repo.listCharges(u, '2026-11')));
    expect(charges.map((c) => c.filter((x) => x.chargedOn === today).length)).toEqual([1, 1, 1]);
  });

  it('applies the close exactly once when two clients tick at the same moment', async () => {
    const run = async (concurrent: boolean) => {
      const repo = fresh();
      await runTick(repo, at('09:00'));
      await book(repo, 'u-21BCE1001', 2, '10:00');
      await book(repo, 'u-21BCE1002', 1, '11:00');
      if (concurrent) await Promise.all([runTick(repo, at('17:00')), runTick(repo, at('17:00'))]);
      else await runTick(repo, at('17:00'));
      const all = await Promise.all(['u-21BCE1001', 'u-21BCE1002'].map((u) => repo.listCharges(u, '2026-11')));
      return {
        charges: all.flat().filter((c) => c.chargedOn === today).length,
        grams: (await repo.listBatches('item-paneer')).map((b) => b.gramsRemaining),
      };
    };
    const once = await run(false);
    const twice = await run(true);
    expect(twice.charges).toBe(2);
    expect(twice.grams).toEqual(once.grams);
  });

  it('rejects a booking that arrives after the close was applied', async () => {
    const repo = fresh();
    await runTick(repo, at('09:00'));
    const [o] = await todays(repo);
    const item = (await repo.listItems()).find((i) => i.id === o.itemId)!;
    // built at 16:59 while still open…
    const late = makeBooking({ id: 'late', offering: o, item, userId: 'u-21BCE1005', plates: 1, now: at('16:59'), rand: mulberry32(1) });
    if (!late.ok) throw new Error();
    await runTick(repo, at('17:00'));
    // …but lands after close
    expect(await repo.createBooking(late.value)).toEqual({ ok: false, error: 'Booking closed for today' });
    expect((await repo.listBookings({ offeringId: o.id })).some((b) => b.status === 'active')).toBe(false);
  });

  it('cancel goes through the repo and is refused after close', async () => {
    const repo = fresh();
    await runTick(repo, at('09:00'));
    const r = await book(repo, 'u-21BCE1001', 1, '10:00');
    if (!r.ok) throw new Error();
    expect((await repo.cancelBooking(r.value.id, at('16:00'))).ok).toBe(true);
    const r2 = await book(repo, 'u-21BCE1002', 1, '10:00');
    if (!r2.ok) throw new Error();
    await runTick(repo, at('17:00'));
    expect(await repo.cancelBooking(r2.value.id, at('17:01'))).toEqual({ ok: false, error: 'Cancellation closed at 5 pm' });
  });

  it('marks a coupon served only once', async () => {
    const repo = fresh();
    await runTick(repo, at('09:00'));
    const r = await book(repo, 'u-21BCE1001', 1, '10:00');
    if (!r.ok) throw new Error();
    await runTick(repo, at('17:00'));
    expect((await repo.markServed(r.value.id, at('19:40').toISOString())).ok).toBe(true);
    expect((await repo.markServed(r.value.id, at('19:41').toISOString())).ok).toBe(false);
  });

  it('records a purchase as a stock batch and on the offering', async () => {
    const repo = fresh();
    await runTick(repo, at('09:00'));
    const [o] = await todays(repo);
    const before = (await repo.listBatches('item-paneer')).length;
    await repo.recordPurchase(o.id, 6450, at('13:00'));
    const [after] = await todays(repo);
    expect(after.purchasedGrams).toBe(6450);
    expect((await repo.listBatches('item-paneer')).length).toBe(before + 1);
  });

  it('notifies subscribers on writes', async () => {
    const repo = fresh();
    let calls = 0;
    const off = repo.subscribe(() => calls++);
    await runTick(repo, at('09:00'));
    off();
    expect(calls).toBeGreaterThan(0);
  });
});

describe('runTick with simulated students (demo)', () => {
  it('adds other students\' bookings once, spread over 8 am–5 pm, never for the quick-login students', async () => {
    const repo = fresh();
    await runTick(repo, at('09:00'), { simulateStudents: true });
    const [o] = await todays(repo);
    const sim = await repo.listBookings({ offeringId: o.id });
    const plates = sim.reduce((s, b) => s + b.platesRequested, 0);
    expect(plates).toBeGreaterThan(25);
    expect(plates).toBeLessThan(80);
    for (const b of sim) {
      expect(['u-21BCE1001', 'u-21BCE1002']).not.toContain(b.userId);
      expect(b.createdAt >= at('08:00').toISOString() && b.createdAt < at('17:00').toISOString()).toBe(true);
    }
    await runTick(repo, at('09:05'), { simulateStudents: true });
    expect(await repo.listBookings({ offeringId: o.id })).toHaveLength(sim.length);
  });

  it('adds nothing without the option', async () => {
    const repo = fresh();
    await runTick(repo, at('09:00'));
    const [o] = await todays(repo);
    expect(await repo.listBookings({ offeringId: o.id })).toHaveLength(0);
  });
});

