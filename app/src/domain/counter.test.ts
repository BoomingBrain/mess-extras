import { redeem, sellWalkin, endOfDay } from './counter';
import { offering, booking } from '../test/fixtures';

const now = new Date('2026-11-19T14:22:00.000Z'); // 7:52 pm IST
const today = '2026-11-19';
const closed = offering({ status: 'closed', confirmedPlates: 2, bufferPlates: 2 });

describe('redeem', () => {
  it('serves a confirmed booking for today', () => {
    const r = redeem({ booking: booking({ status: 'confirmed', platesConfirmed: 2 }), offering: closed, today, now });
    expect(r.ok && r.value.servedAt).toBe(now.toISOString());
  });
  it('rejects in priority order with exact messages', () => {
    expect(redeem({ booking: undefined, offering: undefined, today, now })).toEqual({ ok: false, error: 'Coupon not found' });
    expect(redeem({ booking: booking({ status: 'cancelled' }), offering: closed, today, now }))
      .toEqual({ ok: false, error: 'Booking was cancelled' });
    expect(redeem({ booking: booking({ status: 'shortfall_cancelled' }), offering: closed, today, now }))
      .toEqual({ ok: false, error: 'Booking was cancelled' });
    expect(redeem({ booking: booking({ status: 'active' }), offering: offering(), today, now }))
      .toEqual({ ok: false, error: 'Bookings for tonight are not confirmed yet' });
    expect(redeem({ booking: booking({ status: 'confirmed' }), offering: offering({ status: 'closed', date: '2026-11-18' }), today, now }))
      .toEqual({ ok: false, error: 'This coupon is for Wednesday, 18 Nov' });
    expect(redeem({ booking: booking({ status: 'confirmed', servedAt: '2026-11-19T14:22:00.000Z' }), offering: closed, today, now }))
      .toEqual({ ok: false, error: 'Already served at 7:52 pm' });
  });
});

describe('sellWalkin', () => {
  it('counts walk-ins up to the buffer', () => {
    const one = sellWalkin(closed);
    if (!one.ok) throw new Error();
    const two = sellWalkin(one.value);
    if (!two.ok) throw new Error();
    expect(two.value.walkinsSold).toBe(2);
    expect(sellWalkin(two.value)).toEqual({ ok: false, error: 'No walk-in plates left' });
  });
  it('refuses before close', () => {
    expect(sellWalkin(offering())).toEqual({ ok: false, error: 'Not closed yet' });
  });
});

describe('endOfDay', () => {
  it('computes no-shows and cooked waste', () => {
    const o = offering({ status: 'closed', confirmedPlates: 10, bufferPlates: 4, walkinsSold: 3 });
    const bs = [
      booking({ id: 'a', status: 'confirmed', platesConfirmed: 8, servedAt: 'x' }),
      booking({ id: 'b', status: 'confirmed', platesConfirmed: 2 }),
      booking({ id: 'c', status: 'cancelled', platesRequested: 5 }),
    ];
    expect(endOfDay(o, bs)).toEqual({ booked: 10, served: 8, noShows: 2, walkins: 3, cooked: 14, cookedWaste: 3 });
  });
});
