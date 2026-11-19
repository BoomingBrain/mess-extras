import type { Repo } from './repo';
import { newId } from './repo';
import { planTick } from '../domain/tick';
import { newOffering } from '../domain/offering';
import { closeDay } from '../domain/closeDay';
import { expireBatches } from '../domain/stock';
import { DEMO_STUDENT_IDS, historyFrom, simulatedBookings, trueDemand } from '../domain/seed';
import { cryptoRand } from '../domain/random';
import { purchaseReadyDraft, reminderDraft } from '../domain/notifications';

/**
 * Execute whatever transitions are due at `now`. Safe to call from many clients at once:
 * offering creation is unique per (item, date), notifications dedupe by key, and the
 * close is applied atomically by the repo (the loser's computed close is discarded).
 */
export interface TickOptions {
  /** Demo only: when today's offering is created, also create other students' bookings for the day. */
  simulateStudents?: boolean;
}

export async function runTick(repo: Repo, now: Date, opts: TickOptions = {}): Promise<void> {
  const [items, offerings, sentKeys] = await Promise.all([repo.listItems(), repo.listOfferings({}), repo.sentKeys()]);
  const actions = planTick({ now, items, offerings, sentKeys });

  for (const a of actions) {
    if (a.kind === 'close') {
      const o = (await repo.listOfferings({})).find((x) => x.id === a.offeringId);
      if (!o || o.status !== 'open') continue;
      const item = items.find((i) => i.id === o.itemId)!;
      const [bookings, batches, all] = await Promise.all([
        repo.listBookings({ offeringId: o.id }), repo.listBatches(item.id), repo.listOfferings({ itemId: item.id }),
      ]);
      const out = closeDay({ offering: o, item, bookings, batches, history: historyFrom(all, item.id), now, newId });
      await repo.applyClose(o.id, out);
    } else if (a.kind === 'expireStock') {
      const batches = await repo.listBatches();
      const r = expireBatches(batches, a.date, now.toISOString());
      const changed = r.batches.filter((b, i) => b.writtenOffAt !== batches[i].writtenOffAt);
      if (changed.length) await repo.saveBatches(changed);
    } else if (a.kind === 'createOffering') {
      const item = items.find((i) => i.id === a.itemId)!;
      const [batches, all] = await Promise.all([repo.listBatches(item.id), repo.listOfferings({ itemId: item.id })]);
      const o = newOffering({ id: newId(), item, date: a.date, history: historyFrom(all, item.id), batches });
      const inserted = await repo.insertOfferingIfAbsent(o);
      if (inserted && opts.simulateStudents) {
        const students = (await repo.listUsers()).filter((u) => u.role === 'student' && !DEMO_STUDENT_IDS.includes(u.id));
        const { booked } = trueDemand(item, a.date, 6, cryptoRand);
        for (const b of simulatedBookings({ offering: o, item, students, booked, rand: cryptoRand, newId })) await repo.createBooking(b);
      }
      const stored = (await repo.listOfferings({ from: a.date, to: a.date, itemId: item.id }))[0];
      if (stored) await repo.insertNotifications([purchaseReadyDraft(stored, item)], now);
    } else if (a.kind === 'remind') {
      const o = offerings.find((x) => x.id === a.offeringId)!;
      const item = items.find((i) => i.id === o.itemId)!;
      await repo.insertNotifications([reminderDraft(o, item)], now);
    }
  }
}
