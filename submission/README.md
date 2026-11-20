# Mess Extras

Book your hostel mess extra (paneer, chicken) before 5 pm, and the mess cooks for the people who booked.

**Live app:** https://mess-extras.vercel.app

## The problem

In our hostel mess, students can pay extra for an item that isn't on the regular menu, like paneer or chicken. The mess makes only a limited amount, because leftovers are a loss the mess has to bear. So the extras run out by about 8:15 pm, even though dinner runs from 7:30 to 9:30 pm. If you're late, you miss out.

Mess Extras lets students book before 5 pm. The mess then knows exactly how many plates to cook, and a forecast tells it how much to buy each morning.

## How it works

1. **In the morning**, the mess sees a suggested purchase, such as "Buy 6.5 kg paneer", worked out from the last four weeks of bookings.
2. **Until 5 pm**, students book any number of plates and can cancel for free. Each booking gets a QR coupon.
3. **At 5 pm**, booking closes. Each booking is charged to the student's mess bill, whether or not they collect it. The mess gets its cooking sheet: plates booked, plus a few extra for walk-ins.
4. **At dinner**, the counter scans the QR code (or types the code under it) and marks the plate served. A coupon can only be used once.

Leftover raw ingredients are carried over in stock, since the mess has a blast freezer, and the next day's purchase suggestion accounts for them.

## Try it in 2 minutes

Open https://mess-extras.vercel.app.

1. Log in as **Student 21BCE1001**.
2. Open **Demo clock** (bottom right) and choose **Next day, 9:00 am**, then **4:00 pm**. The demo clock only moves forward, so starting from the next morning works at any time of day.
3. Book 2 plates. A QR coupon appears.
4. Choose **5:00 pm** on the demo clock. Booking closes, the coupon is stamped "Paid", the bell shows a confirmation, and **My bill** shows the charge.
5. Choose **Switch to mess**. **Today** shows the cooking sheet.
6. Go to **Counter**, type your coupon code and choose **Mark served**. Type the same code again and it says "Already served".
7. Look at **Forecast** (predicted against actual demand) and **Stock** (raw ingredients carried over).

**Demo logins:** `21BCE1001` and `21BCE1002` (students), `MESS01` (mess counter).

**Things to know about the demo:**
- Everyone using the live app shares one database and one demo clock. If someone has already moved the clock, choose **Demo clock → Reset demo data** to start clean.
- Other students' bookings are simulated each day, so the numbers look like a real mess.
- The six weeks of booking history are made up (synthetic).

## Run it on your computer

You need [Node.js](https://nodejs.org) 20 or later.

```bash
git clone https://github.com/BoomingBrain/mess-extras.git
cd mess-extras/app
npm install
npm run dev
```

Open the address it prints (usually http://localhost:5173).

No accounts or keys are needed. Without Supabase settings, the app runs in **local mode**: all data lives in your browser, and two open tabs stay in sync. To start over, use **Reset demo data**.

### Optional: use your own shared database (Supabase)

To share data across devices, the way the live app does:

1. Create a free project at [supabase.com](https://supabase.com).
2. Copy `app/.env.example` to `app/.env.local` and fill in:
   - `VITE_SUPABASE_URL`: the Project URL (Project Settings → Data API), for example `https://abcd.supabase.co`, with nothing after `.co`.
   - `VITE_SUPABASE_ANON_KEY`: the **publishable** key (`sb_publishable_…`) or the legacy `anon` key. Never use the secret or `service_role` key.
   - `DATABASE_URL`: from **Connect → Connection String → URI → Session pooler**, with your database password filled in. Write any `@` in the password as `%40`.
3. Create the tables and load the demo data:
   ```bash
   npm run db:setup
   npm run db:seed
   ```
4. Run `npm run dev` again. The app now uses Supabase.

## Deploy your own copy

1. Push the repo to GitHub.
2. On [vercel.com](https://vercel.com), choose **Add New → Project** and import the repo.
3. Set **Root Directory** to `app`. Vercel detects Vite by itself.
4. Add the two environment variables `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. `DATABASE_URL` is only for setup on your computer.
5. Choose **Deploy**.

For a real mess, add `VITE_SIMULATE_STUDENTS=false` to switch off the simulated students.

## Tests and evals

```bash
cd app
npm test         # 98 automated tests
npm run evals    # tests + a 70-day backtest; writes submission/3-evals.md
```

The backtest replays 70 days of synthetic demand:

| Approach | Students turned away | Cooked plates wasted |
|---|---|---|
| Today: cooking a fixed amount | 934 | 0 |
| Cooking the true average every day (impossible to know in advance) | 215 | 191 |
| **Mess Extras** | **91** (2.2%) | **56** |

## How the forecast works

For each item, the app looks at the same weekday over the last four weeks. It plans for the busiest of those days, or the average plus 15%, whichever is higher. It then subtracts the raw stock already in hand. The mess sees the reason next to the number, for example "Last 4 Thursdays: 58, 58, 65, 50 (avg 58, peak 65)". The forecast leans high on purpose: extra raw stock keeps in the freezer, but running short breaks a promise to a student who booked.

## What's not included

Real payments, real student login, phone push notifications (notifications show inside the app), the regular menu, breakfast and lunch, and more than one hostel.

## Built with

React, TypeScript, Vite, Tailwind CSS, TanStack Query, Supabase (Postgres and realtime) and Vercel, built with Claude Code.

## Repository layout

```
app/                 the web app
  src/domain/        the rules: booking, 5 pm close, forecast, stock, counter (pure, tested functions)
  src/services/      data storage: in-browser (local mode) or Supabase
  src/ui/            screens and components
  supabase/          database schema
  evals/             the backtest and the eval report generator
docs/                design spec and implementation plan
submission/          the case study submission: one-pager, prompts, evals, app link
```
