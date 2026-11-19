import type { Offering } from './types';

export interface AccuracyPoint {
  date: string;
  forecast: number;
  actual: number;
}

export function accuracySeries(offerings: Offering[], itemId: string): AccuracyPoint[] {
  return offerings
    .filter((o) => o.itemId === itemId && o.status === 'closed')
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((o) => ({ date: o.date, forecast: o.forecastPlates, actual: (o.requestedPlates ?? o.confirmedPlates ?? 0) + o.walkinsSold }));
}

/** Mean absolute percentage error, one decimal. Days with zero actual demand are skipped. */
export function mape(series: { forecast: number; actual: number }[]): number {
  const valid = series.filter((p) => p.actual > 0);
  if (valid.length === 0) return 0;
  const avg = valid.reduce((s, p) => s + Math.abs(p.forecast - p.actual) / p.actual, 0) / valid.length;
  return Math.round(avg * 1000) / 10;
}
