# App link

**Live URL:** https://mess-extras.vercel.app

**Source code:** https://github.com/BoomingBrain/mess-extras (see the README for setup)

Everyone shares one database and one demo clock, like a real mess. If someone has already moved the clock, open **Demo clock → Reset demo data** to start clean (it takes a few seconds).

## Run it locally (no accounts needed)

```bash
cd app
npm install
npm run dev        # open the printed localhost URL
```

With no Supabase keys, the app runs in **local mode**: data lives in your browser, and two tabs stay in sync.

## Try it in 2 minutes

1. Log in as **Student 21BCE1001**.
2. Open **Demo clock** (bottom right) and choose **Next day, 9:00 am**, then **4:00 pm**. (The clock only moves forward, so starting from the next morning works at any time of day.) Book 2 plates of tonight's extra. A QR coupon appears.
3. Choose **5:00 pm** on the Demo clock. Bookings lock. The bell shows the confirmation, and **My bill** shows ₹ charged.
4. Choose **Switch to mess** on the Demo clock. **Today** shows the cooking sheet: plates booked by you plus the other (simulated) students, plus walk-ins.
5. Go to **Counter** and type your coupon code. You get a green card. Choose **Mark served**, then type it again: "Already served at …".
6. Check **Forecast** (predicted vs actual) and **Stock** (raw stock carried over). Choose **Next day, 9:00 am** to see a fresh purchase suggestion.

Demo logins: `21BCE1001`, `21BCE1002` (students), `MESS01` (mess counter).
Other students' bookings are simulated each day so the numbers look like a real mess.

## Evals

```bash
cd app
npm run evals      # runs all tests + backtest, rewrites submission/3-evals.md
```
