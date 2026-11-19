import { istAt, istDate } from '../../domain/time';

const STOPS = [
  { at: '08:00', label: 'Booking opens' },
  { at: '17:00', label: 'Closes' },
  { at: '19:30', label: 'Dinner' },
] as const;

/** The student's day as one line: booking runs 8 am to 5 pm, dinner at 7:30. A dot marks now. */
export function DayRail({ now }: { now: Date }) {
  const day = istDate(now);
  const start = istAt(day, '08:00').getTime();
  const end = istAt(day, '19:30').getTime();
  const pos = (t: number) => Math.min(100, Math.max(0, ((t - start) / (end - start)) * 100));
  const close = pos(istAt(day, '17:00').getTime());
  const here = pos(now.getTime());
  const closeAt = istAt(day, '17:00').getTime();
  const urgent = now.getTime() < closeAt && closeAt - now.getTime() <= 60 * 60 * 1000;
  const time = now.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: 'numeric', minute: '2-digit' });

  return (
    <figure className="pt-7" aria-label={`Today: booking from 8 am until 5 pm, dinner at 7:30 pm. It is now ${time}.`}>
      <div className="relative h-2" aria-hidden>
        <div className="absolute inset-y-0 left-0 rounded-l-full bg-ink" style={{ width: `${close}%` }} />
        <div className="absolute inset-y-0 right-0 rounded-r-full bg-line" style={{ left: `${close}%` }} />
        <div className="absolute -top-7 whitespace-nowrap rounded bg-white px-1.5 py-0.5 text-xs font-bold shadow-sm tnum"
          style={{ left: `${here}%`, transform: `translateX(-${here}%)` }}>
          {time}
        </div>
        <div className={`absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-tray ${urgent ? 'bg-chilli' : 'bg-ink'}`}
          style={{ left: `${here}%` }} />
      </div>
      <ol className="relative mt-2 h-9 text-xs text-inksoft" aria-hidden>
        {STOPS.map((s, i) => {
          const p = pos(istAt(day, s.at).getTime());
          const align = i === 0 ? 'left-0' : i === STOPS.length - 1 ? 'right-0 text-right' : '-translate-x-1/2 text-center';
          return (
            <li key={s.at} className={`absolute ${align}`} style={i === 1 ? { left: `${p}%` } : undefined}>
              <span className="block font-bold text-ink tnum">{istLabel(s.at)}</span>
              {s.label}
            </li>
          );
        })}
      </ol>
    </figure>
  );
}

function istLabel(hhmm: string) {
  const [h, m] = hhmm.split(':').map(Number);
  const h12 = ((h + 11) % 12) + 1;
  return `${h12}${m ? `:${String(m).padStart(2, '0')}` : ''} ${h < 12 ? 'am' : 'pm'}`;
}
