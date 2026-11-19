import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Booking, Offering, Result, User } from '../domain/types';
import { err, ok } from '../domain/types';
import { newBatch } from '../domain/stock';
import { newId, type Repo } from './repo';

const snake = (k: string) => k.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
const camel = (k: string) => k.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const toRow = (o: any): Record<string, unknown> => Object.fromEntries(Object.entries(o).map(([k, v]) => [snake(k), v]));
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fromRow = <T>(r: any): T => {
  const out = Object.fromEntries(Object.entries(r).map(([k, v]) => [camel(k), v]));
  // normalise timestamptz to ISO-with-Z so string comparisons match the domain's
  for (const k of ['cutoffAt', 'closedAt', 'createdAt', 'cancelledAt', 'servedAt', 'writtenOffAt', 'readAt']) {
    if (typeof out[k] === 'string') out[k] = new Date(out[k] as string).toISOString();
  }
  return out as T;
};
const rows = <T>(data: unknown[] | null): T[] => (data ?? []).map((r) => fromRow<T>(r));
const msg = (e: { message: string }) => e.message.replace(/^.*?:\s*/, '') || e.message;

export function createSupabaseRepo(url: string, anonKey: string): Repo {
  const db: SupabaseClient = createClient(url, anonKey);
  const must = <T>(r: { data: T; error: { message: string } | null }): T => {
    if (r.error) throw new Error(r.error.message);
    return r.data;
  };

  return {
    mode: 'supabase',
    async getClock() {
      const d = must(await db.from('app_settings').select('demo_now, demo_set_at').eq('id', 1).single()) as Record<string, string | null>;
      return {
        demoNow: d.demo_now ? new Date(d.demo_now).toISOString() : null,
        demoSetAt: d.demo_set_at ? new Date(d.demo_set_at).toISOString() : null,
      };
    },
    async setClock(c) {
      must(await db.from('app_settings').update({ demo_now: c.demoNow, demo_set_at: c.demoSetAt }).eq('id', 1));
    },
    async listItems() { return rows(must(await db.from('items').select('*').order('name'))); },
    async upsertItem(i) { must(await db.from('items').upsert(toRow(i))); },
    async listUsers() { return rows<User>(must(await db.from('users').select('*').order('roll_no'))); },

    async listOfferings(q) {
      let s = db.from('offerings').select('*').order('date');
      if (q.from) s = s.gte('date', q.from);
      if (q.to) s = s.lte('date', q.to);
      if (q.itemId) s = s.eq('item_id', q.itemId);
      return rows<Offering>(must(await s));
    },
    async insertOfferingIfAbsent(o) {
      const d = must(await db.from('offerings').upsert(toRow(o), { onConflict: 'item_id,date', ignoreDuplicates: true }).select('id')) as unknown[];
      return d.length > 0;
    },
    async recordPurchase(offeringId, grams, now) {
      if (!Number.isInteger(grams) || grams <= 0) return err('Enter a quantity above 0');
      const o = rows<Offering>(must(await db.from('offerings').select('*').eq('id', offeringId)))[0];
      if (!o) return err('Offering not found');
      const item = (await this.listItems()).find((i) => i.id === o.itemId)!;
      void now;
      const { error } = await db.rpc('record_purchase', { p_offering: offeringId, p_batch: toRow(newBatch({ id: newId(), item, grams, purchasedOn: o.date })) });
      if (error) return err(msg(error));
      return ok(rows<Offering>(must(await db.from('offerings').select('*').eq('id', offeringId)))[0]);
    },

    async listBookings(q) {
      let s = db.from('bookings').select('*').order('created_at');
      if (q.offeringId) s = s.eq('offering_id', q.offeringId);
      if (q.userId) s = s.eq('user_id', q.userId);
      if (q.token) s = s.eq('token', q.token);
      if (q.shortCode) s = s.eq('short_code', q.shortCode);
      return rows<Booking>(must(await s));
    },
    async createBooking(b): Promise<Result<Booking>> {
      const { error } = await db.rpc('create_booking', { p: toRow(b) });
      return error ? err(msg(error)) : ok(b);
    },
    async cancelBooking(id, now) {
      const { error } = await db.rpc('cancel_booking', { p_id: id, p_at: now.toISOString() });
      if (error) return err(msg(error));
      return ok(rows<Booking>(must(await db.from('bookings').select('*').eq('id', id)))[0]);
    },
    async applyClose(offeringId, out) {
      const at = out.offering.closedAt;
      const payload = {
        offering: toRow(out.offering),
        bookings: out.bookings.map(toRow),
        charges: out.charges.map(toRow),
        batches: out.batches.filter((b) => b.itemId === out.offering.itemId).map(toRow),
        notifications: out.notifications.map((d) => toRow({ ...d, id: newId(), createdAt: at, readAt: null })),
      };
      return must(await db.rpc('apply_close', { p_offering: offeringId, p: payload })) as boolean;
    },
    async markServed(bookingId, at) {
      const okk = must(await db.rpc('mark_served', { p_id: bookingId, p_at: at })) as boolean;
      if (!okk) return err('Already served');
      return ok(rows<Booking>(must(await db.from('bookings').select('*').eq('id', bookingId)))[0]);
    },
    async incrementWalkin(offeringId) {
      const okk = must(await db.rpc('increment_walkin', { p_offering: offeringId })) as boolean;
      if (!okk) return err('No walk-in plates left');
      return ok(rows<Offering>(must(await db.from('offerings').select('*').eq('id', offeringId)))[0]);
    },

    async listBatches(itemId) {
      let s = db.from('stock_batches').select('*').order('purchased_on');
      if (itemId) s = s.eq('item_id', itemId);
      return rows(must(await s));
    },
    async saveBatches(list) { if (list.length) must(await db.from('stock_batches').upsert(list.map(toRow))); },
    async listCharges(userId, month) {
      const [y, m] = month.split('-').map(Number);
      const next = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;
      return rows(must(await db.from('charges').select('*').eq('user_id', userId).gte('charged_on', `${month}-01`).lt('charged_on', next).order('charged_on')));
    },

    async listNotifications(user) {
      const aud = user.role === 'student' ? 'students' : 'mess';
      return rows(must(await db.from('notifications').select('*')
        .or(`and(audience.eq.user,user_id.eq.${user.id}),audience.eq.${aud}`).order('created_at', { ascending: false }).limit(50)));
    },
    async sentKeys() {
      const d = must(await db.from('notifications').select('dedupe_key')) as { dedupe_key: string }[];
      return new Set(d.map((r) => r.dedupe_key));
    },
    async insertNotifications(drafts, now) {
      if (!drafts.length) return;
      must(await db.from('notifications').upsert(
        drafts.map((d) => toRow({ ...d, id: newId(), createdAt: now.toISOString(), readAt: null })),
        { onConflict: 'dedupe_key', ignoreDuplicates: true },
      ));
    },
    async markRead(ids, now) {
      if (ids.length) must(await db.from('notifications').update({ read_at: now.toISOString() }).in('id', ids).is('read_at', null));
    },

    async resetDemo(seed) {
      must(await db.rpc('wipe_demo'));
      const chunks = <T>(a: T[], n = 500) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));
      must(await db.from('users').insert(seed.users.map(toRow)));
      must(await db.from('items').insert(seed.items.map(toRow)));
      for (const c of chunks(seed.offerings)) must(await db.from('offerings').insert(c.map(toRow)));
      for (const c of chunks(seed.bookings)) must(await db.from('bookings').insert(c.map(toRow)));
      for (const c of chunks(seed.charges)) must(await db.from('charges').insert(c.map(toRow)));
      for (const c of chunks(seed.batches)) must(await db.from('stock_batches').insert(c.map(toRow)));
    },
    subscribe(cb) {
      const ch = db.channel('mess-extras');
      for (const table of ['offerings', 'bookings', 'notifications', 'app_settings', 'stock_batches']) {
        ch.on('postgres_changes', { event: '*', schema: 'public', table }, () => cb());
      }
      ch.subscribe();
      return () => { void db.removeChannel(ch); };
    },
  };
}
