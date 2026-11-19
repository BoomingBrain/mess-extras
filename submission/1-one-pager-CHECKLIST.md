# One-pager checklist (write the page yourself)

The case study says the one-pager must **not** be written by AI. This file only lists what to cover. Write `1-one-pager.md` (300–700 words) in your own words.

## a. Your take on the problem
- Who exactly has it? You and your hostel-mates. How many students eat at the mess? How often are extras served?
- What happens today, in one concrete scene? Think of a specific evening you missed paneer.
- Why does the mess cook so little? Who absorbs the loss on leftovers?
- Why is this a problem for *both* sides, not just students?

## Verified vs assumed (the brief asks for this explicitly)
- Verified: dinner starts at 7:30 pm. Who told you, and when?
- Verified: ingredients are bought by the afternoon. Who told you?
- **Still to verify:** how many days raw paneer and chicken keep in the mess fridge. Ask the mess before you submit.
- Assumed: students will accept being charged for a booking they don't collect. Did you ask any hostel-mates?
- Assumed: the demo runs on 6 weeks of *synthetic* booking history. Say this plainly.

## b. In scope
- Pre-booking until 5 pm, free cancel before 5 pm, then charged to the mess bill
- QR coupon at the counter
- Morning purchase suggestion, the 5 pm cooking sheet, and leftover raw stock carried over
- Walk-in plates, and the reminder and confirmation notifications

## c. Out of scope
- Real payments, the regular menu, lunch/breakfast, multiple hostels, real login, real push notifications, ML

## d. Your solution and why
- Why pre-booking instead of "just cook more"?
- Why a 5 pm cutoff? (Dinner is at 7:30 and cooking needs ~2.5 h.)
- Why does the forecast lean *high*? (Raw surplus keeps; cooked surplus is waste.)
- Why a simple, explainable forecast instead of an ML model?
- Why is an app the right tool? The mess needs the number *before* cooking, and paper coupons can't give it.
- What did the evals show? Pick one number from `3-evals.md`.
- Two things the evals caught that you changed: censored demand, and the walk-in buffer stuck at zero.
