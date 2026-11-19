import QRCode from 'qrcode';
import { useEffect, useState, type ReactNode } from 'react';
import type { Booking, Item } from '../../domain/types';
import { formatRupees } from '../../domain/format';
import { istClock } from '../../domain/time';

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
  ok: 'bg-vegsoft text-veg',
  warn: 'bg-warnsoft text-warn',
  bad: 'bg-badsoft text-bad',
  plain: 'bg-tray text-ink',
};

/** The meal ticket: details on the left, perforation, QR stub on the right. */
export function QrCoupon({ booking, item, action }: { booking: Booking; item: Item; action?: ReactNode }) {
  const status = statusText(booking);
  const usable = booking.status === 'active' || (booking.status === 'confirmed' && !booking.servedAt);
  const plates = booking.platesConfirmed ?? booking.platesRequested;
  const accent = item.name === 'Chicken' ? 'bg-chilli' : 'bg-turmeric';
  return (
    <article aria-label={`${item.name} coupon`} className="ticket drop-shadow-sm" style={{ ['--notch' as string]: '62%' }}>
      <div className={`h-2 rounded-t-[14px] ${accent}`} />
      <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-stretch">
        <div className="flex-1">
          <p className="font-display text-2xl font-extrabold leading-tight">
            {plates} × {item.name}
          </p>
          <p className="text-sm text-muted">Dinner tonight, from 7:30 pm</p>
          <p className={`mt-3 inline-block rounded-md px-2.5 py-1 text-sm font-bold ${TONE[status.tone]}`}>{status.text}</p>
          {action && <div className="mt-4">{action}</div>}
        </div>
        {usable && (
          <>
            <div className="perforation sm:hidden" aria-hidden />
            <div className="hidden border-l-2 border-dashed border-line sm:block" aria-hidden />
            <div className="mx-auto w-40 text-center sm:w-36">
              <QrSvg value={booking.token} label={`QR code for coupon ${booking.shortCode}`} />
              <p className="mt-2 font-display text-lg font-bold tracking-wider">{booking.shortCode}</p>
              <p className="text-xs text-muted">Show this at the counter</p>
            </div>
          </>
        )}
      </div>
    </article>
  );
}
