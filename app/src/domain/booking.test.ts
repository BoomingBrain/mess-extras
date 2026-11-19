import { canBook, validatePlates, makeBooking, cancelBooking } from './booking';
import { istAt } from './time';
import { paneer, chicken, offering, booking } from '../test/fixtures';
import { mulberry32 } from './random';

const at = (hhmm: string) => istAt('2026-11-19', hhmm);
const rand = mulberry32(1);

describe('canBook', () => {
  it('allows booking at 16:59 and blocks at 17:00', () => {
    expect(canBook(offering(), at('16:59')).ok).toBe(true);
    expect(canBook(offering(), at('17:00'))).toEqual({ ok: false, error: 'Booking closed for today' });
  });
  it('blocks a closed offering even in the morning', () => {
    expect(canBook(offering({ status: 'closed' }), at('10:00')).ok).toBe(false);
  });
});

describe('validatePlates', () => {
  it.each([0, 11, 2.5, -1])('rejects %s', (n) => {
    expect(validatePlates(n)).toEqual({ ok: false, error: 'Choose 1 to 10 plates' });
  });
  it.each([1, 10])('accepts %s', (n) => expect(validatePlates(n).ok).toBe(true));
});

describe('makeBooking', () => {
  it('snapshots price and creates token and short code', () => {
    const r = makeBooking({ id: 'b9', offering: offering(), item: paneer, userId: 'u1', plates: 2, now: at('12:00'), rand });
    if (!r.ok) throw new Error(r.error);
    expect(r.value).toMatchObject({ pricePaise: 6000, platesRequested: 2, status: 'active', platesConfirmed: null });
    expect(r.value.token).toMatch(/^[0-9a-f]{32}$/);
    expect(r.value.shortCode).toMatch(/^P-[A-HJ-NP-Z2-9]{6}$/);
    expect(r.value.createdAt).toBe(at('12:00').toISOString());
  });
  it('uses C- prefix for chicken', () => {
    const r = makeBooking({ id: 'b9', offering: offering({ itemId: chicken.id }), item: chicken, userId: 'u1', plates: 1, now: at('12:00'), rand });
    expect(r.ok && r.value.shortCode.startsWith('C-')).toBe(true);
  });
  it('fails after cutoff and for bad plate counts', () => {
    expect(makeBooking({ id: 'b', offering: offering(), item: paneer, userId: 'u', plates: 1, now: at('17:00'), rand }))
      .toEqual({ ok: false, error: 'Booking closed for today' });
    expect(makeBooking({ id: 'b', offering: offering(), item: paneer, userId: 'u', plates: 11, now: at('10:00'), rand }).ok)
      .toBe(false);
  });
});

describe('cancelBooking', () => {
  it('cancels before cutoff', () => {
    const r = cancelBooking(booking(), offering(), at('16:00'));
    expect(r.ok && r.value).toMatchObject({ status: 'cancelled', cancelledAt: at('16:00').toISOString() });
  });
  it('refuses after cutoff', () => {
    expect(cancelBooking(booking(), offering(), at('17:00'))).toEqual({ ok: false, error: 'Cancellation closed at 5 pm' });
  });
  it('refuses a second cancel', () => {
    const first = cancelBooking(booking(), offering(), at('16:00'));
    if (!first.ok) throw new Error();
    expect(cancelBooking(first.value, offering(), at('16:01'))).toEqual({ ok: false, error: 'Booking is not active' });
  });
});

describe('mulberry32', () => {
  it('is deterministic for a seed', () => {
    const a = mulberry32(42), b = mulberry32(42);
    expect([a(), a()]).toEqual([b(), b()]);
  });
});
