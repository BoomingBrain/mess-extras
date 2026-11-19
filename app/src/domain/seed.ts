import type { Booking, Charge, DayHistory, Item, Offering, StockBatch, User } from './types';
import { addDays, istAt, weekdayOf } from './time';
import { mulberry32 } from './random';
import { newOffering } from './offering';
import { makeBooking } from './booking';
import { closeDay } from './closeDay';
import { newBatch, expireBatches } from './stock';

export { mulberry32 };

export function seedItems(): Item[] {
  return [
    { id: 'item-paneer', name: 'Paneer', pricePaise: 6000, gramsPerPlate: 150, shelfLifeDays: 3, offeredWeekdays: [2, 4, 6], defaultPlates: 40, active: true },
    { id: 'item-chicken', name: 'Chicken', pricePaise: 9000, gramsPerPlate: 200, shelfLifeDays: 2, offeredWeekdays: [0, 1, 3, 5], defaultPlates: 50, active: true },
  ];
}

const FIRST = ['Aarav', 'Vihaan', 'Aditya', 'Arjun', 'Sai', 'Rohan', 'Ishaan', 'Kabir', 'Ananya', 'Diya', 'Priya', 'Sneha',
  'Rahul', 'Karan', 'Nikhil', 'Meera', 'Tanvi', 'Yash', 'Dev', 'Riya'];
const LAST = ['Sharma', 'Patel', 'Rao', 'Iyer', 'Singh', 'Nair', 'Gupta', 'Das', 'Reddy', 'Joshi', 'Kulkarni', 'Mehta'];

export function seedUsers(): User[] {
  const students: User[] = Array.from({ length: 60 }, (_, i) => ({
    id: `u-21BCE${1001 + i}`,
    rollNo: `21BCE${1001 + i}`,
    name: `${FIRST[i % FIRST.length]} ${LAST[(i * 7) % LAST.length]}`,
    room: String(101 + i),
    role: 'student',
  }));
  return [...students, { id: 'u-MESS01', rollNo: 'MESS01', name: 'Mess Counter', room: '-', role: 'mess' }];
}

/** Synthetic "true" demand: base, weekend bump, trend, noise, occasional spike. */
export function trueDemand(item: Item, date: string, weekIndex: number, rand: () => number): { booked: number; walkins: number } {
  const wd = weekdayOf(date);
  let d = item.defaultPlates * (wd === 0 || wd === 6 ? 1.15 : 1) + 0.5 * weekIndex;
  d *= 1 + (rand() * 0.3 - 0.15);
  if (rand() < 0.1) d *= 1.3;
  return { booked: Math.max(0, Math.round(d)), walkins: 3 + Math.floor(rand() * 6) };
}

export function historyFrom(offerings: Offering[], itemId: string): DayHistory[] {
  return offerings
    .filter((o) => o.itemId === itemId && o.status === 'closed')
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((o) => ({ date: o.date, demand: (o.requestedPlates ?? o.confirmedPlates ?? 0) + o.walkinsSold, walkins: o.walkinsSold }));
}

export interface SeedData {
  items: Item[];
  users: User[];
  offerings: Offering[];
  bookings: Booking[];
  charges: Charge[];
  batches: StockBatch[];
}

/** Replays `weeks` of past days through the real rules, so history obeys them. */
export function generateSeed(args: { today: string; weeks: number; seed: number }): SeedData {
  const rand = mulberry32(args.seed);
  let n = 0;
  const id = (p: string) => `${p}-${++n}`;
  const items = seedItems();
  const users = seedUsers();
  const students = users.filter((u) => u.role === 'student');
  const offerings: Offering[] = [];
  const bookings: Booking[] = [];
  const charges: Charge[] = [];
  let batches: StockBatch[] = [];
  const start = addDays(args.today, -args.weeks * 7);

  for (let date = start, day = 0; date < args.today; date = addDays(date, 1), day++) {
    batches = expireBatches(batches, date, istAt(date, '09:00').toISOString()).batches;
    for (const item of items.filter((i) => i.offeredWeekdays.includes(weekdayOf(date)))) {
      let o = newOffering({ id: id('off'), item, date, history: historyFrom(offerings, item.id), batches });
      if (o.forecastBuyGrams > 0) batches = [...batches, newBatch({ id: id('batch'), item, grams: o.forecastBuyGrams, purchasedOn: date })];
      o = { ...o, purchasedGrams: o.forecastBuyGrams };

      const demand = trueDemand(item, date, Math.floor(day / 7), rand);
      const dayBookings: Booking[] = [];
      for (let left = demand.booked; left > 0; ) {
        const plates = Math.min(left, rand() < 0.8 ? 1 : 2);
        left -= plates;
        const student = students[Math.floor(rand() * students.length)];
        const minute = Math.floor(rand() * 540); // 08:00–16:59
        const now = new Date(istAt(date, '08:00').getTime() + minute * 60000);
        const r = makeBooking({ id: id('bk'), offering: o, item, userId: student.id, plates, now, rand });
        if (r.ok) dayBookings.push(r.value);
      }

      const closed = closeDay({
        offering: o, item, bookings: dayBookings, batches, history: historyFrom(offerings, item.id),
        now: istAt(date, '17:00'), newId: () => id('c'),
      });
      batches = closed.batches;
      const walkinsSold = Math.min(demand.walkins, closed.offering.bufferPlates ?? 0);
      offerings.push({ ...closed.offering, walkinsSold });
      for (const b of closed.bookings) {
        const served = b.status === 'confirmed' && rand() < 0.85;
        const servedAt = served ? new Date(istAt(date, '19:30').getTime() + Math.floor(rand() * 90) * 60000).toISOString() : null;
        bookings.push({ ...b, servedAt });
      }
      charges.push(...closed.charges);
    }
  }
  return { items, users, offerings, bookings, charges, batches };
}
