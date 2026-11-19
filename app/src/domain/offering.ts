import type { DayHistory, Item, Offering, StockBatch } from './types';
import { cutoffFor } from './time';
import { forecast } from './forecast';
import { usableGrams } from './stock';

/** A fresh open offering for `item` on `date`, with its forecast computed now. */
export function newOffering(args: {
  id: string;
  item: Item;
  date: string;
  history: DayHistory[];
  batches: StockBatch[];
}): Offering {
  const f = forecast({
    item: args.item,
    date: args.date,
    history: args.history,
    usableStockGrams: usableGrams(args.batches, args.item.id, args.date),
  });
  return {
    id: args.id, itemId: args.item.id, date: args.date, cutoffAt: cutoffFor(args.date).toISOString(), status: 'open',
    forecastPlates: f.planPlates, forecastBuyGrams: f.buyGrams, forecastReason: f.reason,
    purchasedGrams: null, purchaseAssumed: false, capacityPlates: null, requestedPlates: null, confirmedPlates: null, bufferPlates: null,
    walkinsSold: 0, closedAt: null,
  };
}
