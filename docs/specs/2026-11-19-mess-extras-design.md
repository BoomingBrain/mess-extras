# Mess Extras — Design

*Working name. Date: 2026-11-19. Status: draft for approval.*

## 1. Intent and why

In our hostel mess, students can pay on top of the regular fee for **extras** (paneer, chicken) that aren't on the regular menu. Extras are cooked in limited quantity because the mess cannot predict demand and **bears the loss of any cooked leftovers**. The result is first-come-first-served: students who want an extra must reach the mess early, and those who come late miss out even though they would pay.

The app turns guessing into knowing:

- **Students pre-book** extras before **5:00 pm**. They can book any number of plates and cancel for free before 5 pm. At 5 pm the bookings lock and are **charged to the student's mess account whether or not they eat**, so no-show risk moves from the mess to the student.
- **The mess gets a purchase suggestion** each morning, because ingredients are bought in the afternoon, before bookings close. The suggestion intentionally **leans high**: surplus is *raw* stock that can be stored and used later, while cooked surplus is waste.
- **At 5 pm the mess cooks to the real booked count** (plus a small walk-in buffer). Leftover raw stock carries over and reduces the next purchase.
- The forecast is a **transparent rule, not ML**. It improves as booking history accumulates, and its accuracy is shown over time.

Verified with the mess (by the author): dinner starts at 7:30 pm, and ingredients are bought by the afternoon.
Still to verify: how long raw paneer and chicken can be stored.

## 2. Goals, non-goals, anti-goals

**Goals**
- A student can book, cancel, see a QR coupon, and see their monthly extras bill.
- The mess sees a purchase suggestion with a human-readable reason, records the purchase, gets a 5 pm cooking sheet, scans QR codes at the counter, and logs end-of-day numbers.
- The core rules are automated and tested; those tests become the submitted evals.
- An evaluator can experience a full day in about 5 minutes using a **demo clock**.

**Non-goals (out of scope)**
- Real payments (charges are just recorded as entries on the mess bill)
- The regular mess menu
- Lunch or breakfast (dinner only)
- Multiple hostels or messes
- Real authentication (demo login by roll number)
- An ML model
- Real OS push notifications (an in-app notification bell stands in for them)
- Production-grade security

**Anti-goals (the app fails if any of these happen, even if it technically works)**
- A student is told "confirmed" and then gets no food with no notice.
- A student is charged for a booking that was cancelled or cut by a shortfall.
- A QR coupon can be redeemed twice.
- The forecast is a black box the mess worker can't sanity-check.
- An evaluator has to wait for the real 5 pm to see anything happen.

## 3. Constraints

- **Submission** (from the case-study PDF): a 1-page write-up *written by the candidate, not by AI*; the prompts used; the evals; and a link to the app that evaluators can open.
- **Hosting:** Vercel (frontend) and Supabase (Postgres). Both are free tiers on the candidate's own accounts.
- **Time zone:** all times are Asia/Kolkata.
- **Demo data:** the forecast needs history, so the app is seeded with about 6 weeks of **synthetic** booking history. The write-up must say so.

## 4. Approaches considered

| | Approach | Trade-off |
|---|---|---|
| A | Lovable (React + Supabase), built by pasting prompts | Hosting is fast and the prompts doc writes itself, but there is little control over the code, and the rules are hard to test rigorously |
| **B (chosen)** | Built in Claude Code: React + TypeScript + Supabase, deployed to Vercel | All rules live in one tested module, the tests double as the evals, and there is full control. Costs about 15 minutes of account setup |
| C | Claude-hosted Artifact with a shared database | No accounts needed, but evaluators need claude.ai and camera QR scanning may not work |

The author picked **B** because the product's value is in its rules (the lock, charging, shortfall, single-use QR, and the forecast), and B is the only approach that proves them with real tests.

## 5. Features

### Student
1. **Login** with a roll number (picked from a list or typed; no password).
2. **Today's extras:** the item, its price, and a countdown to 5 pm. There is no "plates left" counter.
3. **Book** any number of plates (1–10 per booking). A student can make more than one booking.
4. **Cancel** for free before 5 pm. After 5 pm, cancelling is disabled.
5. **QR coupon**, created on booking: one QR per booking, carrying the plate count, with a short text code printed under it. If the booking is cancelled, the QR is invalid.
6. **My bill:** extras charged this month, itemised.
7. **Notification bell:**
   - 4:00 pm reminder ("Booking closes in 1 hour")
   - 5:00 pm confirmation ("2 plates confirmed, ₹120 added, code P-4821")
   - shortfall notice (see 7.3)

### Mess
8. **Item setup:** name, price per plate, grams per plate, shelf life of the raw ingredient (days), and which weekdays the item is offered at dinner.
9. **Morning purchase suggestion** per item offered today, with a written reason (see 7.1).
10. **Record purchase:** the grams actually bought.
11. **Stock view:** raw stock per item, by batch, with expiry dates.
12. **5 pm cooking sheet:** the plates booked, the walk-in buffer, the total plates to cook, and the grams to use.
13. **Counter:**
    - Scan a QR with the camera, or type the code, to see "2 plates · Paneer · Room 214 · Serve". The coupon is then marked served.
    - A second scan shows "Already served at 7:52 pm".
    - A "+1 walk-in sold" button.
