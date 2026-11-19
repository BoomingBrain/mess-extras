import { demandSeries, simulateApp, simulateToday } from './backtest';

const args = { weeks: 12, seed: 7 };

describe('backtest', () => {
  it('is deterministic', () => {
    expect(simulateApp(args)).toEqual(simulateApp(args));
    expect(simulateToday({ ...args, fixedPlates: { 'item-paneer': 40, 'item-chicken': 50 } }))
      .toEqual(simulateToday({ ...args, fixedPlates: { 'item-paneer': 40, 'item-chicken': 50 } }));
  });

  it('both policies face the same demand', () => {
    expect(demandSeries(args)).toEqual(demandSeries(args));
    expect(simulateApp(args).days).toBe(simulateToday({ ...args, fixedPlates: { 'item-paneer': 40, 'item-chicken': 50 } }).days);
  });

  it('turns away far fewer students than a cautious fixed cook (which wastes nothing only by under-cooking)', () => {
    const app = simulateApp(args);
    const today = simulateToday({ ...args, fixedPlates: { 'item-paneer': 40, 'item-chicken': 50 } });
    expect(app.turnedAway).toBeLessThan(today.turnedAway / 2);
  });

  it('beats even an oracle-average fixed cook on students turned away', () => {
    const avg = (id: string) => {
      const d = demandSeries(args).filter((x) => x.itemId === id);
      return Math.round(d.reduce((s, x) => s + x.booked + x.walkins, 0) / d.length);
    };
    const app = simulateApp(args);
    const today = simulateToday({ ...args, fixedPlates: { 'item-paneer': avg('item-paneer'), 'item-chicken': avg('item-chicken') } });
    expect(app.turnedAway).toBeLessThan(today.turnedAway);
    expect(app.cookedWastePlates).toBeLessThan(today.cookedWastePlates);
  });

  it('runs short on at most 10% of days after the 2-week warm-up', () => {
    const app = simulateApp(args);
    expect(app.shortfallDays / app.days).toBeLessThanOrEqual(0.1);
  });
});
