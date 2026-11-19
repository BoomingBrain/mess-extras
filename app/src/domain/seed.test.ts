import { generateSeed, historyFrom, seedUsers, trueDemand } from './seed';
import { accuracySeries, mape } from './accuracy';
import { weekdayOf } from './time';
import { mulberry32 } from './random';
import { paneer } from '../test/fixtures';

const today = '2026-11-19';
const seed = generateSeed({ today, weeks: 6, seed: 42 });

describe('generateSeed', () => {
  it('is deterministic', () => {
    expect(generateSeed({ today, weeks: 6, seed: 42 })).toEqual(seed);
  });
  it('creates 60 students and 1 mess user', () => {
    expect(seed.users).toHaveLength(61);
    expect(seed.users.filter((u) => u.role === 'mess').map((u) => u.rollNo)).toEqual(['MESS01']);
    expect(seedUsers()[0]).toMatchObject({ rollNo: '21BCE1001', room: '101', role: 'student' });
  });
  it('only creates closed past offerings on offered weekdays', () => {
    expect(seed.offerings.length).toBeGreaterThan(30);
    for (const o of seed.offerings) {
      const item = seed.items.find((i) => i.id === o.itemId)!;
      expect(o.status).toBe('closed');
      expect(o.date < today).toBe(true);
      expect(item.offeredWeekdays).toContain(weekdayOf(o.date));
    }
  });
  it('bookings add up to confirmed plates and every confirmed booking is charged', () => {
    for (const o of seed.offerings) {
      const plates = seed.bookings.filter((b) => b.offeringId === o.id && b.status === 'confirmed')
        .reduce((s, b) => s + (b.platesConfirmed ?? 0), 0);
      expect(plates).toBe(o.confirmedPlates);
    }
    expect(seed.charges.length).toBe(seed.bookings.filter((b) => b.status === 'confirmed').length);
  });
  it('history is demand = requested + walk-ins (uncensored)', () => {
    const o = seed.offerings.find((x) => x.itemId === paneer.id)!;
    expect(historyFrom(seed.offerings, paneer.id)[0]).toEqual({ date: o.date, demand: o.requestedPlates! + o.walkinsSold, walkins: o.walkinsSold });
  });
  it('trueDemand stays in a plausible band', () => {
    const r = mulberry32(3);
    for (let w = 0; w < 10; w++) {
      const d = trueDemand(paneer, '2026-11-19', w, r);
      expect(d.booked).toBeGreaterThan(25);
      expect(d.booked).toBeLessThan(75);
      expect(d.walkins).toBeGreaterThanOrEqual(3);
      expect(d.walkins).toBeLessThanOrEqual(8);
    }
  });
});

describe('accuracy', () => {
  it('mape averages absolute percentage error to one decimal', () => {
    expect(mape([{ forecast: 50, actual: 40 }, { forecast: 45, actual: 50 }])).toBe(17.5);
  });
  it('series pairs forecast plates with actual demand', () => {
    const s = accuracySeries(seed.offerings, paneer.id);
    const o = seed.offerings.filter((x) => x.itemId === paneer.id)[0];
    expect(s[0]).toEqual({ date: o.date, forecast: o.forecastPlates, actual: o.requestedPlates! + o.walkinsSold });
  });
});
