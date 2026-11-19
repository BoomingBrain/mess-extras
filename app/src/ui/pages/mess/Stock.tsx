import { useNow } from '../../AppProviders';
import { useBatches, useItems } from '../../hooks';
import { formatKg } from '../../../domain/format';
import { istDate, prettyDate } from '../../../domain/time';
import { usableGrams } from '../../../domain/stock';

export function Stock() {
  const now = useNow();
  const today = istDate(now);
  const batches = useBatches();
  const items = useItems();
  if (!batches.data || !items.data) return <p className="text-muted">Loading…</p>;
  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-3xl font-extrabold tracking-tight">Raw stock</h1>
        <p className="text-muted">Leftover raw stock carries over and is used first. It lowers the next purchase suggestion.</p>
      </div>
      {items.data.map((item) => {
        const list = batches.data.filter((b) => b.itemId === item.id && (b.gramsRemaining > 0 || b.purchasedOn >= today))
          .sort((a, b) => b.purchasedOn.localeCompare(a.purchasedOn));
        const wasted = batches.data.filter((b) => b.itemId === item.id && b.writtenOffAt && b.gramsRemaining > 0)
          .reduce((s, b) => s + b.gramsRemaining, 0);
        return (
          <section key={item.id} className="panel p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-display text-xl font-bold">{item.name}</h2>
              <p><span className="text-muted">Usable today </span><b className="font-display text-2xl">{formatKg(usableGrams(batches.data, item.id, today))}</b></p>
            </div>
            {list.length === 0 ? <p className="mt-2 text-muted">No raw stock.</p> : (
              <table className="mt-3 w-full text-left text-sm">
                <thead className="text-muted"><tr><th className="py-1.5 font-bold">Bought</th><th className="py-1.5 font-bold">Use by</th><th className="py-1.5 text-right font-bold">Left</th><th className="py-1.5 text-right font-bold">Status</th></tr></thead>
                <tbody>
                  {list.map((b) => {
                    const status = b.writtenOffAt ? 'Expired' : b.gramsRemaining === 0 ? 'Used' : b.expiresOn === today ? 'Use today' : 'Fresh';
                    return (
                      <tr key={b.id} className="border-t border-line">
                        <td className="py-2">{prettyDate(b.purchasedOn)}</td>
                        <td className="py-2">{prettyDate(b.expiresOn)}</td>
                        <td className="py-2 text-right font-bold">{formatKg(b.gramsRemaining)} <span className="font-normal text-muted">of {formatKg(b.gramsInitial)}</span></td>
                        <td className={`py-2 text-right ${status === 'Expired' ? 'font-bold text-bad' : status === 'Use today' ? 'font-bold text-warn' : ''}`}>{status}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
            {wasted > 0 && <p className="mt-3 text-sm text-bad">Expired and thrown away so far: {formatKg(wasted)}</p>}
          </section>
        );
      })}
    </div>
  );
}
