export type Role = 'student' | 'mess';

export interface User {
  id: string;
  rollNo: string;
  name: string;
  room: string;
  role: Role;
}

export interface Item {
  id: string;
  name: string;
  pricePaise: number;
  gramsPerPlate: number;
  shelfLifeDays: number;
  /** 0 = Sunday … 6 = Saturday */
  offeredWeekdays: number[];
  defaultPlates: number;
  active: boolean;
}

export type OfferingStatus = 'open' | 'closed';

export interface Offering {
  id: string;
  itemId: string;
  /** YYYY-MM-DD in IST */
  date: string;
  /** ISO timestamp */
  cutoffAt: string;
  status: OfferingStatus;
  forecastPlates: number;
  forecastBuyGrams: number;
  forecastReason: string;
  purchasedGrams: number | null;
  purchaseAssumed: boolean;
  capacityPlates: number | null;
  /** Plates requested by active bookings at close — true demand, even in a shortfall */
  requestedPlates: number | null;
  confirmedPlates: number | null;
  bufferPlates: number | null;
  walkinsSold: number;
  closedAt: string | null;
}

export type BookingStatus = 'active' | 'cancelled' | 'confirmed' | 'shortfall_cancelled';

export interface Booking {
  id: string;
  offeringId: string;
  userId: string;
  platesRequested: number;
  platesConfirmed: number | null;
  pricePaise: number;
  status: BookingStatus;
  token: string;
  shortCode: string;
  createdAt: string;
  cancelledAt: string | null;
  servedAt: string | null;
}

export interface Charge {
  id: string;
  userId: string;
  bookingId: string;
  amountPaise: number;
  chargedOn: string;
}

export interface StockBatch {
  id: string;
  itemId: string;
  gramsInitial: number;
  gramsRemaining: number;
  purchasedOn: string;
  expiresOn: string;
  writtenOffAt: string | null;
}

export type Audience = 'user' | 'students' | 'mess';

export interface NotificationDraft {
  audience: Audience;
  userId: string | null;
  kind: string;
  title: string;
  body: string;
  dedupeKey: string;
}

export interface Notification extends NotificationDraft {
  id: string;
  createdAt: string;
  readAt: string | null;
}

/** demand = confirmed plates + walk-ins sold */
export interface DayHistory {
  date: string;
  demand: number;
  walkins: number;
}

export type Result<T> = { ok: true; value: T } | { ok: false; error: string };

export const ok = <T>(value: T): Result<T> => ({ ok: true, value });
export const err = <T = never>(error: string): Result<T> => ({ ok: false, error });
