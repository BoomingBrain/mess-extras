import type { Booking, Charge, Item, Notification, Offering, StockBatch, User } from '../domain/types';
import { err, ok } from '../domain/types';
import type { ClockState } from '../domain/clock';
import type { SeedData } from '../domain/seed';
import { cancelBooking } from '../domain/booking';
import { sellWalkin } from '../domain/counter';
import { newBatch } from '../domain/stock';
import { newId, type Repo } from './repo';

export interface MemoryState {
  clock: ClockState;
  items: Item[];
  users: User[];
  offerings: Offering[];
  bookings: Booking[];
  charges: Charge[];
  batches: StockBatch[];
  notifications: Notification[];
}

export const stateFromSeed = (s: SeedData): MemoryState => ({
  clock: { demoNow: null, demoSetAt: null },
  items: s.items, users: s.users, offerings: s.offerings, bookings: s.bookings, charges: s.charges,
  batches: s.batches, notifications: [],
});

export interface Persistence {
  load(): MemoryState | null;
  save(s: MemoryState): void;
  /** Register for changes made elsewhere (e.g. another tab). */
  watch?(onExternal: (s: MemoryState) => void): void;
}

const clone = <T>(x: T): T => structuredClone(x);

/**
 * In-memory Repo. Each method mutates synchronously (no await between check and write),
 * which makes it atomic in a single JS thread — the same guarantee the SQL row locks give.
 */
