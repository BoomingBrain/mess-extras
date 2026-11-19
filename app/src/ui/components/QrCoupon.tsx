import QRCode from 'qrcode';
import { useEffect, useState, type ReactNode } from 'react';
import type { Booking, Item } from '../../domain/types';
import { formatRupees } from '../../domain/format';
import { istClock } from '../../domain/time';
import { FoodMark, isVegItem } from './FoodMark';

function QrSvg({ value, label }: { value: string; label: string }) {
  const [svg, setSvg] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    QRCode.toString(value, { type: 'svg', margin: 0, errorCorrectionLevel: 'M', color: { dark: '#1C2830', light: '#0000' } })
      .then((s) => live && setSvg(s))
      .catch(() => live && setSvg(null));
    return () => { live = false; };
  }, [value]);
  return (
    <div role="img" aria-label={label} className="aspect-square w-full [&>svg]:h-full [&>svg]:w-full"
      dangerouslySetInnerHTML={svg ? { __html: svg } : undefined} />
  );
}

export function statusText(b: Booking): { text: string; tone: 'ok' | 'warn' | 'bad' | 'plain' } {
  const plates = b.platesConfirmed ?? 0;
  switch (b.status) {
    case 'active': return { text: 'Booked', tone: 'plain' };
    case 'cancelled': return { text: 'Cancelled, not charged', tone: 'plain' };
    case 'shortfall_cancelled': return { text: 'Ran short, not charged', tone: 'bad' };
    case 'confirmed':
      if (b.servedAt) return { text: `Served at ${istClock(b.servedAt)}`, tone: 'ok' };
      if (plates < b.platesRequested) return { text: `Trimmed to ${plates} of ${b.platesRequested}, ${formatRupees(plates * b.pricePaise)} charged`, tone: 'warn' };
      return { text: `Confirmed, ${formatRupees(plates * b.pricePaise)} charged`, tone: 'ok' };
  }
}

const TONE = {
  ok: 'text-veg',
  warn: 'text-warn',
  bad: 'text-bad',
  plain: 'text-ink',
};

/** What the mess has stamped on the token so far. */
function stampFor(b: Booking): { text: string; color: string } | null {
  if (b.status === 'active') return { text: 'Plate kept', color: '#1C2830' };
  if (b.status === 'confirmed') return b.servedAt ? { text: 'Eaten', color: '#5A6973' } : { text: 'Paid', color: '#1E6B47' };
  return null;
}

/** The mess token: printed on the item's paper colour, torn along the dashes, QR on the stub. */
export function QrCoupon({ booking, item, action }: { booking: Booking; item: Item; action?: ReactNode }) {
  const status = statusText(booking);
  const usable = booking.status === 'active' || (booking.status === 'confirmed' && !booking.servedAt);
  const plates = booking.platesConfirmed ?? booking.platesRequested;
  const veg = isVegItem(item.name);
  const paper = !usable ? 'token-spent' : veg ? 'token-paneer' : 'token-chicken';
  const stamp = stampFor(booking);
  return (
    <article aria-label={`${item.name} coupon`} className={`token ${paper}`}>
      <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-stretch">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <FoodMark veg={veg} />
            <p className="text-sm font-bold text-inksoft">Dinner tonight, from 7:30 pm</p>
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <p className="font-display text-5xl font-extrabold leading-none tracking-tight condensed">
              {plates} × {item.name}
            </p>
            {stamp && (
              <span key={stamp.text} aria-hidden className="stamp" style={{ color: stamp.color }}>
                {stamp.text}
              </span>
            )}
          </div>
          <p className={`mt-3 text-sm font-bold ${TONE[status.tone]}`}>{status.text}</p>
          {action && <div className="mt-4">{action}</div>}
        </div>
        {usable && (
          <>
            <div className="tear sm:hidden" aria-hidden />
            <div className="tear-v hidden sm:block" aria-hidden />
            <div className="mx-auto w-44 text-center sm:w-36">
              <div className="rounded bg-white p-2.5">
                <QrSvg value={booking.token} label={`QR code for coupon ${booking.shortCode}`} />
              </div>
              <p className="mt-2 font-display text-2xl font-extrabold tracking-wide condensed tnum">{booking.shortCode}</p>
              <p className="text-xs text-inksoft">Show this at the counter</p>
            </div>
          </>
        )}
      </div>
    </article>
  );
}
