import type { DayHistory, Item } from './types';
import { addDays, weekdayName } from './time';
import { formatKg } from './format';

export const FORECAST_WEEKS = 4;
export const MIN_HISTORY = 2;

/** Same-weekday entries from the last 4 weeks before `date`, oldest first. */
export function sameWeekdayHistory(history: DayHistory[], date: string): DayHistory[] {
  const wanted = new Set(Array.from({ length: FORECAST_WEEKS }, (_, i) => addDays(date, -7 * (i + 1))));
  return history.filter((h) => wanted.has(h.date)).sort((a, b) => a.date.localeCompare(b.date));
}

export interface ForecastResult {
  planPlates: number;
  gramsNeeded: number;
  buyGrams: number;
  reason: string;
}

export function forecast(args: {
  item: Item;
  date: string;
  history: DayHistory[];
  usableStockGrams: number;
}): ForecastResult {
  const { item, date, usableStockGrams } = args;
  const past = sameWeekdayHistory(args.history, date);
  const day = weekdayName(date);
  let planPlates: number;
  let basis: string;

  if (past.length < MIN_HISTORY) {
    planPlates = item.defaultPlates;
    basis = `Not enough history (${past.length} past ${day}${past.length === 1 ? '' : 's'}). Using default ${planPlates} plates`;
  } else {
    const demands = past.map((h) => h.demand);
    const sum = demands.reduce((a, b) => a + b, 0);
    const peak = Math.max(...demands);
    // ceil(avg × 1.15) in integer arithmetic to avoid float drift
    const padded = Math.ceil((sum * 115) / (demands.length * 100));
    planPlates = Math.max(peak, padded);
    basis =
      `Last ${past.length} ${day}s: ${demands.join(', ')} (avg ${Math.round(sum / demands.length)}, peak ${peak}). ` +
      `Planning ${planPlates} plates`;
  }

  const gramsNeeded = planPlates * item.gramsPerPlate;
  const buyGrams = Math.max(0, gramsNeeded - usableStockGrams);
  const reason =
    `${basis} × ${item.gramsPerPlate} g = ${formatKg(gramsNeeded)}. ` +
    `In stock: ${formatKg(usableStockGrams)}. Buy ${formatKg(buyGrams)}.`;
  return { planPlates, gramsNeeded, buyGrams, reason };
}