export function createMemoryRepo(seed: SeedData, persistence?: Persistence): Repo {
  let s: MemoryState = persistence?.load() ?? stateFromSeed(seed);
  const subs = new Set<() => void>();
  const notify = () => subs.forEach((cb) => cb());
  const commit = () => {
    persistence?.save(s);
    notify();
  };
  persistence?.watch?.((ext) => {
    s = ext;
    notify();
  });

  const findOffering = (id: string) => s.offerings.find((o) => o.id === id);
  const findBooking = (id: string) => s.bookings.find((b) => b.id === id);
  const replace = <T extends { id: string }>(arr: T[], next: T) => arr.map((x) => (x.id === next.id ? next : x));

  const repo: Repo = {
    mode: 'local',
    async getClock() { return clone(s.clock); },
    async setClock(c) { s = { ...s, clock: c }; commit(); },

    async listItems() { return clone(s.items); },
    async upsertItem(i) {
      s = { ...s, items: s.items.some((x) => x.id === i.id) ? replace(s.items, i) : [...s.items, i] };
      commit();
    },
    async listUsers() { return clone(s.users); },

    async listOfferings(q) {
      return clone(s.offerings.filter((o) =>
        (!q.from || o.date >= q.from) && (!q.to || o.date <= q.to) && (!q.itemId || o.itemId === q.itemId)));
    },
    async insertOfferingIfAbsent(o) {
      if (s.offerings.some((x) => x.itemId === o.itemId && x.date === o.date)) return false;
      s = { ...s, offerings: [...s.offerings, o] };
      commit();
      return true;
    },
    async recordPurchase(offeringId, grams, now) {
      const o = findOffering(offeringId);
      if (!o) return err('Offering not found');
      if (o.status !== 'open') return err('Bookings already closed');
      if (!Number.isInteger(grams) || grams <= 0) return err('Enter a quantity above 0');
      const item = s.items.find((i) => i.id === o.itemId)!;
      const next = { ...o, purchasedGrams: (o.purchasedGrams ?? 0) + grams };
      const b = newBatch({ id: newId(), item, grams, purchasedOn: o.date });
      void now;
      s = { ...s, offerings: replace(s.offerings, next), batches: [...s.batches, b] };
      commit();
      return ok(clone(next));
    },

    async listBookings(q) {
      return clone(s.bookings.filter((b) =>
        (!q.offeringId || b.offeringId === q.offeringId) && (!q.userId || b.userId === q.userId) &&
        (!q.token || b.token === q.token) && (!q.shortCode || b.shortCode === q.shortCode)));
    },
    async createBooking(b) {
      const o = findOffering(b.offeringId);
      if (!o) return err('Offering not found');
      if (o.status !== 'open') return err('Booking closed for today');
      s = { ...s, bookings: [...s.bookings, b] };
      commit();
      return ok(clone(b));
    },
    async cancelBooking(id, now) {
      const b = findBooking(id);
      const o = b && findOffering(b.offeringId);
      if (!b || !o) return err('Booking not found');
      const r = cancelBooking(b, o, now);
      if (!r.ok) return r;
      s = { ...s, bookings: replace(s.bookings, r.value) };
      commit();
      return ok(clone(r.value));
    },
    async applyClose(offeringId, out) {
      const o = findOffering(offeringId);
      if (!o || o.status === 'closed') return false;
      const changed = new Map(out.bookings.map((b) => [b.id, b]));
      const batchById = new Map(out.batches.filter((b) => b.itemId === o.itemId).map((b) => [b.id, b]));
      const known = new Set(s.batches.map((b) => b.id));
      const keys = new Set(s.notifications.map((n) => n.dedupeKey));
      const at = out.offering.closedAt ?? new Date().toISOString();
      s = {
        ...s,
        offerings: replace(s.offerings, out.offering),
        bookings: s.bookings.map((b) => changed.get(b.id) ?? b),
        charges: [...s.charges, ...out.charges.filter((c) => !s.charges.some((x) => x.bookingId === c.bookingId))],
        batches: [...s.batches.map((b) => batchById.get(b.id) ?? b), ...[...batchById.values()].filter((b) => !known.has(b.id))],
        notifications: [
          ...s.notifications,
          ...out.notifications.filter((d) => !keys.has(d.dedupeKey)).map((d) => ({ ...d, id: newId(), createdAt: at, readAt: null })),
        ],
      };
      commit();
      return true;
    },
    async markServed(bookingId, at) {
      const b = findBooking(bookingId);
      if (!b) return err('Coupon not found');
      if (b.servedAt) return err('Already served');
      const next = { ...b, servedAt: at };
      s = { ...s, bookings: replace(s.bookings, next) };
      commit();
      return ok(clone(next));
    },
    async incrementWalkin(offeringId) {
      const o = findOffering(offeringId);
      if (!o) return err('Offering not found');
      const r = sellWalkin(o);
      if (!r.ok) return r;
      s = { ...s, offerings: replace(s.offerings, r.value) };
      commit();
      return ok(clone(r.value));
    },

    async listBatches(itemId) { return clone(s.batches.filter((b) => !itemId || b.itemId === itemId)); },
    async saveBatches(list) {
      const byId = new Map(list.map((b) => [b.id, b]));
      const known = new Set(s.batches.map((b) => b.id));
      s = { ...s, batches: [...s.batches.map((b) => byId.get(b.id) ?? b), ...list.filter((b) => !known.has(b.id))] };
      commit();
    },
    async listCharges(userId, month) {
      return clone(s.charges.filter((c) => c.userId === userId && c.chargedOn.startsWith(month)));
    },

    async listNotifications(user) {
      return clone(s.notifications
        .filter((n) => (n.audience === 'user' && n.userId === user.id) ||
          (n.audience === 'students' && user.role === 'student') || (n.audience === 'mess' && user.role === 'mess'))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
    },
    async sentKeys() { return new Set(s.notifications.map((n) => n.dedupeKey)); },
    async insertNotifications(drafts, now) {
      const keys = new Set(s.notifications.map((n) => n.dedupeKey));
      const fresh = drafts.filter((d) => !keys.has(d.dedupeKey));
      if (!fresh.length) return;
      s = { ...s, notifications: [...s.notifications, ...fresh.map((d) => ({ ...d, id: newId(), createdAt: now.toISOString(), readAt: null }))] };
      commit();
    },
    async markRead(ids, now) {
      const set = new Set(ids);
      s = { ...s, notifications: s.notifications.map((n) => (set.has(n.id) && !n.readAt ? { ...n, readAt: now.toISOString() } : n)) };
      commit();
    },

    async resetDemo(seedData) {
      s = stateFromSeed(seedData);
      commit();
    },
    subscribe(cb) {
      subs.add(cb);
      return () => subs.delete(cb);
    },
  };
  return repo;
}
