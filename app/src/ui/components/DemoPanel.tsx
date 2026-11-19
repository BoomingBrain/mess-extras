import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRepo, useNow, useSession } from '../AppProviders';
import { jumpState, jumpTargets, realState } from '../../services/clock';
import { generateSeed } from '../../domain/seed';
import { istClock, istDate, prettyDate } from '../../domain/time';

export function DemoPanel() {
  const repo = useRepo();
  const now = useNow();
  const session = useSession();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const jumps = jumpTargets(now);
  const realIsBehind = Date.now() < now.getTime() - 60_000;

  const act = async (fn: () => Promise<void>) => {
    setBusy(true);
    try { await fn(); } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 flex flex-col items-end gap-2 px-4 pb-3">
      {open && (
        <div role="dialog" aria-label="Demo controls" className="w-72 rounded-xl bg-ink p-4 text-white shadow-2xl">
          <p className="font-display text-lg font-bold leading-tight">Demo clock</p>
          <p className="text-sm text-[#B8C4CC]">{prettyDate(istDate(now))}, {istClock(now)}</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {jumps.map((j) => (
              <button
                key={j.label}
                disabled={j.disabled || busy}
                onClick={() => act(() => repo.setClock(jumpState(j.at, new Date())))}
                className={`rounded-lg bg-white/10 px-2 py-2 text-sm font-bold hover:bg-white/20 disabled:opacity-30 ${j.label.startsWith('Next') ? 'col-span-2' : ''}`}
              >
                {j.label}
              </button>
            ))}
            <button
              disabled={realIsBehind || busy}
              title={realIsBehind ? 'The demo is ahead of real time. Reset the demo to go back.' : undefined}
              onClick={() => act(() => repo.setClock(realState))}
              className="col-span-2 rounded-lg bg-white/10 px-2 py-2 text-sm font-bold hover:bg-white/20 disabled:opacity-30"
            >
              Real time
            </button>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 border-t border-white/15 pt-3">
            <button
              disabled={session.user?.role === 'student'}
              onClick={() => act(async () => { await session.switchRole('student'); navigate('/student'); })}
              className="rounded-lg bg-white/10 px-2 py-2 text-sm font-bold hover:bg-white/20 disabled:opacity-30"
            >
              Switch to student
            </button>
            <button
              disabled={session.user?.role === 'mess'}
              onClick={() => act(async () => { await session.switchRole('mess'); navigate('/mess'); })}
              className="rounded-lg bg-white/10 px-2 py-2 text-sm font-bold hover:bg-white/20 disabled:opacity-30"
            >
              Switch to mess
            </button>
            <button
              disabled={busy}
              onClick={() => {
                if (!window.confirm('Reset all demo data? Bookings made in this demo will be lost.')) return;
                void act(async () => {
                  await repo.resetDemo(generateSeed({ today: istDate(new Date()), weeks: 6, seed: 42 }));
                  await repo.setClock(realState);
                });
              }}
              className="col-span-2 rounded-lg px-2 py-2 text-sm text-[#F3B4AE] hover:bg-white/10"
            >
              Reset demo data
            </button>
          </div>
        </div>
      )}
      <button
        aria-label="Demo controls"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-full border border-white/20 bg-ink/95 py-1.5 pl-3 pr-4 text-sm font-bold text-white shadow-lg backdrop-blur"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
          <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" />
        </svg>
        <span>Demo clock {istClock(now)}</span>
      </button>
    </div>
  );
}
