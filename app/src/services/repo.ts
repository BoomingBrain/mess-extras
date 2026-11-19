import type { Booking, Charge, Item, Notification, NotificationDraft, Offering, Result, StockBatch, User } from '../domain/types';
import type { ClockState } from '../domain/clock';
import type { CloseOutput } from '../domain/closeDay';
import type { SeedData } from '../domain/seed';

export interface BookingQuery {
  offeringId?: string;
  userId?: string;
  token?: string;
  shortCode?: string;
}

/**
 * Storage boundary. Every write that can race (booking, cancel, close, serve, walk-in)
 * is atomic and re-checks state inside the store.
 */
export interface Repo {
  readonly mode: 'local' | 'supabase';
  getClock(): Promise<ClockState>;
  setClock(s: ClockState): Promise<void>;

  listItems(): Promise<Item[]>;
  upsertItem(i: Item): Promise<void>;
  listUsers(): Promise<User[]>;

  listOfferings(q: { from?: string; to?: string; itemId?: string }): Promise<Offering[]>;
  /** true when this call inserted it (false if another client already had). */
  insertOfferingIfAbsent(o: Offering): Promise<boolean>;
  recordPurchase(offeringId: string, grams: number, now: Date): Promise<Result<Offering>>;

  listBookings(q: BookingQuery): Promise<Booking[]>;
  /** Fails with 'Booking closed for today' unless the offering is still open. */
  createBooking(b: Booking): Promise<Result<Booking>>;
  cancelBooking(id: string, now: Date): Promise<Result<Booking>>;
  /** Applies a computed close atomically. false when it was already closed. */
  applyClose(offeringId: string, out: CloseOutput): Promise<boolean>;
  markServed(bookingId: string, at: string): Promise<Result<Booking>>;
  incrementWalkin(offeringId: string): Promise<Result<Offering>>;

  listBatches(itemId?: string): Promise<StockBatch[]>;
  saveBatches(b: StockBatch[]): Promise<void>;
  listCharges(userId: string, month: string): Promise<Charge[]>;

  listNotifications(user: User): Promise<Notification[]>;
  sentKeys(): Promise<Set<string>>;
  /** Drafts whose dedupeKey already exists are ignored. */
  insertNotifications(d: NotificationDraft[], now: Date): Promise<void>;
  markRead(ids: string[], now: Date): Promise<void>;

  resetDemo(seed: SeedData): Promise<void>;
  /** Called after any change (local writes, other tabs, realtime). Returns unsubscribe. */
  subscribe(cb: () => void): () => void;
}

export const newId = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `id-${Math.random().toString(36).slice(2)}`;
