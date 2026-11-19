import type { Booking, Offering, Result } from './types';
import { err, ok } from './types';
import { istClock, prettyDate } from './time';

export function redeem(args: {
  booking: Booking | undefined;
  offering: Offering | undefined;
  today: string;
  now: Date;
}): Result<Booking> {
  const { booking: b, offering: o } = args;
  if (!b || !o) return err('Coupon not found');
  if (b.status === 'cancelled' || b.status === 'shortfall_cancelled') return err('Booking was cancelled');
  if (b.status === 'active') return err('Bookings for tonight are not confirmed yet');
  if (o.date !== args.today) return err(`This coupon is for ${prettyDate(o.date)}`);
  if (b.servedAt) return err(`Already served at ${istClock(b.servedAt)}`);
  return ok({ ...b, servedAt: args.now.toISOString() });
}

export function sellWalkin(o: Offering): Result<Offering> {
  if (o.status !== 'closed') return err('Not closed yet');
  if (o.walkinsSold >= (o.bufferPlates ?? 0)) return err('No walk-in plates left');
  return ok({ ...o, walkinsSold: o.walkinsSold + 1 });
}

export interface EndOfDay {
  booked: number;
  served: number;
  noShows: number;
  walkins: number;
  cooked: number;
  cookedWaste: number;
}

/** All figures in plates. */
export function endOfDay(o: Offering, bookings: Booking[]): EndOfDay {
  const confirmed = bookings.filter((b) => b.status === 'confirmed');
  const booked = confirmed.reduce((s, b) => s + (b.platesConfirmed ?? 0), 0);
  const served = confirmed.filter((b) => b.servedAt).reduce((s, b) => s + (b.platesConfirmed ?? 0), 0);
  const cooked = (o.confirmedPlates ?? 0) + (o.bufferPlates ?? 0);
  return {
    booked, served, noShows: booked - served, walkins: o.walkinsSold, cooked,
    cookedWaste: Math.max(0, cooked - served - o.walkinsSold),
  };
}
