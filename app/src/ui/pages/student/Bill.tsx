import { useQuery } from '@tanstack/react-query';
import { useNow, useRepo, useSession } from '../../AppProviders';
import { useBookings, useItems, useOfferings } from '../../hooks';
import { formatRupees } from '../../../domain/format';
import { istDate, monthOf, prettyDate } from '../../../domain/time';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export function Bill() {
  const repo = useRepo();
  const now = useNow();
  const { user } = useSession();
  const month = monthOf(istDate(now));
  const charges = useQuery({ queryKey: ['charges', user?.id, month], queryFn: () => repo.listCharges(user!.id, month), enabled: !!user });
  const bookings = useBookings({ userId: user?.id }, !!user);
  const offerings = useOfferings({ from: `${month}-01` });
  const items = useItems();

  if (!charges.data || !bookings.data || !offerings.data || !items.data) return <p className="text-muted">Loading…</p>;
  const rows = [...charges.data].sort((a, b) => b.chargedOn.localeCompare(a.chargedOn)).map((c) => {
    const b = bookings.data.find((x) => x.id === c.bookingId);
    const o = b && offerings.data.find((x) => x.id === b.offeringId);
    const item = o && items.data.find((i) => i.id === o.itemId);
    return { c, plates: b?.platesConfirmed ?? 0, name: item?.name ?? 'Extra', noShow: b ? !b.servedAt && c.chargedOn < istDate(now) : false };
  });
  const total = rows.reduce((s, r) => s + r.c.amountPaise, 0);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-3xl font-extrabold tracking-tight">My bill</h1>
        <p className="text-muted">Extras charged in {MONTHS[Number(month.slice(5)) - 1]}, added to your mess fees.</p>
      </div>
      <div className="panel flex items-baseline justify-between p-5">
        <p className="font-bold">Total this month</p>
        <p className="font-display text-3xl font-extrabold">{formatRupees(total)}</p>
      </div>
      {rows.length === 0 ? (
        <p className="text-muted">No extras charged this month.</p>
      ) : (
        <div className="panel overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-tray text-muted">
              <tr><th className="px-4 py-2 font-bold">Date</th><th className="px-4 py-2 font-bold">Extra</th><th className="px-4 py-2 text-right font-bold">Amount</th></tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.c.id} className="border-t border-line">
                  <td className="px-4 py-2.5">{prettyDate(r.c.chargedOn)}</td>
                  <td className="px-4 py-2.5">{r.plates} × {r.name}{r.noShow && <span className="ml-2 text-xs text-muted">(not collected)</span>}</td>
                  <td className="px-4 py-2.5 text-right font-bold">{formatRupees(r.c.amountPaise)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