14. **End of day** (shown automatically on the next morning's view): booked, no-shows, walk-ins sold, cooked plates unsold (waste), and raw stock carried over.
15. **Forecast accuracy:** predicted vs actual demand per day as a simple chart, plus the average error over the last 4 weeks.
16. **Mess notifications:**
    - morning: "Purchase suggestion ready"
    - 5 pm: "Bookings closed — cook N plates"
    - shortfall alert

### Demo
17. **Demo clock** (a floating panel visible to everyone, shared via the database):
    - Real time
    - Jump to 9:00 am, 4:00 pm, 5:00 pm, or 7:30 pm
    - Next day
    - Reset demo data
18. **Role switcher** in the demo panel, to jump between a student and the mess without logging out.

## 6. Architecture

```
React SPA (Vite + TS + Tailwind) on Vercel
 ├─ ui/         pages: student, mess, counter, demo panel
 ├─ services/   reads/writes Supabase; runs "tick" transitions
 └─ domain/     PURE TypeScript rules: no I/O, fully unit-tested
                forecast · booking rules · close-day/shortfall · billing · stock FIFO · notifications
Supabase Postgres (tables below), realtime subscriptions for live updates
```

- **All business rules live in `domain/`** as pure functions taking plain data and "now". These functions are what the evals test.
- **Time comes from one place:** `now()` returns the demo clock if it is set, otherwise real time. No code calls `Date.now()` directly.
- **State transitions are lazy and idempotent ("tick").** Whenever any client loads, or the demo clock moves, the service runs `tick(now)`. It moves each offering whose cutoff has passed from `open` to `closed` using a **conditional update** (`where status = 'open'`), so only one client wins and close-day logic never runs twice. Notifications have a unique `dedupe_key`, so reminders are never duplicated. This avoids cron jobs and edge functions, and it lets the demo clock work naturally.
- **Live updates:** Supabase realtime on `bookings`, `offerings`, and `notifications`, so the mess screen updates when a student books on another phone.
- **QR codes:** rendered with the `qrcode` npm package; scanned with `html5-qrcode`. The QR contains only an unguessable random token. A 6-character short code is stored alongside it for manual entry.
- **Security (demo level):** Supabase anon key with permissive row-level security (RLS). This is noted as a non-goal; production would use Supabase Auth and per-role RLS.

## 7. Core rules

### 7.1 Forecast and purchase suggestion
For an item on a given date:
1. **History:** the actual demand on the same weekday over the last 4 weeks, where actual demand = plates booked at close + walk-ins sold.
2. **Plan plates:** `ceil(max(peak, average × 1.15))`. This leans high on purpose, because surplus raw stock is storable.
3. **Cold start:** with fewer than 2 data points, use the item's `default_plates`, which the mess sets.
4. **Grams needed:** plan plates × grams per plate.
5. **Usable stock:** raw stock not expiring before the date.
6. **Buy:** `max(0, grams needed − usable stock)`.
7. **Reason string:** for example, *"Last 4 Thursdays: 41, 44, 47, 52 (avg 46, peak 52). Planning 53 plates × 150 g = 7.95 kg. In stock: 1.5 kg. Buy 6.45 kg."*

The forecast "improves with data" because the window rolls forward with real numbers, and the accuracy view shows the error over time. Adaptive margins are left for later.

**Offering creation:** `tick` creates today's offerings, idempotently through the unique `(item_id, date)`, for each active item offered on today's weekday. The forecast is computed and stored at that moment.

**Purchase not recorded:** if the mess hasn't recorded a purchase by 5 pm, `closeDay` assumes the suggested amount was bought and flags this in the end-of-day view. Otherwise a forgotten entry would wrongly shortfall-cancel every booking.

### 7.2 Booking
- Allowed only while the offering is `open` and `now` is before the 5 pm cutoff.
- The price per plate is snapshotted onto the booking.
- Cancelling is allowed only before the cutoff. A cancelled booking cannot be charged or redeemed.

### 7.3 Close at 5 pm (`closeDay`)
1. **Capacity:** `floor(usable stock grams / grams per plate)`.
2. **Booked:** the sum of plates over active bookings.
3. **If booked is more than capacity (shortfall):**
   - Walk through the bookings **latest first** and reduce plates until the total fits.
   - A booking can be **partially trimmed**; for example, 3 plates may become 1, and the student is notified "1 of 3 plates confirmed".
   - A booking trimmed to 0 becomes `shortfall_cancelled` and is not charged.
4. **Walk-in buffer:** `min(capacity − confirmed plates, round(average walk-ins on this weekday over the last 4 weeks))`.
5. **Charges:** each confirmed booking is charged confirmed plates × snapshot price, recorded as a charge row.
6. **Stock:** deduct `(confirmed + buffer) × grams per plate`, taking from the oldest batch first. The rest stays as raw stock.
7. **Notifications:** a confirmation to each student, a cooking sheet to the mess, and a shortfall alert to the mess if anything was trimmed.

### 7.4 Counter
- **Redeem:** requires status `confirmed`. It sets `served_at`; a second redeem is rejected and shows the original time.
- **Walk-in:** increments `walkins_sold`. This is not allowed beyond the walk-in buffer; the counter shows "no plates left".

### 7.5 End of day (computed when the next day begins, or on view)
- **No-shows:** confirmed bookings that were not served. They are still charged.
- **Cooked waste:** plates cooked − plates served − walk-ins sold.
- **Expired raw stock:** expired batches are written off and logged.

## 8. Data model (Postgres)

- **`users`:** `id`, `roll_no` (unique), `name`, `room`, `role` (student | mess)
- **`items`:** `id`, `name`, `price_paise`, `grams_per_plate`, `shelf_life_days`, `offered_weekdays int[]`, `default_plates`, `active`
- **`offerings`:** one per item per dinner date.
  - `id`, `item_id`, `date`, `cutoff_at`, `status` (open | closed)
  - `forecast_plates`, `forecast_reason`, `purchased_grams`
  - `capacity_plates`, `confirmed_plates`, `buffer_plates`, `walkins_sold`
  - `closed_at`
  - unique on `(item_id, date)`
- **`bookings`:**
  - `id`, `offering_id`, `user_id`
  - `plates_requested`, `plates_confirmed`, `price_paise`
  - `status` (active | cancelled | confirmed | shortfall_cancelled)
  - `token` (unique), `short_code` (unique)
  - `created_at`, `cancelled_at`, `served_at`
- **`charges`:** `id`, `user_id`, `booking_id` (unique), `amount_paise`, `charged_on`
- **`stock_batches`:** `id`, `item_id`, `grams_initial`, `grams_remaining`, `purchased_on`, `expires_on`, `written_off_at`
- **`notifications`:** `id`, `user_id` (null = all mess users), `kind`, `title`, `body`, `created_at`, `read_at`, `dedupe_key` (unique)
- **`app_settings`:** a single row: `demo_now` (nullable timestamptz)

## 9. Seed data

- **2 items:**
  - Paneer: ₹60, 150 g per plate, shelf life 3 days, offered Tue/Thu/Sat
  - Chicken: ₹90, 200 g per plate, shelf life 2 days, offered Mon/Wed/Fri/Sun
- **About 60 students** and 1 mess user (`MESS01`).
- **6 weeks of synthetic history:** demand per weekday with noise, a mild upward trend, and occasional spikes (for example, a weekend), so the forecast has something real to chase. This is generated by a deterministic seed script, so it is reproducible.

## 10. Evals (submitted as `3-evals.md`)

1. **Rule tests (Vitest, `domain/`)**, about 30 cases covering:
   - booking before and after the cutoff
   - cancel before and after the cutoff
   - charging only confirmed plates
   - shortfall trimming (latest first, partial, never charged when trimmed to 0)
   - a QR coupon redeemed only once, and a cancelled QR rejected
   - stock taken oldest batch first, and expired stock excluded
   - purchase subtraction never going negative
   - the cold-start forecast
   - notification dedupe
   - walk-ins capped at the buffer
2. **Forecast backtest:** a script replays the synthetic history day by day and reports:
   - average forecast error
   - the **shortfall rate** (days the forecast bought too little)
   - **raw surplus** (kg)
   - **cooked waste** (plates)

   These are compared against the **"today" baseline**: a fixed cook quantity with first-come-first-served.
3. **Manual scenario checklist:** about 8 end-to-end walkthroughs using the demo clock, with screenshots.

`npm run evals` runs 1 and 2 and writes the results into `submission/3-evals.md`.

## 11. Submission folder

```
groww/
  Product Case Study.pdf
  docs/specs/  docs/plans/
  app/                     source code (git repo)
  submission/
    1-one-pager.md         WRITTEN BY THE CANDIDATE. Claude provides only a checklist of points to cover
    2-prompts.md           this conversation's prompts + build prompts, in order
    3-evals.md             generated by npm run evals + manual checklist
    4-app-link.md          Vercel URL, demo logins, a 2-minute "how to try it" guide
```

## 12. Left to the builder

- Visual design: mobile-first, with the student view designed as a phone screen and the mess view usable on a phone at the counter.
- Component library choice: plain Tailwind is fine.
- Exact chart library (Recharts is suggested).
- Copy and wording details beyond the examples above.

## 13. Calls made by Claude (not by the author)

These are for the author to check:
- dinner only
- 1–10 plates per booking
- partial trimming in a shortfall
- forecast = peak vs average +15% over the last 4 same weekdays
- walk-in buffer = the average of past walk-ins
- items, prices, and grams in the seed data
- the tick/lazy close approach
- assuming the suggested purchase was bought if none is recorded by 5 pm
- permissive security for the demo
