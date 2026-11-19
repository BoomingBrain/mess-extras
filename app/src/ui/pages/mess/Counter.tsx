import { useCallback, useState, type FormEvent } from 'react';
import { useNow, useRepo, useUsers } from '../../AppProviders';
import { useItems, useOfferings } from '../../hooks';
import { QrScanner } from '../../components/QrScanner';
import { redeem } from '../../../domain/counter';
import { istDate } from '../../../domain/time';
import type { Booking } from '../../../domain/types';

/** "p4k8q2m", "P-4K8Q2M", " p-4k8q2m " → "P-4K8Q2M" */
export function normaliseCode(raw: string): string {
  const s = raw.trim().toUpperCase().replace(/\s+/g, '');
  if (/^[A-Z]-/.test(s)) return s;
  return s.length === 7 ? `${s[0]}-${s.slice(1)}` : s;
}

type Check = { kind: 'ok'; booking: Booking; line: string } | { kind: 'bad'; text: string } | { kind: 'served'; text: string };

export function Counter() {
  const repo = useRepo();
  const now = useNow();
  const today = istDate(now);
  const offerings = useOfferings({});
  const items = useItems();
  const users = useUsers();
  const [code, setCode] = useState('');
  const [check, setCheck] = useState<Check | null>(null);
  const [scanning, setScanning] = useState(false);
  const [walkinError, setWalkinError] = useState<string | null>(null);

  const lookup = useCallback(async (q: { token?: string; shortCode?: string }) => {
    const [b] = await repo.listBookings(q);
    const all = await repo.listOfferings({});
    const o = b && all.find((x) => x.id === b.offeringId);
    const r = redeem({ booking: b, offering: o, today: istDate(now), now });
    if (!r.ok) return setCheck({ kind: 'bad', text: r.error });
    const item = (await repo.listItems()).find((i) => i.id === o!.itemId)!;
    const user = (await repo.listUsers()).find((u) => u.id === b.userId);
    const n = b.platesConfirmed ?? 0;
    setCheck({ kind: 'ok', booking: b, line: `${n} ${n === 1 ? 'plate' : 'plates'} · ${item.name} · Room ${user?.room ?? '?'}` });
  }, [repo, now]);

  const onToken = useCallback((token: string) => { setScanning(false); void lookup({ token }); }, [lookup]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return setCheck({ kind: 'bad', text: 'Type the code printed under the QR' });
    void lookup({ shortCode: normaliseCode(code) });
  };

  const serve = async (b: Booking) => {
    const r = await repo.markServed(b.id, now.toISOString());
    if (!r.ok) return setCheck({ kind: 'bad', text: r.error });
    setCheck({ kind: 'served', text: 'Served. Hand over the plate.' });
    setCode('');
  };

  const sellWalkin = async (offeringId: string) => {
    setWalkinError(null);
    const r = await repo.incrementWalkin(offeringId);
    if (!r.ok) setWalkinError(r.error);
  };

  if (!offerings.data || !items.data || !users.data) return <p className="text-muted">Loading…</p>;
  const todays = offerings.data.filter((o) => o.date === today);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-extrabold tracking-tight">Counter</h1>
        <p className="text-muted">Scan the student's QR, or type the code under it.</p>
      </div>

      <section className="space-y-3">
        {scanning ? <QrScanner onToken={onToken} onClose={() => setScanning(false)} /> : (
          <button className="btn-primary w-full py-4 text-lg" onClick={() => { setCheck(null); setScanning(true); }}>Scan QR</button>
        )}
        <form onSubmit={submit} className="flex gap-2">
          <div className="flex-1">
            <label htmlFor="code" className="sr-only">Coupon code</label>
            <input id="code" className="field text-lg uppercase tracking-wider" placeholder="P-4K8Q2M" autoComplete="off"
              value={code} onChange={(e) => { setCode(e.target.value); setCheck(null); }} />
          </div>
          <button className="btn-quiet" type="submit">Check code</button>
        </form>

        {check?.kind === 'ok' && (
          <div className="rounded-xl bg-vegsoft p-5" role="status">
            <p className="font-display text-2xl font-extrabold text-veg">{check.line}</p>
            <p className="text-sm text-veg">Valid coupon {check.booking.shortCode}</p>
            <button className="btn mt-3 w-full bg-veg py-3 text-lg text-white" onClick={() => void serve(check.booking)}>Mark served</button>
          </div>
        )}
        {check?.kind === 'served' && <p role="status" className="rounded-xl bg-vegsoft p-4 font-bold text-veg">{check.text}</p>}
        {check?.kind === 'bad' && (
          <div role="alert" className="rounded-xl bg-badsoft p-5">
            <p className="font-display text-xl font-bold text-bad">{check.text}</p>
            <p className="text-sm text-bad">Don't serve against this coupon.</p>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-xl font-bold">Walk-ins</h2>
        {todays.length === 0 && <p className="text-muted">No extras today.</p>}
        {todays.map((o) => {
          const item = items.data.find((i) => i.id === o.itemId)!;
          const buffer = o.bufferPlates ?? 0;
          const closed = o.status === 'closed';
          return (
            <div key={o.id} className="panel flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <p className="font-bold">{item.name}</p>
                <p className="text-sm text-muted">{closed ? `${o.walkinsSold} of ${buffer} walk-in plates sold` : 'Walk-in plates are set at 5 pm'}</p>
              </div>
              <button className="btn-quiet" disabled={!closed || o.walkinsSold >= buffer}
                aria-label={`Sell 1 walk-in plate of ${item.name}`} onClick={() => void sellWalkin(o.id)}>
                {closed && o.walkinsSold >= buffer ? 'No walk-in plates left' : '+1 walk-in sold'}
              </button>
            </div>
          );
        })}
        {walkinError && <p role="alert" className="font-bold text-bad">{walkinError}</p>}
      </section>
    </div>
  );
}
