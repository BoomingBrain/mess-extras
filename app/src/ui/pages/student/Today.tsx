import { useState } from 'react';
import { useRepo, useNow, useSession } from '../../AppProviders';
import { useBookings, useItems, useOfferings } from '../../hooks';
import { Countdown } from '../../components/Countdown';
import { QrCoupon } from '../../components/QrCoupon';
import { FoodMark, isVegItem } from '../../components/FoodMark';
import { DayRail } from '../../components/DayRail';
import { makeBooking, MAX_PLATES, MIN_PLATES } from '../../../domain/booking';
import { cryptoRand } from '../../../domain/random';
import { formatRupees } from '../../../domain/format';
import { istDate, prettyDate } from '../../../domain/time';
import { newId } from '../../../services/repo';
import type { Item, Offering } from '../../../domain/types';

function OfferCard({ offering, item, onBooked }: { offering: Offering; item: Item; onBooked: () => void }) {
  const repo = useRepo();
  const now = useNow();
  const { user } = useSession();
  const [plates, setPlates] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const open = offering.status === 'open' && now.getTime() < Date.parse(offering.cutoffAt);

  const book = async () => {
    setBusy(true);
    setError(null);
    const r = makeBooking({ id: newId(), offering, item, userId: user!.id, plates, now, rand: cryptoRand });
    const saved = r.ok ? await repo.createBooking(r.value) : r;
    setBusy(false);
    if (!saved.ok) return setError(saved.error);
    setPlates(1);
    onBooked();
  };

  return (
    <section className="token token-draft p-5" aria-labelledby={`item-${item.id}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <FoodMark veg={isVegItem(item.name)} />
            <p className="text-sm font-bold text-inksoft">{formatRupees(item.pricePaise)} a plate</p>
          </div>
          <h2 id={`item-${item.id}`} className="mt-1 font-display text-5xl font-extrabold leading-none tracking-tight condensed">{item.name}</h2>
        </div>
        <div className="text-right"><Countdown cutoffAt={offering.cutoffAt} now={now} /></div>
      </div>
      <p className="mt-3 max-w-prose text-sm text-inksoft">
        {open ? 'Book now and your plate is kept for you. Free to cancel until 5 pm.' : 'Bookings for tonight are locked. Walk-in plates may be available at the counter.'}
      </p>
      {open && (
        <>
          <div className="tear my-5" aria-hidden />
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center rounded-md border border-line">
              <button aria-label="Remove a plate" className="px-3 py-2 text-xl font-bold disabled:opacity-30"
                disabled={plates <= MIN_PLATES} onClick={() => setPlates((p) => p - 1)}>−</button>
              <span className="w-10 text-center font-display text-2xl font-extrabold condensed tnum" aria-live="polite">{plates}</span>
              <button aria-label="Add a plate" className="px-3 py-2 text-xl font-bold disabled:opacity-30"
                disabled={plates >= MAX_PLATES} onClick={() => setPlates((p) => p + 1)}>+</button>
            </div>
            <button className="btn-primary flex-1" disabled={busy} onClick={() => void book()}>
              Book {plates} {plates === 1 ? 'plate' : 'plates'}
            </button>
            <p className="w-full text-sm text-inksoft">{formatRupees(plates * item.pricePaise)} is added to your mess bill at 5 pm.</p>
          </div>
        </>
      )}
      {error && <p role="alert" className="mt-3 font-bold text-bad">{error}</p>}
    </section>
  );
}

export function Today() {
  const repo = useRepo();
  const now = useNow();
  const { user } = useSession();
  const today = istDate(now);
  const offerings = useOfferings({ from: today, to: today });
  const items = useItems();
  const bookings = useBookings({ userId: user?.id }, !!user);
  const [cancelError, setCancelError] = useState<string | null>(null);

  if (offerings.isLoading || items.isLoading) return <p className="text-muted">Loading…</p>;
  const offs = offerings.data ?? [];
  const itemOf = (id: string) => items.data!.find((i) => i.id === id)!;
  const mine = (bookings.data ?? [])
    .filter((b) => offs.some((o) => o.id === b.offeringId))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const cancel = async (id: string) => {
    setCancelError(null);
    const r = await repo.cancelBooking(id, now);
    if (!r.ok) setCancelError(r.error);
    void bookings.refetch();
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-inksoft">{prettyDate(today)}</p>
        <h1 className="font-display text-3xl font-extrabold tracking-tight">Tonight's extras</h1>
        <DayRail now={now} />
      </div>
      {offs.length === 0 ? (
        <div className="panel p-6">
          <p className="font-bold">No extras tonight.</p>
          <p className="text-muted">Paneer is on Tuesday, Thursday and Saturday. Chicken is on Monday, Wednesday, Friday and Sunday.</p>
        </div>
      ) : (
        offs.map((o) => <OfferCard key={o.id} offering={o} item={itemOf(o.itemId)} onBooked={() => void bookings.refetch()} />)
      )}
      {mine.length > 0 && (
        <section className="space-y-3" aria-labelledby="my-coupons">
          <h2 id="my-coupons" className="font-display text-xl font-bold">Your coupons</h2>
          {cancelError && <p role="alert" className="font-bold text-bad">{cancelError}</p>}
          {mine.map((b) => {
            const o = offs.find((x) => x.id === b.offeringId)!;
            const canCancel = b.status === 'active' && o.status === 'open' && now.getTime() < Date.parse(o.cutoffAt);
            return (
              <QrCoupon key={b.id} booking={b} item={itemOf(o.itemId)}
                action={canCancel ? <button className="btn-danger py-1.5 text-sm" onClick={() => void cancel(b.id)}>Cancel booking</button> : undefined} />
            );
          })}
        </section>
      )}
    </div>
  );
}
