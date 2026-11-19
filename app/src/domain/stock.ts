import type { Item, StockBatch } from './types';
import { addDays } from './time';

export function newBatch(args: { id: string; item: Item; grams: number; purchasedOn: string }): StockBatch {
  return {
    id: args.id,
    itemId: args.item.id,
    gramsInitial: args.grams,
    gramsRemaining: args.grams,
    purchasedOn: args.purchasedOn,
    expiresOn: addDays(args.purchasedOn, args.item.shelfLifeDays),
    writtenOffAt: null,
  };
}

const isUsable = (b: StockBatch, itemId: string, date: string) =>
  b.itemId === itemId && b.writtenOffAt === null && b.expiresOn >= date && b.gramsRemaining > 0;

export function usableGrams(batches: StockBatch[], itemId: string, date: string): number {
  return batches.filter((b) => isUsable(b, itemId, date)).reduce((s, b) => s + b.gramsRemaining, 0);
}

/** Take `grams` from usable batches, oldest purchase first. Returns new objects; input untouched. */
export function consumeFifo(
  batches: StockBatch[],
  itemId: string,
  grams: number,
  date: string,
): { batches: StockBatch[]; consumed: number } {
  const order = batches
    .map((b, i) => ({ b, i }))
    .filter(({ b }) => isUsable(b, itemId, date))
    .sort((x, y) => x.b.purchasedOn.localeCompare(y.b.purchasedOn) || x.i - y.i);
  const out = batches.map((b) => ({ ...b }));
  let left = grams;
  for (const { i } of order) {
    if (left <= 0) break;
    const take = Math.min(left, out[i].gramsRemaining);
    out[i].gramsRemaining -= take;
    left -= take;
  }
  return { batches: out, consumed: grams - left };
}

export function expireBatches(
  batches: StockBatch[],
  date: string,
  nowIso: string,
): { batches: StockBatch[]; expiredGrams: number } {
  let expiredGrams = 0;
  const out = batches.map((b) => {
    if (b.writtenOffAt === null && b.expiresOn < date && b.gramsRemaining > 0) {
      expiredGrams += b.gramsRemaining;
      return { ...b, writtenOffAt: nowIso };
    }
    return { ...b };
  });
  return { batches: out, expiredGrams };
}
