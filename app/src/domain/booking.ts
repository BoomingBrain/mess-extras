import type { Booking, Item, Offering, Result } from './types';
import { err, ok } from './types';

export const MIN_PLATES = 1;
export const MAX_PLATES = 10;
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export function canBook(offering: Offering, now: Date): Result<true> {
  if (offering.status !== 'open' || now.getTime() >= Date.parse(offering.cutoffAt)) {
    return err('Booking closed for today');
  }
  return ok(true);
}

export function validatePlates(n: number): Result<number> {
  return Number.isInteger(n) && n >= MIN_PLATES && n <= MAX_PLATES ? ok(n) : err('Choose 1 to 10 plates');
}

const pick = (alphabet: string, len: number, rand: () => number) =>
  Array.from({ length: len }, () => alphabet[Math.floor(rand() * alphabet.length)]).join('');

export function makeBooking(args: {
  id: string;
  offering: Offering;
  item: Item;
  userId: string;
  plates: number;
  now: Date;
  rand: () => number;
}): Result<Booking> {
  const open = canBook(args.offering, args.now);
  if (!open.ok) return open;
  const plates = validatePlates(args.plates);
  if (!plates.ok) return plates;
  return ok({
    id: args.id,
    offeringId: args.offering.id,
    userId: args.userId,
    platesRequested: plates.value,
    platesConfirmed: null,
    pricePaise: args.item.pricePaise,
    status: 'active',
    token: pick('0123456789abcdef', 32, args.rand),
    shortCode: `${args.item.name[0].toUpperCase()}-${pick(CODE_ALPHABET, 6, args.rand)}`,
    createdAt: args.now.toISOString(),
    cancelledAt: null,
    servedAt: null,
  });
}

export function cancelBooking(b: Booking, offering: Offering, now: Date): Result<Booking> {
  if (b.status !== 'active') return err('Booking is not active');
  if (offering.status !== 'open' || now.getTime() >= Date.parse(offering.cutoffAt)) {
    return err('Cancellation closed at 5 pm');
  }
  return ok({ ...b, status: 'cancelled', cancelledAt: now.toISOString() });
}
