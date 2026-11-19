import { forecast, sameWeekdayHistory } from './forecast';
import { formatKg, formatRupees } from './format';
import { paneer, hist } from '../test/fixtures';

const thursdays = [hist('2026-10-22', 41), hist('2026-10-29', 44), hist('2026-11-05', 47), hist('2026-11-12', 52)];

describe('format', () => {
  it('formats kg without trailing zeros', () => {
    expect(formatKg(7950)).toBe('7.95 kg');
    expect(formatKg(6000)).toBe('6 kg');
    expect(formatKg(1500)).toBe('1.5 kg');
    expect(formatKg(0)).toBe('0 kg');
  });
  it('formats rupees from paise', () => {
    expect(formatRupees(12000)).toBe('₹120');
    expect(formatRupees(12050)).toBe('₹120.50');
  });
});

describe('sameWeekdayHistory', () => {
  it('keeps only the last 4 same weekdays, oldest first, ignoring other weekdays', () => {
    const h = [hist('2026-11-17', 99), ...thursdays.slice().reverse(), hist('2026-10-15', 10)];
    expect(sameWeekdayHistory(h, '2026-11-19').map((x) => x.date)).toEqual([
      '2026-10-22', '2026-10-29', '2026-11-05', '2026-11-12',
    ]);
  });
});

describe('forecast', () => {
  it('plans max(peak, avg×1.15) and subtracts usable stock, with a readable reason', () => {
    const r = forecast({ item: paneer, date: '2026-11-19', history: thursdays, usableStockGrams: 1500 });
    expect(r.planPlates).toBe(53);
    expect(r.gramsNeeded).toBe(7950);
    expect(r.buyGrams).toBe(6450);
    expect(r.reason).toBe(
      'Last 4 Thursdays: 41, 44, 47, 52 (avg 46, peak 52). Planning 53 plates × 150 g = 7.95 kg. In stock: 1.5 kg. Buy 6.45 kg.',
    );
  });

  it('uses the peak when it dominates', () => {
    const h = [hist('2026-10-22', 30), hist('2026-10-29', 30), hist('2026-11-05', 30), hist('2026-11-12', 60)];
    expect(forecast({ item: paneer, date: '2026-11-19', history: h, usableStockGrams: 0 }).planPlates).toBe(60);
  });

  it('never suggests buying a negative amount', () => {
    const r = forecast({ item: paneer, date: '2026-11-19', history: thursdays, usableStockGrams: 10000 });
    expect(r.buyGrams).toBe(0);
    expect(r.reason.endsWith('Buy 0 kg.')).toBe(true);
  });

  it('falls back to default plates with fewer than 2 records', () => {
    const r = forecast({ item: paneer, date: '2026-11-19', history: [hist('2026-11-12', 52)], usableStockGrams: 0 });
    expect(r.planPlates).toBe(40);
    expect(r.reason).toBe(
      'Not enough history (1 past Thursday). Using default 40 plates × 150 g = 6 kg. In stock: 0 kg. Buy 6 kg.',
    );
  });

  it('says "Last 3 Thursdays" when only 3 exist', () => {
    const r = forecast({ item: paneer, date: '2026-11-19', history: thursdays.slice(1), usableStockGrams: 0 });
    expect(r.reason.startsWith('Last 3 Thursdays: ')).toBe(true);
  });
});
