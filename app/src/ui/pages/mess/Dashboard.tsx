import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useNow, useRepo } from '../../AppProviders';
import { useBookings, useItems, useOfferings } from '../../hooks';
import { formatKg } from '../../../domain/format';
import { addDays, istDate, prettyDate } from '../../../domain/time';
import { endOfDay } from '../../../domain/counter';
import { FoodMark, isVegItem } from '../../components/FoodMark';
import type { Item, Offering } from '../../../domain/types';

function PurchaseForm({ offering }: { offering: Offering }) {
  const repo = useRepo();
  const now = useNow();
  const [kg, setKg] = useState(String(offering.forecastBuyGrams / 1000));
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const grams = Math.round(Number(kg) * 1000);
    if (!Number.isFinite(grams) || grams <= 0) return setMsg({ ok: false, text: 'Enter the kilograms bought, for example 6.5' });
    const r = await repo.recordPurchase(offering.id, grams, now);
    setMsg(r.ok ? { ok: true, text: `Recorded ${formatKg(grams)}. Total bought today: ${formatKg(r.value.purchasedGrams ?? 0)}.` } : { ok: false, text: r.error });
  };
  return (
    <form onSubmit={submit} className="mt-4 flex flex-wrap items-end gap-2">
      <div>
        <label htmlFor={`kg-${offering.id}`} className="block text-sm font-bold">Kilograms bought</label>
        <input id={`kg-${offering.id}`} className="field w-32" inputMode="decimal" value={kg} onChange={(e) => { setKg(e.target.value); setMsg(null); }} />
      </div>
      <button className="btn-primary" type="submit">Record purchase</button>
      {msg && <p role={msg.ok ? 'status' : 'alert'} className={`w-full text-sm font-bold ${msg.ok ? 'text-veg' : 'text-bad'}`}>{msg.text}</p>}
    </form>
  );
}

function OfferingPanel({ offering: o, item }: { offering: Offering; item: Item }) {
  const now = useNow();
  const bookings = useBookings({ offeringId: o.id });
  // Only bookings made by now (simulated students' bookings are timestamped through the day).
  const active = (bookings.data ?? []).filter((b) => b.status === 'active' && Date.parse(b.createdAt) <= now.getTime());
  const bookedPlates = active.reduce((s, b) => s + b.platesRequested, 0);
  const isOpen = o.status === 'open' && now.getTime() < Date.parse(o.cutoffAt);

  if (isOpen || o.status === 'open') {
    return (
      <section className="slip max-w-lg p-5 shadow-sm">
        <ItemHeading item={item} />
        <p className="mt-3 text-sm text-inksoft">Suggested purchase</p>
        <p className="font-display text-5xl font-extrabold leading-none tracking-tight condensed">Buy {formatKg(o.forecastBuyGrams)}</p>
        <p className="mt-2 max-w-prose text-sm">{o.forecastReason}</p>
        <p className="mt-3 text-sm">
          {o.purchasedGrams === null ? 'No purchase recorded yet.' : <>Bought so far: <b>{formatKg(o.purchasedGrams)}</b></>}
        </p>
        <PurchaseForm offering={o} />
        <div className="mt-5 border-t-2 border-dashed border-line pt-4">
          <p className="font-bold">{bookedPlates} {bookedPlates === 1 ? 'plate' : 'plates'} booked so far</p>
          <p className="text-sm text-muted">Bookings close at 5 pm. The cooking sheet appears here then.</p>
        </div>
      </section>
    );
  }

  const confirmed = o.confirmedPlates ?? 0;
  const buffer = o.bufferPlates ?? 0;
  const trimmed = (o.requestedPlates ?? confirmed) - confirmed;
  const total = confirmed + buffer;
  return (
    <section className="slip max-w-lg p-5 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <ItemHeading item={item} />
        {o.purchaseAssumed && (
          <span className="rounded bg-warnsoft px-2 py-0.5 text-sm font-bold text-warn"
            title="No purchase was recorded before 5 pm, so the suggested amount was assumed.">Purchase assumed</span>
        )}
      </div>
      <p className="mt-3 font-display text-5xl font-extrabold leading-none tracking-tight condensed">Cook {total} plates</p>
      <p className="sr-only">{confirmed} booked + {buffer} for walk-ins, using {formatKg(total * item.gramsPerPlate)} {item.name.toLowerCase()}.</p>
      <dl className="mt-4 max-w-xs text-sm tnum" aria-hidden>
        <div className="flex justify-between py-1"><dt>Booked by students</dt><dd className="font-bold">{confirmed}</dd></div>
        <div className="flex justify-between py-1"><dt>Kept for walk-ins</dt><dd className="font-bold">+ {buffer}</dd></div>
        <div className="flex justify-between border-t-2 border-ink py-1 font-bold"><dt>Plates to cook</dt><dd>{total}</dd></div>
        <div className="flex justify-between py-1 text-inksoft"><dt>{item.name} needed</dt><dd>{formatKg(total * item.gramsPerPlate)}</dd></div>
      </dl>
      {trimmed > 0 && (
        <p role="alert" className="mt-3 rounded bg-badsoft p-3 text-sm font-bold text-bad">
          Stock ran short by {trimmed} {trimmed === 1 ? 'plate' : 'plates'}. The latest bookings were trimmed and those students were not charged.
        </p>
      )}
      <div className="mt-5 flex flex-wrap gap-3">
        <Link to="/counter" className="btn-primary">Open counter</Link>
        <p className="self-center text-sm text-inksoft tnum">Walk-ins sold: {o.walkinsSold} of {buffer}</p>
      </div>
    </section>
  );
}

