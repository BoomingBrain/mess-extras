import type { Item, Offering } from './types';
import { istDate, reminderFor, weekdayOf } from './time';
import { reminderKey } from './notifications';

export type TickAction =
  | { kind: 'expireStock'; date: string }
  | { kind: 'createOffering'; itemId: string; date: string }
  | { kind: 'remind'; offeringId: string }
  | { kind: 'close'; offeringId: string };

/**
 * Decide which state transitions are due at `now`.
 * Closes come first (oldest date first) so a missed close still sees the stock that
 * was usable on its own date, before today's expiry write-off runs.
 */
export function planTick(args: { now: Date; items: Item[]; offerings: Offering[]; sentKeys: Set<string> }): TickAction[] {
  const { now, items, offerings, sentKeys } = args;
  const today = istDate(now);
  const t = now.getTime();

  const closes: TickAction[] = offerings
    .filter((o) => o.status === 'open' && t >= Date.parse(o.cutoffAt))
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((o) => ({ kind: 'close', offeringId: o.id }));

  const creates: TickAction[] = items
    .filter((i) => i.active && i.offeredWeekdays.includes(weekdayOf(today)))
    .filter((i) => !offerings.some((o) => o.itemId === i.id && o.date === today))
    .map((i) => ({ kind: 'createOffering', itemId: i.id, date: today }));

  const reminds: TickAction[] = offerings
    .filter((o) => o.status === 'open' && o.date === today)
    .filter((o) => t >= reminderFor(o.date).getTime() && t < Date.parse(o.cutoffAt))
    .filter((o) => !sentKeys.has(reminderKey(o)))
    .map((o) => ({ kind: 'remind', offeringId: o.id }));

  return [...closes, { kind: 'expireStock', date: today }, ...creates, ...reminds];
}
