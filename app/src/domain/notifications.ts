import type { Booking, Item, NotificationDraft, Offering } from './types';
import { formatKg, formatRupees } from './format';

const plates = (n: number) => `${n} plate${n === 1 ? '' : 's'}`;

export const reminderKey = (o: Offering) => `reminder:${o.date}:${o.itemId}`;

export const reminderDraft = (o: Offering, item: Item): NotificationDraft => ({
  audience: 'students', userId: null, kind: 'reminder', dedupeKey: reminderKey(o),
  title: `${item.name} tonight`, body: 'Booking closes in 1 hour.',
});

export const confirmDraft = (b: Booking, item: Item): NotificationDraft => {
  const n = b.platesConfirmed ?? 0;
  return {
    audience: 'user', userId: b.userId, kind: 'confirm', dedupeKey: `confirm:${b.id}`,
    title: `${item.name} confirmed`,
    body: `Your ${plates(n)} of ${item.name} ${n === 1 ? 'is' : 'are'} confirmed. ${formatRupees(n * b.pricePaise)} added to your mess bill. Code: ${b.shortCode}`,
  };
};

export const trimDraft = (b: Booking, item: Item): NotificationDraft => {
  const k = b.platesConfirmed ?? 0;
  return {
    audience: 'user', userId: b.userId, kind: 'trim', dedupeKey: `trim:${b.id}`,
    title: `${item.name} ran short`,
    body: k === 0
      ? `Sorry, ${item.name} ran short. Your booking is cancelled and you won't be charged.`
      : `Sorry, ${item.name} ran short. ${k} of ${b.platesRequested} plates confirmed.`,
  };
};

export const purchaseReadyDraft = (o: Offering, item: Item): NotificationDraft => ({
  audience: 'mess', userId: null, kind: 'purchase', dedupeKey: `purchase:${o.date}:${o.itemId}`,
  title: 'Purchase suggestion ready', body: `Today's suggestion: buy ${formatKg(o.forecastBuyGrams)} ${item.name}.`,
});

export const cookSheetDraft = (o: Offering, item: Item): NotificationDraft => {
  const c = o.confirmedPlates ?? 0;
  const b = o.bufferPlates ?? 0;
  return {
    audience: 'mess', userId: null, kind: 'cook', dedupeKey: `cook:${o.date}:${o.itemId}`,
    title: 'Bookings closed',
    body: `Bookings closed. Cook ${c} booked + ${b} walk-in = ${c + b} plates of ${item.name}.`,
  };
};

export const shortfallAlertDraft = (o: Offering, item: Item, trimmedPlates: number): NotificationDraft => ({
  audience: 'mess', userId: null, kind: 'shortfall', dedupeKey: `shortfall:${o.date}:${o.itemId}`,
  title: `${item.name} short`,
  body: `Bookings exceeded stock by ${plates(trimmedPlates)}. The latest bookings were trimmed and not charged.`,
});
