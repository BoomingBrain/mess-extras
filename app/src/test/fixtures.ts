import type { Booking, DayHistory, Item, Offering, StockBatch } from '../domain/types';
import { cutoffFor } from '../domain/time';

export const paneer: Item = {
  id: 'item-paneer', name: 'Paneer', pricePaise: 6000, gramsPerPlate: 150, shelfLifeDays: 3,
  offeredWeekdays: [2, 4, 6], defaultPlates: 40, active: true,
};
export const chicken: Item = {
  id: 'item-chicken', name: 'Chicken', pricePaise: 9000, gramsPerPlate: 200, shelfLifeDays: 2,
  offeredWeekdays: [0, 1, 3, 5], defaultPlates: 50, active: true,
};

export const hist = (date: string, demand: number, walkins = 4): DayHistory => ({ date, demand, walkins });

export function offering(over: Partial<Offering> = {}): Offering {
  const date = over.date ?? '2026-11-19';
  return {
    id: 'off-1', itemId: paneer.id, date, cutoffAt: cutoffFor(date).toISOString(), status: 'open',
    forecastPlates: 50, forecastBuyGrams: 7500, forecastReason: '', purchasedGrams: 7500, purchaseAssumed: false,
    capacityPlates: null, confirmedPlates: null, bufferPlates: null, walkinsSold: 0, closedAt: null,
    ...over,
  };
}

export function booking(over: Partial<Booking> = {}): Booking {
  return {
    id: 'b-1', offeringId: 'off-1', userId: 'u-1', platesRequested: 1, platesConfirmed: null, pricePaise: 6000,
    status: 'active', token: 'a'.repeat(32), shortCode: 'P-AAAAAA', createdAt: '2026-11-19T09:00:00.000Z',
    cancelledAt: null, servedAt: null, ...over,
  };
}

export function batch(over: Partial<StockBatch> = {}): StockBatch {
  return {
    id: 'batch-1', itemId: paneer.id, gramsInitial: 1000, gramsRemaining: 1000, purchasedOn: '2026-11-19',
    expiresOn: '2026-11-22', writtenOffAt: null, ...over,
  };
}
