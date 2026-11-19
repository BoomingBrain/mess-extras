import { useState, type FormEvent } from 'react';
import { useRepo } from '../../AppProviders';
import { useItems } from '../../hooks';
import type { Item } from '../../../domain/types';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function ItemForm({ item }: { item: Item }) {
  const repo = useRepo();
  const [f, setF] = useState({
    price: String(item.pricePaise / 100), grams: String(item.gramsPerPlate), shelf: String(item.shelfLifeDays),
    plates: String(item.defaultPlates), days: item.offeredWeekdays, active: item.active,
  });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const num = (s: string) => Number(s);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    const price = Math.round(num(f.price) * 100);
    const vals = [price, num(f.grams), num(f.shelf), num(f.plates)];
    if (vals.some((v) => !Number.isFinite(v) || v <= 0) || !vals.slice(1).every(Number.isInteger)) {
      return setMsg({ ok: false, text: 'Use positive whole numbers (price can have paise).' });
    }
    await repo.upsertItem({ ...item, pricePaise: price, gramsPerPlate: num(f.grams), shelfLifeDays: num(f.shelf), defaultPlates: num(f.plates), offeredWeekdays: [...f.days].sort(), active: f.active });
    setMsg({ ok: true, text: 'Saved. Price changes apply to new bookings only.' });
  };
  const field = (key: 'price' | 'grams' | 'shelf' | 'plates', label: string) => (
    <div>
      <label htmlFor={`${item.id}-${key}`} className="block text-sm font-bold">{label}</label>
      <input id={`${item.id}-${key}`} aria-label={`${item.name} ${label.toLowerCase()}`} className="field" inputMode="decimal"
        value={f[key]} onChange={(e) => { setF({ ...f, [key]: e.target.value }); setMsg(null); }} />
    </div>
  );

  return (
    <form onSubmit={save} className="panel space-y-4 p-5">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl font-bold">{item.name}</h2>
        <label className="flex items-center gap-2 text-sm font-bold">
          <input type="checkbox" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} /> Offered
        </label>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {field('price', 'Price per plate (₹)')}
        {field('grams', 'Grams per plate')}
        {field('shelf', 'Keeps for (days)')}
        {field('plates', 'Default plates')}
      </div>
      <fieldset>
        <legend className="text-sm font-bold">Days offered at dinner</legend>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {DAYS.map((d, i) => {
            const on = f.days.includes(i);
            return (
              <button type="button" key={d} aria-pressed={on}
                onClick={() => setF({ ...f, days: on ? f.days.filter((x) => x !== i) : [...f.days, i] })}
                className={`rounded-lg border px-3 py-1.5 text-sm font-bold ${on ? 'border-ink bg-ink text-white' : 'border-line bg-white'}`}>{d}</button>
            );
          })}
        </div>
      </fieldset>
      <div className="flex items-center gap-3">
        <button className="btn-primary" type="submit" aria-label={`Save ${item.name}`}>Save</button>
        {msg && <p role={msg.ok ? 'status' : 'alert'} className={`text-sm font-bold ${msg.ok ? 'text-veg' : 'text-bad'}`}>{msg.text}</p>}
      </div>
    </form>
  );
}

export function Items() {
  const items = useItems();
  if (!items.data) return <p className="text-muted">Loading…</p>;
  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-3xl font-extrabold tracking-tight">Items</h1>
        <p className="text-muted">Default plates is used for the forecast until there are two weeks of history.</p>
      </div>
      {items.data.map((i) => <ItemForm key={i.id} item={i} />)}
    </div>
  );
}
