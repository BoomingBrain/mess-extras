import { istDate, istAt, cutoffFor, reminderFor, weekdayOf, addDays, weekdayName } from './time';
import { resolveNow } from './clock';

describe('IST time helpers', () => {
  it('istDate rolls to the next day after IST midnight', () => {
    expect(istDate(new Date('2026-11-19T18:45:00Z'))).toBe('2026-11-20');
    expect(istDate(new Date('2026-11-19T18:15:00Z'))).toBe('2026-11-19');
  });
  it('cutoff is 17:00 IST, reminder 16:00 IST', () => {
    expect(cutoffFor('2026-11-19').toISOString()).toBe('2026-11-19T11:30:00.000Z');
    expect(reminderFor('2026-11-19').toISOString()).toBe('2026-11-19T10:30:00.000Z');
    expect(istAt('2026-11-19', '09:00').toISOString()).toBe('2026-11-19T03:30:00.000Z');
  });
  it('weekday helpers', () => {
    expect(weekdayOf('2026-11-19')).toBe(4);
    expect(weekdayName('2026-11-19')).toBe('Thursday');
  });
  it('addDays crosses month boundaries', () => {
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });
});

describe('resolveNow', () => {
  it('lets demo time keep flowing from the anchor', () => {
    expect(
      resolveNow(
        { demoNow: '2026-11-19T11:30:00.000Z', demoSetAt: '2026-11-19T05:00:00.000Z' },
        new Date('2026-11-19T05:00:10Z'),
      ).toISOString(),
    ).toBe('2026-11-19T11:30:10.000Z');
  });
  it('returns real time when no demo time is set', () => {
    expect(resolveNow({ demoNow: null, demoSetAt: null }, new Date('2026-01-01T00:00:00Z')).toISOString()).toBe(
      '2026-01-01T00:00:00.000Z',
    );
  });
});
