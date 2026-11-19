# Mess Extras Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a mobile-first web app where hostel students pre-book mess extras before 5 pm and the mess gets a forecast-driven purchase suggestion, a 5 pm cooking sheet, and a QR counter — plus evals and a submission folder.

**Architecture:** A React SPA on Vercel talks to Supabase Postgres. All business rules live in `src/domain/` as pure functions (input data + `now` → output data), unit-tested with Vitest. A `Repo` interface has two implementations: Supabase (production) and in-memory (tests, backtest). State transitions (create today's offerings, 4 pm reminder, 5 pm close) run lazily through `runTick(repo, now)` whenever a client loads or the demo clock moves. Two Postgres functions (`create_booking`, `apply_close`) make the racy writes atomic.

**Tech Stack:** Vite 5, React 18, TypeScript 5 (strict), Tailwind 3, React Router 6, @tanstack/react-query 5, @supabase/supabase-js 2, qrcode, html5-qrcode, Recharts, Vitest + @testing-library/react, tsx, pg (migration script only).

**Spec:** `docs/specs/2026-11-19-mess-extras-design.md`

## Global Constraints

- All dates and times are Asia/Kolkata (IST, UTC+05:30, no DST). A "date" is a `YYYY-MM-DD` string in IST.
- Booking cutoff is **17:00 IST**; the student reminder is at **16:00 IST**; dinner is at 19:30 IST.
- Plates per booking are an integer from **1 to 10**. A student may hold several bookings.
- Money is always stored as integer **paise**. Grams are always integers.
- Forecast formula: `planPlates = ceil(max(peak, avg × 1.15))` over the same weekday in the last 4 weeks. Use `defaultPlates` when there are fewer than 2 data points.
- Shortfall: trim **latest bookings first**, partial trims allowed. A booking trimmed to 0 becomes `shortfall_cancelled` and is never charged.
- Walk-in buffer: `min(capacity − confirmed, round(avg walk-ins on the same weekday over the last 4 weeks))`.
- Stock is consumed FIFO by `purchasedOn`. `expiresOn = purchasedOn + shelfLifeDays`, and a batch is usable on date `d` iff `expiresOn >= d` and it is not written off.
- No code outside `src/domain/clock.ts` and `src/services/clock.ts` reads `Date.now()` / `new Date()` for "now".
- Claude never writes `submission/1-one-pager.md` content. The case study requires the candidate to write it; only a checklist file is provided.
- Seed: Paneer ₹60, 150 g/plate, shelf life 3 d, offered Tue/Thu/Sat, default 40 plates. Chicken ₹90, 200 g/plate, shelf life 2 d, offered Mon/Wed/Fri/Sun, default 50 plates. 60 students, 1 mess user `MESS01`, 6 weeks of history.

## Review Focus

1. **Two browsers cross 5 pm at the same moment.** The close must apply exactly once: one set of charges and one stock deduction. Owned by Task 9 (`apply_close` row lock plus status guard) and tested with two concurrent `runTick` calls on the memory repo.
2. **A booking submitted at 16:59:59 arrives after the close was computed.** It must be rejected with "Booking closed for today"; it must never be left `active` and uncharged. Owned by Task 9: `create_booking` checks `status='open'` under the same row lock.
3. **The demo clock jumps backwards, or a "9 am" jump happens after 5 pm.** A closed offering never reopens. Jump buttons earlier than the current demo time are disabled. Owned by Task 7 (`planTick` test) and Task 13.
4. **An item's price is edited after students booked.** Charges use the booking's snapshotted `pricePaise`. Owned by Task 5 test.
5. **A student shows yesterday's still-valid QR tonight.** The counter rejects it with "This coupon is for <date>". Owned by Task 6 (`redeem` takes `today`).

---

## File Structure

```
groww/app/
  package.json  vite.config.ts  tsconfig.json  tailwind.config.js  .env.example
  supabase/migrations/001_schema.sql     tables, RLS (permissive), RPCs
  scripts/db-setup.ts                    runs migration via DATABASE_URL (pg)
  scripts/seed.ts                        wipes + inserts generated seed via supabase-js
  src/domain/                            PURE — no imports from services/ui
    types.ts          all shared types
    time.ts           IST date helpers
    forecast.ts       forecast + reason string
    stock.ts          usable stock, FIFO consume, expiry
    booking.ts        create/cancel validation, tokens
    closeDay.ts       5 pm close
    counter.ts        redeem, walk-in, end-of-day summary
    notifications.ts  notification drafts + dedupe keys
    tick.ts           planTick: what transitions are due
    seed.ts           deterministic synthetic data generator
    accuracy.ts       forecast-vs-actual series and MAPE
    *.test.ts
  src/services/
    repo.ts           Repo interface
    memoryRepo.ts     in-memory Repo (tests, backtest)
    supabaseRepo.ts   Supabase Repo
    tick.ts           runTick(repo, now): executes planTick actions
    clock.ts          demo clock read/write
    queries.ts        react-query hooks + realtime invalidation
  src/ui/
    App.tsx  routes.tsx  session.tsx
    components/  (NotificationBell, DemoPanel, QrCoupon, Countdown, ...)
    pages/student/  Today.tsx  Bill.tsx
    pages/mess/     Dashboard.tsx  Items.tsx  Stock.tsx  Accuracy.tsx  Counter.tsx
    pages/Login.tsx
  evals/backtest.ts   evals/run-evals.ts
groww/submission/  1-one-pager-CHECKLIST.md  2-prompts.md  3-evals.md  4-app-link.md
```

---

### Task 1: Scaffold, shared types, IST time helpers

**Files:**
- Create: `app/` (Vite react-ts template), `app/src/domain/types.ts`, `app/src/domain/time.ts`, `app/src/domain/clock.ts`
- Test: `app/src/domain/time.test.ts`

**Interfaces:**
- Produces, in `types.ts`:
  ```ts
  export type Role = 'student' | 'mess';
  export interface User { id: string; rollNo: string; name: string; room: string; role: Role }
  export interface Item { id: string; name: string; pricePaise: number; gramsPerPlate: number;
    shelfLifeDays: number; offeredWeekdays: number[] /*0=Sun*/; defaultPlates: number; active: boolean }
  export type OfferingStatus = 'open' | 'closed';
  export interface Offering { id: string; itemId: string; date: string; cutoffAt: string /*ISO*/;
    status: OfferingStatus; forecastPlates: number; forecastBuyGrams: number; forecastReason: string;
    purchasedGrams: number | null; purchaseAssumed: boolean; capacityPlates: number | null;
    confirmedPlates: number | null; bufferPlates: number | null; walkinsSold: number; closedAt: string | null }
  export type BookingStatus = 'active' | 'cancelled' | 'confirmed' | 'shortfall_cancelled';
  export interface Booking { id: string; offeringId: string; userId: string; platesRequested: number;
    platesConfirmed: number | null; pricePaise: number; status: BookingStatus; token: string;
    shortCode: string; createdAt: string; cancelledAt: string | null; servedAt: string | null }
  export interface Charge { id: string; userId: string; bookingId: string; amountPaise: number; chargedOn: string }
  export interface StockBatch { id: string; itemId: string; gramsInitial: number; gramsRemaining: number;
    purchasedOn: string; expiresOn: string; writtenOffAt: string | null }
  export type Audience = 'user' | 'students' | 'mess';
  export interface NotificationDraft { audience: Audience; userId: string | null; kind: string;
    title: string; body: string; dedupeKey: string }
  export interface Notification extends NotificationDraft { id: string; createdAt: string; readAt: string | null }
  export interface DayHistory { date: string; demand: number; walkins: number } // demand = confirmed + walkins
  export type Result<T> = { ok: true; value: T } | { ok: false; error: string };
  ```
- Produces, in `time.ts`: `istDate(now: Date): string`, `istAt(date: string, hhmm: string): Date`, `cutoffFor(date: string): Date` (= `istAt(date,'17:00')`), `reminderFor(date)` (16:00), `weekdayOf(date: string): number`, `addDays(date: string, n: number): string`, `weekdayName(date): string` ("Thursday").
- Produces, in `clock.ts`: `type ClockState = { demoNow: string | null; demoSetAt: string | null }`, `resolveNow(state: ClockState, real: Date): Date`. Returns `demoNow + (real − demoSetAt)` when set, so demo time keeps flowing; otherwise `real`.

- [ ] **Step 1:** `npm create vite@5 app -- --template react-ts`. Add Tailwind 3, Vitest (jsdom), `@testing-library/react`, and the libraries in Tech Stack. Turn on `strict`. Run `git init` in `app/`. Add `.env.example` with `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `DATABASE_URL`.
- [ ] **Step 2: Write failing tests** in `time.test.ts`:
  ```ts
  expect(istDate(new Date('2026-11-19T18:45:00Z'))).toBe('2026-11-20'); // 00:15 IST next day
  expect(istDate(new Date('2026-11-19T18:15:00Z'))).toBe('2026-11-19');
  expect(cutoffFor('2026-11-19').toISOString()).toBe('2026-11-19T11:30:00.000Z');
  expect(weekdayOf('2026-11-19')).toBe(4);           // Thursday
  expect(addDays('2026-11-30', 1)).toBe('2026-12-01');
  expect(resolveNow({ demoNow: '2026-11-19T11:30:00.000Z', demoSetAt: '2026-11-19T05:00:00.000Z' },
    new Date('2026-11-19T05:00:10Z')).toISOString()).toBe('2026-11-19T11:30:10.000Z');
  expect(resolveNow({ demoNow: null, demoSetAt: null }, new Date('2026-01-01T00:00:00Z')).toISOString())
    .toBe('2026-01-01T00:00:00.000Z');
  ```
- [ ] **Step 3:** Run `npx vitest run src/domain/time.test.ts`. Expected: FAIL (module not found).
- [ ] **Step 4:** Implement `time.ts` and `clock.ts` using fixed +05:30 offset arithmetic, with no timezone library.
- [ ] **Step 5:** Run the tests. Expected: PASS. Commit: `chore: scaffold app, domain types, IST time helpers`.

---

### Task 2: Forecast and purchase suggestion

**Files:** Create `src/domain/forecast.ts`, `src/domain/format.ts`. Test `src/domain/forecast.test.ts`.

**Interfaces:**
- Consumes: `Item`, `DayHistory`, `weekdayOf`, `addDays`, `weekdayName` (Task 1).
- Produces:
  - `formatKg(grams: number): string`: `7950 → "7.95 kg"`, `6000 → "6 kg"`, `1500 → "1.5 kg"`, `0 → "0 kg"`
  - `formatRupees(paise: number): string`: `12000 → "₹120"`
  - `sameWeekdayHistory(history: DayHistory[], date: string): DayHistory[]`: entries for `date−7, −14, −21, −28` that exist, oldest first
  - `forecast(args: { item: Item; date: string; history: DayHistory[]; usableStockGrams: number }): { planPlates: number; gramsNeeded: number; buyGrams: number; reason: string }`

- [ ] **Step 1: Write failing tests:**
  ```ts
  const paneer = { gramsPerPlate: 150, defaultPlates: 40, /* ...rest */ } as Item;
  // history for Thursdays 2026-10-22, 10-29, 11-05, 11-12 with demand 41, 44, 47, 52; date 2026-11-19
  const r = forecast({ item: paneer, date: '2026-11-19', history, usableStockGrams: 1500 });
  expect(r.planPlates).toBe(53);
  expect(r.gramsNeeded).toBe(7950);
  expect(r.buyGrams).toBe(6450);
  expect(r.reason).toBe('Last 4 Thursdays: 41, 44, 47, 52 (avg 46, peak 52). Planning 53 plates × 150 g = 7.95 kg. In stock: 1.5 kg. Buy 6.45 kg.');
  // peak dominates: demand 30, 30, 30, 60 → avg 37.5 ×1.15 = 43.1, peak 60 → 60
  // stock exceeds need → buyGrams 0, reason ends "Buy 0 kg."
  // cold start, 1 record → planPlates 40, reason:
  //  'Not enough history (1 past Thursday). Using default 40 plates × 150 g = 6 kg. In stock: 0 kg. Buy 6 kg.'
  // history entries on other weekdays are ignored
  // 3 records → reason starts 'Last 3 Thursdays: '
  ```
- [ ] **Step 2:** Run `npx vitest run src/domain/forecast.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement. The "avg" in the reason is `Math.round(avg)`. Grams are integers: `planPlates × gramsPerPlate`.
- [ ] **Step 4:** Run the tests. Expected: PASS. Commit: `feat(domain): forecast with readable reason`.

---

### Task 3: Stock — usable grams, FIFO consume, expiry

**Files:** Create `src/domain/stock.ts`. Test `src/domain/stock.test.ts`.

**Interfaces:**
- Produces:
  - `newBatch(args: { id: string; item: Item; grams: number; purchasedOn: string }): StockBatch` (sets `expiresOn = addDays(purchasedOn, shelfLifeDays)`)
  - `usableGrams(batches: StockBatch[], itemId: string, date: string): number`
  - `consumeFifo(batches: StockBatch[], itemId: string, grams: number, date: string): { batches: StockBatch[]; consumed: number }` (never takes more than is usable; returns new arrays and does not mutate)
  - `expireBatches(batches: StockBatch[], date: string, nowIso: string): { batches: StockBatch[]; expiredGrams: number }` (writes off batches with `expiresOn < date` and grams > 0)

- [ ] **Step 1: Write failing tests:**
  - A batch bought on 11-17 with shelf life 3 is usable on 11-20 and not on 11-21.
  - Written-off batches and other items' batches are excluded.
  - `consumeFifo` takes from the older batch first: 1000 g (11-17) + 2000 g (11-19), consume 1500 → `[0, 1500]`.
  - Asking for more than usable returns `consumed` equal to the usable total.
  - The input array is unchanged (deep-equal to a clone taken before).
  - `expireBatches` reports `expiredGrams` and sets `writtenOffAt`.
- [ ] **Step 2:** Run the tests. Expected: FAIL. **Step 3:** Implement. **Step 4:** Run the tests. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(domain): stock batches with FIFO and expiry`.

---

### Task 4: Booking rules

**Files:** Create `src/domain/booking.ts`. Test `src/domain/booking.test.ts`.

**Interfaces:**
- Consumes: `Offering`, `Item`, `Booking`, `Result`.
- Produces:
  - `canBook(offering: Offering, now: Date): Result<true>` (errors: `'Booking closed for today'` when status is closed or `now >= cutoffAt`)
  - `validatePlates(n: number): Result<number>` (error `'Choose 1 to 10 plates'`)
  - `makeBooking(args: { id: string; offering: Offering; item: Item; userId: string; plates: number; now: Date; rand: () => number }): Result<Booking>` (`pricePaise` is the item's price snapshot; `token` is 32 hex chars; `shortCode` is 6 chars from `ABCDEFGHJKMNPQRSTUVWXYZ23456789`, with an item-initial prefix `P-` or `C-` → e.g. `P-4K8Q2M`)
  - `cancelBooking(b: Booking, offering: Offering, now: Date): Result<Booking>` (errors: `'Cancellation closed at 5 pm'` after the cutoff; `'Booking is not active'` if the status is not active)

- [ ] **Step 1: Write failing tests:**
  - Booking at 16:59 IST is ok; at 17:00 IST it gives `'Booking closed for today'`.
  - A closed offering is rejected at 10:00.
  - Plates 0, 11, and 2.5 are rejected, and 1 and 10 are accepted.
  - The snapshot price equals the item price at booking time.
  - The token matches `/^[0-9a-f]{32}$/` and the short code matches `/^[PC]-[A-HJ-NP-Z2-9]{6}$/`.
  - Cancel before the cutoff gives status `cancelled` with `cancelledAt` set.
  - Cancel after the cutoff errors.
  - Cancelling twice errors on the second call.
- [ ] **Step 2–4:** Run → FAIL. Implement. Run → PASS.
- [ ] **Step 5:** Commit: `feat(domain): booking and cancellation rules`.

---

### Task 5: 5 pm close (`closeDay`)

**Files:** Create `src/domain/closeDay.ts`, `src/domain/notifications.ts`. Test `src/domain/closeDay.test.ts`.

**Interfaces:**
- Consumes: Tasks 1–4 (`usableGrams`, `consumeFifo`, `newBatch`, `formatRupees`).
- Produces, in `notifications.ts` (drafts with fixed copy and dedupe keys):
  - `reminderDraft(offering, item)` → audience `students`, key `reminder:{date}:{itemId}`, title `"{item} tonight"`, body `"Booking closes in 1 hour."`
  - `confirmDraft(booking, item, offering)` → audience `user`, key `confirm:{bookingId}`, body `"Your {n} plate(s) of {item} are confirmed. {₹} added to your mess bill. Code: {shortCode}"`
  - `trimDraft(booking, item)` → key `trim:{bookingId}`. Body `"Sorry, {item} ran short. {k} of {n} plates confirmed."`, or when k = 0: `"Sorry, {item} ran short. Your booking is cancelled and you won't be charged."`
  - `purchaseReadyDraft(offering, item)` → audience `mess`, key `purchase:{date}:{itemId}`, body `"Today's suggestion: buy {kg} {item}."`
  - `cookSheetDraft(offering, item)` → key `cook:{date}:{itemId}`, body `"Bookings closed. Cook {confirmed} booked + {buffer} walk-in = {total} plates of {item}."`
  - `shortfallAlertDraft(offering, item, trimmedPlates)` → key `shortfall:{date}:{itemId}`
- Produces, in `closeDay.ts`:
  ```ts
  export interface CloseInput { offering: Offering; item: Item; bookings: Booking[]; batches: StockBatch[];
    history: DayHistory[]; now: Date; newId: () => string }
  export interface CloseOutput { offering: Offering; bookings: Booking[] /*only changed ones*/;
    charges: Charge[]; batches: StockBatch[] /*full new list for item*/; notifications: NotificationDraft[] }
  export function closeDay(input: CloseInput): CloseOutput
  ```
  Order: (1) if `purchasedGrams === null`, add a `newBatch` of `forecastBuyGrams` dated `offering.date` and set `purchaseAssumed = true`; (2) capacity = `floor(usableGrams / gramsPerPlate)`; (3) trim active bookings latest `createdAt` first; (4) buffer as in Global Constraints; (5) charge `platesConfirmed × pricePaise` per confirmed booking, with `chargedOn = date`; (6) `consumeFifo((confirmed + buffer) × gramsPerPlate)`; (7) drafts; (8) status `closed`, `closedAt = now`.

- [ ] **Step 1: Write failing tests:**
  - **No shortfall:** capacity 50, bookings 3+2+1 → all `confirmed` with full plates, 3 charges summing `6 × 6000`, `confirmedPlates 6`.
  - **Shortfall partial trim:** capacity 5, bookings A(3, 16:00), B(2, 16:30), C(2, 16:45) → C becomes `shortfall_cancelled` with 0 plates, B is confirmed with 2, A with 3, and there is no charge for C. Capacity 6 with the same bookings → C is confirmed with 1 and gets a `trim` draft saying `"1 of 2"`.
  - **Price snapshot:** a booking with `pricePaise 5000` while `item.pricePaise` is 6000 → charge 5000 per plate.
  - **Cancelled bookings** are ignored entirely: not charged and not counted.
  - **Buffer:** walk-ins over the same weekday averaged 4.4 → buffer 4, capped by `capacity − confirmed` (capacity 8, confirmed 6 → buffer 2).
  - **Stock deducted** = `(confirmed + buffer) × gramsPerPlate`, oldest batch first.
  - **Purchase not recorded** → `purchaseAssumed true`, and capacity includes `forecastBuyGrams`.
  - **Drafts:** one `confirm` per confirmed booking, one `cook` draft, and a `shortfall` draft only when something was trimmed.
  - **Calling `closeDay` on an already closed offering** throws `'Offering already closed'`.
- [ ] **Step 2–4:** Run → FAIL. Implement. Run → PASS.
- [ ] **Step 5:** Commit: `feat(domain): 5pm close with shortfall trimming, charges, stock`.

---

### Task 6: Counter and end-of-day summary

**Files:** Create `src/domain/counter.ts`. Test `src/domain/counter.test.ts`.

**Interfaces:**
- Produces:
  - `redeem(args: { booking: Booking | undefined; offering: Offering | undefined; today: string; now: Date }): Result<Booking>`. Errors, in this order:
    1. `'Coupon not found'`
    2. `'Booking was cancelled'` (status cancelled or shortfall_cancelled)
    3. `'Bookings for tonight are not confirmed yet'` (status active)
    4. `'This coupon is for {weekdayName}, {D Mon}'` (offering date ≠ today)
    5. `'Already served at {h:mm am/pm}'` (IST)
  - `sellWalkin(offering: Offering): Result<Offering>`. Error `'No walk-in plates left'` when `walkinsSold >= bufferPlates`, or `'Not closed yet'` while the offering is open.
  - `endOfDay(offering: Offering, bookings: Booking[]): { booked: number; served: number; noShows: number; walkins: number; cooked: number; cookedWaste: number }` (in plates; `cooked = confirmed + buffer`; `cookedWaste = cooked − served − walkins`)

- [ ] **Step 1: Write failing tests:** one test for each error above, with exact strings. Also: a successful redeem sets `servedAt = now`, and redeeming it again gives `'Already served at 7:52 pm'` for `servedAt 2026-11-19T14:22Z`. Walk-ins stop at the buffer. `endOfDay`: confirmed 10 (2 unserved), buffer 4, walk-ins 3 → `noShows 2`, `cookedWaste 3`.
- [ ] **Step 2–4:** Run → FAIL. Implement. Run → PASS.
- [ ] **Step 5:** Commit: `feat(domain): counter redeem, walk-ins, end-of-day`.

---

### Task 7: Tick planner

**Files:** Create `src/domain/tick.ts`. Test `src/domain/tick.test.ts`.

**Interfaces:**
- Produces:
  ```ts
  export type TickAction =
    | { kind: 'expireStock'; date: string }
    | { kind: 'createOffering'; itemId: string; date: string }
    | { kind: 'remind'; offeringId: string }
    | { kind: 'close'; offeringId: string };
  export function planTick(args: { now: Date; items: Item[]; offerings: Offering[]; sentKeys: Set<string> }): TickAction[]
  ```
  Rules:
  - `expireStock` for today, always first.
  - `createOffering` for each active item offered on today's weekday with no offering for today.
  - `remind` when now ≥ 16:00 IST, the offering is open, and `reminder:{date}:{itemId}` is not in `sentKeys`.
  - `close` for every `open` offering with `now >= cutoffAt`, including past dates that were missed.
  - Never emits anything that reopens or recreates a closed offering.

- [ ] **Step 1: Write failing tests:**
  - At 09:00 on a Thursday with no offerings → `[expireStock, createOffering(paneer)]` and no chicken.
  - At 16:05 → `remind`. The same call with the key already sent → no `remind`.
  - At 17:00 → `close`.
  - An open offering from yesterday at today 09:00 → `close` for it.
  - **(Review Focus 3)** a `closed` offering for today, with `now` moved back to 09:00 → no `close`, no `createOffering`, no `remind`.
  - An inactive item → nothing.
- [ ] **Step 2–4:** Run → FAIL. Implement. Run → PASS.
- [ ] **Step 5:** Commit: `feat(domain): tick planner`.

---

### Task 8: Seed generator and accuracy series

**Files:** Create `src/domain/seed.ts`, `src/domain/accuracy.ts`. Test `src/domain/seed.test.ts`, `src/domain/accuracy.test.ts`.

**Interfaces:**
- Produces:
  ```ts
  export function mulberry32(seed: number): () => number
  export function seedItems(): Item[]   // values from Global Constraints, fixed ids 'item-paneer', 'item-chicken'
  export function seedUsers(): User[]   // 60 students roll 21BCE1001..21BCE1060, rooms 101..160, plus MESS01
  export function trueDemand(item: Item, date: string, weekIndex: number, rand: () => number): { booked: number; walkins: number }
  export function generateSeed(args: { today: string; weeks: number; seed: number }): {
    items: Item[]; users: User[]; offerings: Offering[] /*closed, past dates only*/;
    bookings: Booking[]; charges: Charge[]; batches: StockBatch[] }
  export function historyFrom(offerings: Offering[], itemId: string): DayHistory[]
  export function accuracySeries(offerings: Offering[], itemId: string): { date: string; forecast: number; actual: number }[]
  export function mape(series: { forecast: number; actual: number }[]): number // percent, one decimal
  ```
  Demand model, in `trueDemand`:
  - Base booked: Paneer 40, Chicken 50.
  - Weekday bump: +15% on Sat and Sun.
  - Trend: +0.5 plates per week.
  - Noise: uniform ±15%.
  - 10% chance of a ×1.3 spike.
  - Walk-ins: uniform 3–8.

  `generateSeed` creates past offerings from `today − weeks×7` to yesterday. Each one stores a `forecast` computed from history so far. Booked plates are split across random students as bookings of 1–2 plates, all `confirmed` and charged; about 85% are served. Batches come from recorded purchases, with leftovers carried and expired using the Task 3 functions.

- [ ] **Step 1: Write failing tests:**
  - The same seed gives deep-equal output.
  - Every past offering is `closed`, on an offered weekday, and its date < today.
  - The sum of booking plates per offering equals `confirmedPlates`.
  - Charges equal the confirmed bookings.
  - There are 61 users.
  - `accuracySeries` and `mape` on `[{f:50,a:40},{f:45,a:50}]` → `17.5`.
- [ ] **Step 2–4:** Run → FAIL. Implement. Run → PASS.
- [ ] **Step 5:** Commit: `feat(domain): deterministic seed generator and accuracy metrics`.

---

### Task 9: Repo, database schema, atomic RPCs, `runTick`

**Files:**
- Create: `supabase/migrations/001_schema.sql`, `scripts/db-setup.ts`, `scripts/seed.ts`, `src/services/repo.ts`, `src/services/memoryRepo.ts`, `src/services/supabaseRepo.ts`, `src/services/tick.ts`
- Test: `src/services/tick.test.ts` (runs against `memoryRepo`)

**Interfaces:**
- Consumes: all domain modules.
- Produces:
  ```ts
  export interface Repo {
    getClock(): Promise<ClockState>; setClock(s: ClockState): Promise<void>;
    listItems(): Promise<Item[]>; upsertItem(i: Item): Promise<void>;
    listUsers(): Promise<User[]>;
    listOfferings(q: { from?: string; to?: string; itemId?: string }): Promise<Offering[]>;
    insertOfferingIfAbsent(o: Offering): Promise<void>;          // unique (item_id, date)
    recordPurchase(offeringId: string, batch: StockBatch): Promise<void>;
    listBookings(q: { offeringId?: string; userId?: string; token?: string; shortCode?: string }): Promise<Booking[]>;
    createBooking(b: Booking): Promise<Result<Booking>>;         // RPC create_booking
    cancelBooking(id: string, now: Date): Promise<Result<Booking>>;
    applyClose(offeringId: string, out: CloseOutput): Promise<boolean>; // RPC apply_close; false if already closed
    markServed(bookingId: string, at: string): Promise<Result<Booking>>; // conditional: served_at is null
    incrementWalkin(offeringId: string): Promise<Result<Offering>>;
    listBatches(itemId?: string): Promise<StockBatch[]>; saveBatches(b: StockBatch[]): Promise<void>;
    listCharges(userId: string, month: string): Promise<Charge[]>;
    listNotifications(user: User): Promise<Notification[]>; sentKeys(): Promise<Set<string>>;
    insertNotifications(d: NotificationDraft[]): Promise<void>;  // ignores dedupe conflicts
    markRead(ids: string[]): Promise<void>;
    resetDemo(seed: ReturnType<typeof generateSeed>): Promise<void>;
  }
  export async function runTick(repo: Repo, now: Date): Promise<void>
  ```
  - The SQL tables mirror the spec §8, with snake_case columns plus `offerings.forecast_buy_grams`, `offerings.purchase_assumed`, `notifications.audience`, and `app_settings.demo_set_at`.
  - RLS is enabled with permissive `using (true)` policies (demo).
  - `create_booking(payload jsonb)`: `select ... from offerings where id = ... for update`; if the status is not `open`, raise `'Booking closed for today'`; otherwise insert.
  - `apply_close(offering_id uuid, payload jsonb)`: in one transaction, `select ... for update`. If the status is `closed`, return false. Otherwise update the offering, update the bookings, insert charges (unique `booking_id`), upsert the batches, insert notifications `on conflict (dedupe_key) do nothing`, and return true.
  - The `cancelBooking` RPC rejects the cancel when the offering is closed, under the same lock.
  - `runTick` loads state and calls `planTick`. For `createOffering` it runs `forecast` and stores it along with a `purchaseReadyDraft`. For `remind` it inserts `reminderDraft`. For `close` it runs `closeDay` and then `applyClose`.
  - `memoryRepo` implements the same semantics, using a simple promise mutex per offering for the lock.
  - `scripts/db-setup.ts` runs the migration with `pg` using `DATABASE_URL`.
  - `scripts/seed.ts` runs `resetDemo(generateSeed({ today: istDate(new Date()), weeks: 6, seed: 42 }))` through `supabaseRepo`.

- [ ] **Step 1: Write failing tests** (memory repo seeded with `generateSeed`):
  - `runTick` at Thu 09:00 creates one paneer offering whose `forecastReason` starts with `'Last 4 Thursdays'`, plus one `purchase:` notification.
  - Running it again changes nothing (same counts).
  - Book 3 bookings, then `runTick` at 17:00 → offering closed and 3 charges.
  - **(Review Focus 1)** `await Promise.all([runTick(repo, t), runTick(repo, t)])` at 17:00 → exactly 3 charges, and the stock deducted once.
  - **(Review Focus 2)** call `runTick` at 17:00, then `repo.createBooking(...)` for that offering → `{ ok: false, error: 'Booking closed for today' }`, and no active bookings remain.
  - `markServed` twice → the second call fails.
- [ ] **Step 2–4:** Run → FAIL. Implement the memory repo and `runTick`. Run → PASS.
- [ ] **Step 5:** Write `001_schema.sql` and `supabaseRepo.ts` with the same semantics. Verify against a real project. **The user does this one-time setup:** create a free Supabase project and put the URL, anon key, and `DATABASE_URL` in `app/.env.local`. Then run `npm run db:setup && npm run db:seed`. Expected: `Seeded 61 users, 2 items, N offerings`.
- [ ] **Step 6:** Commit: `feat(services): repo, schema with atomic RPCs, runTick`.

---

### Task 10: App shell — session, demo clock, data hooks, notification bell, demo panel

**Files:** Create `src/services/clock.ts`, `src/services/queries.ts`, `src/ui/App.tsx`, `src/ui/routes.tsx`, `src/ui/session.tsx`, `src/ui/pages/Login.tsx`, `src/ui/components/NotificationBell.tsx`, `src/ui/components/DemoPanel.tsx`. Test `src/ui/components/DemoPanel.test.tsx`.

**Interfaces:**
- Consumes: `Repo`, `runTick`, `resolveNow`.
- Produces:
  - `useNow(): Date` re-renders every second from `resolveNow`. It is the only "now" for the UI.
  - `useRepo(): Repo`.
  - Hooks: `useSession(): { user: User | null; login(rollNo: string): Promise<Result<User>>; logout(); switchRole(role: Role) }`.
  - React Query keys: `['offerings', date]`, `['bookings', userId]`, `['notifications', userId]`, and so on. Supabase realtime on `offerings`, `bookings`, `notifications`, and `app_settings` invalidates the matching keys.
  - `runTick` is called on mount, after every clock change, and every 30 s.
  - Routes: `/login`, `/student`, `/student/bill`, `/mess`, `/mess/items`, `/mess/stock`, `/mess/accuracy`, `/counter`.
  - Login error for an unknown roll number: `'No student with roll number {x}'`. The session is persisted in `localStorage` (wrapped in try/catch).
  - DemoPanel is a floating button, bottom-right, that opens a sheet with:
    - Real time
    - 9:00 am / 4:00 pm / 5:00 pm / 7:30 pm (today)
    - Next day 9:00 am
    - Switch to student / mess
    - Reset demo data (with a confirm dialog)

- [ ] **Step 1: Write failing test:** with the demo time at 17:30 IST, the "9:00 am" and "4:00 pm" buttons are `disabled` and "7:30 pm" is enabled (**Review Focus 3**). Clicking "Next day" calls `setClock` with `demoNow` equal to the next day's 09:00 IST.
- [ ] **Step 2–4:** Run → FAIL. Implement. Run → PASS.
- [ ] **Step 5:** `npm run dev`. Log in as `21BCE1001`; the bell shows the seeded notifications. Commit: `feat(ui): app shell, demo clock panel, notifications`.

---

### Task 11: Student screens — Today, QR coupon, My bill

**Files:** Create `src/ui/pages/student/Today.tsx`, `src/ui/pages/student/Bill.tsx`, `src/ui/components/QrCoupon.tsx`, `src/ui/components/Countdown.tsx`. Test `src/ui/pages/student/Today.test.tsx`.

**Interfaces:**
- Consumes: Task 10 hooks, `makeBooking`, `cancelBooking`, `formatRupees`.
- Behaviour:
  - **Today** shows each of today's offerings as a card: name, price, and a countdown `"Closes in 2h 14m"`, or `"Booking closed"` after the cutoff. There is **no plates-left count**.
  - The card has a plate stepper (1–10) and a **Book** button.
  - Below the cards, the student's bookings for today: QR (rendered with `qrcode` from `token`), short code, plates, status chip, and a **Cancel** button before the cutoff.
  - After the close, the chip shows `Confirmed · ₹120 charged`, `Trimmed · 1 of 2`, or `Cancelled · not charged`.
  - "No extras tonight" when there are no offerings.
  - **Bill** shows the current month's charges as rows (date · item · plates · ₹) and a total.

- [ ] **Step 1: Write failing tests** (memory repo, demo time 16:00): booking 2 plates shows a QR `<canvas>`/`<img>` and the code. Cancel removes the QR and shows "Cancelled". At 17:01 the Book and Cancel buttons are absent and "Booking closed" is shown.
- [ ] **Step 2–4:** Run → FAIL. Implement. Run → PASS.
- [ ] **Step 5:** Manual check on a 375 px viewport. Commit: `feat(ui): student booking, QR coupon, bill`.

---

### Task 12: Mess screens — Dashboard, Items, Stock, Accuracy

**Files:** Create `src/ui/pages/mess/Dashboard.tsx`, `Items.tsx`, `Stock.tsx`, `Accuracy.tsx`. Test `src/ui/pages/mess/Dashboard.test.tsx`.

**Interfaces:**
- Consumes: Task 10 hooks, `newBatch`, `endOfDay`, `accuracySeries`, `mape`, `formatKg`.
- Behaviour:
  - **Dashboard**, per offering today:
    - Before 17:00: the forecast reason, a "Record purchase" input (kg, prefilled with the suggestion) that calls `recordPurchase`, and the live booked plates total.
    - After 17:00: the cooking sheet ("Cook {confirmed} booked + {buffer} walk-in = {total} plates · {kg}"), a `Purchase assumed` badge if `purchaseAssumed`, and a shortfall banner if anything was trimmed.
  - The Dashboard also has a **Yesterday** section showing the `endOfDay` numbers.
  - **Items** is an editable table: price ₹, grams per plate, shelf life days, weekdays (checkboxes), default plates, and active.
  - **Stock** lists batches per item: purchased, expires, grams left, and status.
  - **Accuracy** has a Recharts line chart of forecast vs actual per item, plus `"Average error, last 4 weeks: {mape}%"`.

- [ ] **Step 1: Write failing tests:** at 10:00 the dashboard shows the text of `forecastReason`, and recording 6.45 kg creates a 6450 g batch. At 17:30, after `runTick`, the cooking sheet text matches the `cookSheetDraft` numbers. With no purchase recorded, the "Purchase assumed" badge is visible.
- [ ] **Step 2–4:** Run → FAIL. Implement. Run → PASS.
- [ ] **Step 5:** Commit: `feat(ui): mess dashboard, items, stock, accuracy`.

---

### Task 13: Counter screen — QR scan, manual code, walk-ins

**Files:** Create `src/ui/pages/mess/Counter.tsx`, `src/ui/components/QrScanner.tsx`. Test `src/ui/pages/mess/Counter.test.tsx`.

**Interfaces:**
- Consumes: `redeem`, `sellWalkin`, `Repo.markServed`, `Repo.incrementWalkin`.
- Behaviour:
  - `QrScanner` wraps `html5-qrcode` (rear camera) and calls `onToken(token)`.
  - A manual input accepts a short code, case-insensitive, with an optional `-`.
  - The result card is green (`"2 plates · Paneer · Room 214 · Serve"`) or red with the exact error from `redeem`.
  - A "+1 walk-in sold" button per offering shows `"{sold}/{buffer}"`.
  - A camera permission denial falls back to showing only the manual input, with the note `"Camera unavailable — type the code"`.

- [ ] **Step 1: Write failing tests:** a manual code `p-4k8q2m` serves the booking. The same code again shows `'Already served at …'`. A cancelled booking's code shows `'Booking was cancelled'`. Walk-in is disabled at buffer = sold.
- [ ] **Step 2–4:** Run → FAIL. Implement. Run → PASS.
- [ ] **Step 5:** Manual check on a phone: scan a QR from a second device. Commit: `feat(ui): counter with QR scan and walk-ins`.

---

### Task 14: Evals — backtest and report

**Files:** Create `evals/backtest.ts`, `evals/run-evals.ts`; modify `package.json` (scripts). Test `evals/backtest.test.ts`.

**Interfaces:**
- Consumes: `trueDemand`, `forecast`, stock functions, `mulberry32`.
- Produces:
  ```ts
  export interface PolicyResult { days: number; turnedAway: number; cookedWastePlates: number;
    shortfallDays: number; rawExpiredKg: number; mapePct: number | null }
  export function simulateToday(args: { weeks: number; seed: number; fixedPlates: Record<string, number> }): PolicyResult
  export function simulateApp(args: { weeks: number; seed: number }): PolicyResult
  ```
  - **"Today" baseline:** each day the mess cooks `fixedPlates` (Paneer 40, Chicken 50), first come first served. `turnedAway = max(0, demand − fixed)`; `cookedWaste = max(0, fixed − demand)`.
  - **App:** the forecast buys at the start of the day, booked = `trueDemand.booked`, and `closeDay` semantics apply (trim, buffer). Walk-ins beyond the buffer are turned away, unsold buffer counts as cooked waste, and raw stock carries over and expires.
  - Both use the same `trueDemand` draws for a fair comparison, over 12 weeks, seed 7.
  - `run-evals.ts` runs `vitest run --reporter=json`, then both simulations, and writes `../submission/3-evals.md` with:
    1. pass/fail counts and the test names grouped by file
    2. a comparison table (Today vs App) of the metrics above
    3. the manual checklist from Task 15, with empty checkboxes for screenshots

- [ ] **Step 1: Write failing tests:** the same seed gives the same results. `simulateApp(...).cookedWastePlates < simulateToday(...).cookedWastePlates` and `turnedAway` is lower. `shortfallDays` ≤ 10% of days.
- [ ] **Step 2–4:** Run → FAIL. Implement. Run → PASS.
- [ ] **Step 5:** Add the script `"evals": "tsx evals/run-evals.ts"`, then run `npm run evals`. Expected: `submission/3-evals.md` exists with the table filled in. Commit: `feat(evals): backtest vs today baseline and report`.

---

### Task 15: Deploy and submission folder

**Files:** Create `groww/submission/1-one-pager-CHECKLIST.md`, `2-prompts.md`, `4-app-link.md`; `app/vercel.json` (SPA rewrite to `/index.html`).

- [ ] **Step 1:** **The user does this:** import `app/` into Vercel (or run `npx vercel` from `app/`) with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. Expected: the public URL loads `/login`, and deep links like `/counter` work.
- [ ] **Step 2:** Write `4-app-link.md`:
  - the URL
  - demo logins (`21BCE1001`, `21BCE1002`, `MESS01`)
  - a 2-minute tour: student books at 4 pm → jump to 5 pm → bell shows confirmation → switch to mess → cooking sheet → Counter → type the code → served → type it again → rejected
- [ ] **Step 3:** Write `2-prompts.md`: the user's prompts from this brainstorming session, verbatim and in order, followed by "Build: executed `docs/plans/2026-11-19-mess-extras-plan.md` with Claude Code".
- [ ] **Step 4:** Write `1-one-pager-CHECKLIST.md`. It contains **headings and questions only**, no prose answers:
  - your take on the problem
  - who has it, and what you verified vs assumed: 7:30 pm dinner, afternoon purchase, storage days still to verify, synthetic data
  - in scope / out of scope (spec §2)
  - the solution and why
  - a word count target of 300–700
- [ ] **Step 5:** Manual checklist run on the deployed URL. Tick it in `3-evals.md`:
  1. book → cancel → QR gone
  2. book after 5 pm blocked
  3. 4 pm reminder appears once
  4. 5 pm confirmation and bill updated
  5. shortfall (record a small purchase, e.g. 0.3 kg, then book more plates than that covers) → trim notice and no charge
  6. QR served once and rejected the second time
  7. walk-ins stop at the buffer
  8. Reset demo works
- [ ] **Step 6:** Commit: `docs: submission folder and deploy config`.
