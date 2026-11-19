// Replays synthetic demand under two policies: today's fixed cook vs the app's rules.
import { addDays, istAt, weekdayOf } from '../src/domain/time';
import { mulberry32 } from '../src/domain/random';
import { seedItems, trueDemand } from '../src/domain/seed';
import { newOffering } from '../src/domain/offering';
import { closeDay } from '../src/domain/closeDay';
import { expireBatches, newBatch } from '../src/domain/stock';
import { mape } from '../src/domain/accuracy';
import type { Booking, DayHistory, StockBatch } from '../src/domain/types';

export const START = '2026-08-03';

export interface PolicyResult {
  days: number;
  demandPlates: number;
  turnedAway: number;
  cookedWastePlates: number;
  shortfallDays: number;
  rawExpiredKg: number;
  mapePct: number | null;
}

export interface DemandDay {
  date: string;
  itemId: string;
  booked: number;
  walkins: number;
}

export function demandSeries(args: { weeks: number; seed: number }): DemandDay[] {
  const rand = mulberry32(args.seed);
  const items = seedItems();
  const out: DemandDay[] = [];
  for (let i = 0; i < args.weeks * 7; i++) {
    const date = addDays(START, i);
    for (const item of items.filter((x) => x.offeredWeekdays.includes(weekdayOf(date)))) {
      const d = trueDemand(item, date, Math.floor(i / 7), rand);
      out.push({ date, itemId: item.id, ...d });
    }
  }
  return out;
}

const evaluated = (date: string, warmupWeeks: number) => date >= addDays(START, warmupWeeks * 7);

export function simulateToday(args: { weeks: number; seed: number; fixedPlates: Record<string, number>; warmupWeeks?: number }): PolicyResult {
  const r: PolicyResult = { days: 0, demandPlates: 0, turnedAway: 0, cookedWastePlates: 0, shortfallDays: 0, rawExpiredKg: 0, mapePct: null };
  for (const d of demandSeries(args)) {
    if (!evaluated(d.date, args.warmupWeeks ?? 2)) continue;
    const demand = d.booked + d.walkins; // today everyone is a walk-in
    const fixed = args.fixedPlates[d.itemId];
    r.days++;
    r.demandPlates += demand;
    r.turnedAway += Math.max(0, demand - fixed);
    r.cookedWastePlates += Math.max(0, fixed - demand);
    if (demand > fixed) r.shortfallDays++;
  }
  return r;
}

export function simulateApp(args: { weeks: number; seed: number; warmupWeeks?: number }): PolicyResult {
  const warm = args.warmupWeeks ?? 2;
  const items = seedItems();
  const rand = mulberry32(args.seed + 1000);
  let batches: StockBatch[] = [];
  const history: Record<string, DayHistory[]> = Object.fromEntries(items.map((i) => [i.id, []]));
  const r: PolicyResult = { days: 0, demandPlates: 0, turnedAway: 0, cookedWastePlates: 0, shortfallDays: 0, rawExpiredKg: 0, mapePct: null };
  const accuracy: { forecast: number; actual: number }[] = [];
  let n = 0;
  const id = () => `s${++n}`;
  let lastDate = '';

  for (const d of demandSeries(args)) {
    if (d.date !== lastDate) {
      const ex = expireBatches(batches, d.date, istAt(d.date, '09:00').toISOString());
      batches = ex.batches;
      if (evaluated(d.date, warm)) r.rawExpiredKg += ex.expiredGrams / 1000;
      lastDate = d.date;
    }
    const item = items.find((i) => i.id === d.itemId)!;
    let o = newOffering({ id: id(), item, date: d.date, history: history[item.id], batches });
    if (o.forecastBuyGrams > 0) batches = [...batches, newBatch({ id: id(), item, grams: o.forecastBuyGrams, purchasedOn: d.date })];
    o = { ...o, purchasedGrams: o.forecastBuyGrams };

    const bookings: Booking[] = Array.from({ length: d.booked }, (_, k) => ({
      id: id(), offeringId: o.id, userId: `u${k}`, platesRequested: 1, platesConfirmed: null, pricePaise: item.pricePaise,
      status: 'active', token: id(), shortCode: id(), cancelledAt: null, servedAt: null,
      createdAt: new Date(istAt(d.date, '08:00').getTime() + Math.floor(rand() * 540) * 60000).toISOString(),
    }));
    const out = closeDay({ offering: o, item, bookings, batches, history: history[item.id], now: istAt(d.date, '17:00'), newId: id });
    batches = out.batches;
    const confirmed = out.offering.confirmedPlates ?? 0;
    const buffer = out.offering.bufferPlates ?? 0;
    const walkinsSold = Math.min(d.walkins, buffer);
    history[item.id].push({ date: d.date, demand: d.booked + walkinsSold, walkins: walkinsSold });

    if (!evaluated(d.date, warm)) continue;
    r.days++;
    r.demandPlates += d.booked + d.walkins;
    r.turnedAway += (d.booked - confirmed) + (d.walkins - walkinsSold);
    r.cookedWastePlates += buffer - walkinsSold;
    if (d.booked > confirmed) r.shortfallDays++;
    accuracy.push({ forecast: o.forecastPlates, actual: d.booked + d.walkins });
  }
  r.rawExpiredKg = Math.round(r.rawExpiredKg * 100) / 100;
  r.mapePct = mape(accuracy);
  return r;
}
