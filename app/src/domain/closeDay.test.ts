import { closeDay } from './closeDay';
import { istAt } from './time';
import { paneer, offering, booking, batch, hist } from '../test/fixtures';
import type { Booking } from './types';

const now = istAt('2026-11-19', '17:00');
let n = 0;
const newId = () => `id-${++n}`;
const stock = (grams: number) => [batch({ gramsInitial: grams, gramsRemaining: grams })];
const at = (hhmm: string) => istAt('2026-11-19', hhmm).toISOString();

function run(bookings: Booking[], grams: number, extra: Partial<Parameters<typeof closeDay>[0]> = {}) {
  return closeDay({ offering: offering(), item: paneer, bookings, batches: stock(grams), history: [], now, newId, ...extra });
}

describe('closeDay — no shortfall', () => {
  it('confirms all active bookings and charges them', () => {
    const bs = [booking({ id: 'a', platesRequested: 3 }), booking({ id: 'b', platesRequested: 2 }), booking({ id: 'c', platesRequested: 1 })];
    const r = run(bs, 50 * 150);
    expect(r.bookings.every((b) => b.status === 'confirmed' && b.platesConfirmed === b.platesRequested)).toBe(true);
    expect(r.charges).toHaveLength(3);
    expect(r.charges.reduce((s, c) => s + c.amountPaise, 0)).toBe(6 * 6000);
    expect(r.offering).toMatchObject({ status: 'closed', confirmedPlates: 6, capacityPlates: 50, closedAt: now.toISOString() });
  });
});

describe('closeDay — shortfall', () => {
  const bs = () => [
    booking({ id: 'A', platesRequested: 3, createdAt: at('16:00') }),
    booking({ id: 'B', platesRequested: 2, createdAt: at('16:30') }),
    booking({ id: 'C', platesRequested: 2, createdAt: at('16:45') }),
  ];
  it('cancels the latest booking entirely when it cannot be partly served', () => {
    const r = run(bs(), 5 * 150);
    const byId = Object.fromEntries(r.bookings.map((b) => [b.id, b]));
    expect(byId.C).toMatchObject({ status: 'shortfall_cancelled', platesConfirmed: 0 });
    expect(byId.B).toMatchObject({ status: 'confirmed', platesConfirmed: 2 });
    expect(byId.A).toMatchObject({ status: 'confirmed', platesConfirmed: 3 });
    expect(r.charges.find((c) => c.bookingId === 'C')).toBeUndefined();
    expect(r.notifications.find((d) => d.dedupeKey === 'trim:C')!.body).toBe(
      "Sorry, Paneer ran short. Your booking is cancelled and you won't be charged.",
    );
    expect(r.notifications.some((d) => d.dedupeKey === 'shortfall:2026-11-19:item-paneer')).toBe(true);
  });
  it('records requested plates so history is not censored by the shortfall', () => {
    const r = run(bs(), 5 * 150);
    expect(r.offering).toMatchObject({ requestedPlates: 7, confirmedPlates: 5 });
  });
  it('partially trims the latest booking', () => {
    const r = run(bs(), 6 * 150);
    const c = r.bookings.find((b) => b.id === 'C')!;
    expect(c).toMatchObject({ status: 'confirmed', platesConfirmed: 1 });
    expect(r.charges.find((x) => x.bookingId === 'C')!.amountPaise).toBe(6000);
    expect(r.notifications.find((d) => d.dedupeKey === 'trim:C')!.body).toBe('Sorry, Paneer ran short. 1 of 2 plates confirmed.');
  });
});

describe('closeDay — details', () => {
  it('charges the snapshotted price, not the current item price', () => {
    const r = run([booking({ pricePaise: 5000, platesRequested: 2 })], 7500);
    expect(r.charges[0].amountPaise).toBe(10000);
  });
  it('ignores cancelled bookings', () => {
    const r = run([booking({ id: 'x', status: 'cancelled' }), booking({ id: 'y' })], 7500);
    expect(r.charges.map((c) => c.bookingId)).toEqual(['y']);
    expect(r.offering.confirmedPlates).toBe(1);
    expect(r.bookings.map((b) => b.id)).toEqual(['y']);
  });
  it('sets the walk-in buffer to max(ceil(avg sold × 1.2), ceil(10% of confirmed)), capped by spare capacity', () => {
    const history = [hist('2026-10-22', 40, 4), hist('2026-10-29', 40, 4), hist('2026-11-05', 40, 5), hist('2026-11-12', 40, 5)];
    // avg 4.5 × 1.2 = 5.4 → 6; capacity 50
    expect(run([booking()], 50 * 150, { history }).offering.bufferPlates).toBe(6);
    // no history: 10% of 30 confirmed = 3 (cold start must not lock walk-ins at 0)
    const thirty = Array.from({ length: 30 }, (_, i) => booking({ id: `t${i}` }));
    expect(run(thirty, 50 * 150).offering.bufferPlates).toBe(3);
    const six = [1, 2, 3, 4, 5, 6].map((i) => booking({ id: `b${i}` }));
    expect(run(six, 8 * 150, { history }).offering.bufferPlates).toBe(2);
  });
  it('deducts (confirmed + buffer) × grams, oldest batch first', () => {
    const batches = [
      batch({ id: 'old', gramsRemaining: 300, purchasedOn: '2026-11-18', expiresOn: '2026-11-21' }),
      batch({ id: 'new', gramsInitial: 3000, gramsRemaining: 3000 }),
    ];
    const r = run([booking({ platesRequested: 4 })], 0, { batches });
    // 4 confirmed + buffer ceil(0.4) = 1 → 750 g
    expect(r.batches.find((b) => b.id === 'old')!.gramsRemaining).toBe(0);
    expect(r.batches.find((b) => b.id === 'new')!.gramsRemaining).toBe(2550);
  });
  it('assumes the suggested purchase when none was recorded', () => {
    const r = closeDay({
      offering: offering({ purchasedGrams: null, forecastBuyGrams: 1500 }), item: paneer, bookings: [booking()],
      batches: [], history: [], now, newId,
    });
    expect(r.offering).toMatchObject({ purchaseAssumed: true, capacityPlates: 10, purchasedGrams: 1500 });
    expect(r.batches.some((b) => b.gramsInitial === 1500 && b.purchasedOn === '2026-11-19')).toBe(true);
  });
  it('emits one confirm per confirmed booking and a cook sheet; no shortfall alert when none', () => {
    const r = run([booking({ id: 'p', platesRequested: 2, shortCode: 'P-4K8Q2M' })], 7500);
    expect(r.notifications.find((d) => d.dedupeKey === 'confirm:p')).toMatchObject({
      audience: 'user', userId: 'u-1',
      body: 'Your 2 plates of Paneer are confirmed. ₹120 added to your mess bill. Code: P-4K8Q2M',
    });
    expect(r.notifications.find((d) => d.dedupeKey === 'cook:2026-11-19:item-paneer')!.body).toBe(
      'Bookings closed. Cook 2 booked + 1 walk-in = 3 plates of Paneer.',
    );
    expect(r.notifications.some((d) => d.kind === 'shortfall')).toBe(false);
  });
  it('refuses to close an already closed offering', () => {
    expect(() => closeDay({ offering: offering({ status: 'closed' }), item: paneer, bookings: [], batches: [], history: [], now, newId }))
      .toThrow('Offering already closed');
  });
});