function ItemHeading({ item }: { item: Item }) {
  return (
    <h2 className="flex items-center gap-2 font-display text-xl font-bold">
      <FoodMark veg={isVegItem(item.name)} />{item.name}
    </h2>
  );
}

function Yesterday({ offering: o, item }: { offering: Offering; item: Item }) {
  const bookings = useBookings({ offeringId: o.id });
  if (!bookings.data) return null;
  const e = endOfDay(o, bookings.data);
  const cells: [string, number][] = [['Booked', e.booked], ['Collected', e.served], ['No-shows', e.noShows], ['Walk-ins', e.walkins], ['Cooked, not eaten', e.cookedWaste]];
  return (
    <div className="border-t border-line pt-3">
      <p className="font-bold">{item.name}, {prettyDate(o.date)}</p>
      <dl className="mt-2 grid grid-cols-3 gap-3 sm:grid-cols-5">
        {cells.map(([k, v]) => (
          <div key={k}><dt className="text-xs text-muted">{k}</dt><dd className="font-display text-3xl font-extrabold condensed tnum">{v}</dd></div>
        ))}
      </dl>
      {o.purchaseAssumed && <p className="mt-2 text-sm text-warn">No purchase was recorded that day; the suggestion was assumed.</p>}
    </div>
  );
}

export function Dashboard() {
  const now = useNow();
  const today = istDate(now);
  const todays = useOfferings({ from: today, to: today });
  const recent = useOfferings({ from: addDays(today, -3), to: addDays(today, -1) });
  const items = useItems();
  if (!todays.data || !items.data || !recent.data) return <p className="text-muted">Loading…</p>;
  const itemOf = (id: string) => items.data.find((i) => i.id === id)!;
  const lastDay = recent.data.filter((o) => o.status === 'closed').map((o) => o.date).sort().at(-1);
  const last = recent.data.filter((o) => o.date === lastDay);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-extrabold tracking-tight">Today at the mess</h1>
        <p className="text-muted">{prettyDate(today)}</p>
      </div>
      {todays.data.length === 0 ? (
        <div className="panel p-6"><p className="font-bold">No extras are scheduled today.</p>
          <p className="text-muted">Change which days each item is offered in <Link className="underline" to="/mess/items">Items</Link>.</p></div>
      ) : (
        todays.data.map((o) => <OfferingPanel key={o.id} offering={o} item={itemOf(o.itemId)} />)
      )}
      {last.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-display text-xl font-bold">Last service</h2>
          {last.map((o) => <Yesterday key={o.id} offering={o} item={itemOf(o.itemId)} />)}
        </section>
      )}
    </div>
  );
}
