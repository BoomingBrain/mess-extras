import type { Booking, Charge, DayHistory, Item, NotificationDraft, Offering, StockBatch } from './types';
import { consumeFifo, newBatch, usableGrams } from './stock';
import { sameWeekdayHistory } from './forecast';
import { confirmDraft, cookSheetDraft, shortfallAlertDraft, trimDraft } from './notifications';

export interface CloseInput {
  offering: Offering;
  item: Item;
  bookings: Booking[];
  batches: StockBatch[];
  history: DayHistory[];
  now: Date;
  newId: () => string;
}

export interface CloseOutput {
  offering: Offering;
  /** Only the bookings this close changed */
  bookings: Booking[];
  charges: Charge[];
  /** Full new batch list (new assumed batch included) */
  batches: StockBatch[];
  notifications: NotificationDraft[];
}

export function walkinBuffer(history: DayHistory[], date: string, spare: number): number {
  const past = sameWeekdayHistory(history, date);
  if (past.length === 0) return 0;
  const avg = Math.round(past.reduce((s, h) => s + h.walkins, 0) / past.length);
  return Math.max(0, Math.min(spare, avg));
}

export function closeDay(input: CloseInput): CloseOutput {
  const { item, now, newId } = input;
  if (input.offering.status === 'closed') throw new Error('Offering already closed');
  let offering = { ...input.offering };
  let batches = input.batches;

  // 1. Forgotten purchase: assume the suggestion was bought.
  if (offering.purchasedGrams === null) {
    batches = [...batches, newBatch({ id: newId(), item, grams: offering.forecastBuyGrams, purchasedOn: offering.date })];
    offering = { ...offering, purchasedGrams: offering.forecastBuyGrams, purchaseAssumed: true };
  }

  // 2. Capacity from usable raw stock.
  const capacity = Math.floor(usableGrams(batches, item.id, offering.date) / item.gramsPerPlate);

  // 3. Trim latest bookings first until they fit.
  const active = input.bookings.filter((b) => b.status === 'active');
  const booked = active.reduce((s, b) => s + b.platesRequested, 0);
  let excess = Math.max(0, booked - capacity);
  const latestFirst = [...active].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const changed: Booking[] = [];
  const trimmed: Booking[] = [];
  for (const b of latestFirst) {
    const cut = Math.min(excess, b.platesRequested);
    excess -= cut;
    const confirmed = b.platesRequested - cut;
    const next: Booking = { ...b, platesConfirmed: confirmed, status: confirmed === 0 ? 'shortfall_cancelled' : 'confirmed' };
    changed.push(next);
    if (cut > 0) trimmed.push(next);
  }
  changed.sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
  const confirmedBookings = changed.filter((b) => b.status === 'confirmed');
  const confirmedPlates = confirmedBookings.reduce((s, b) => s + (b.platesConfirmed ?? 0), 0);

  // 4. Walk-in buffer.
  const buffer = walkinBuffer(input.history, offering.date, capacity - confirmedPlates);

  // 5. Charges.
  const charges: Charge[] = confirmedBookings.map((b) => ({
    id: newId(), userId: b.userId, bookingId: b.id, amountPaise: (b.platesConfirmed ?? 0) * b.pricePaise, chargedOn: offering.date,
  }));

  // 6. Stock.
  batches = consumeFifo(batches, item.id, (confirmedPlates + buffer) * item.gramsPerPlate, offering.date).batches;

  offering = {
    ...offering, status: 'closed', closedAt: now.toISOString(),
    capacityPlates: capacity, requestedPlates: booked, confirmedPlates, bufferPlates: buffer,
  };

  // 7. Notifications.
  const trimmedPlates = trimmed.reduce((s, b) => s + b.platesRequested - (b.platesConfirmed ?? 0), 0);
  const notifications: NotificationDraft[] = [
    ...confirmedBookings.filter((b) => !trimmed.includes(b)).map((b) => confirmDraft(b, item)),
    ...trimmed.map((b) => trimDraft(b, item)),
    ...trimmed.filter((b) => b.status === 'confirmed').map((b) => confirmDraft(b, item)),
    cookSheetDraft(offering, item),
    ...(trimmed.length ? [shortfallAlertDraft(offering, item, trimmedPlates)] : []),
  ];

  return { offering, bookings: changed, charges, batches, notifications };
}
