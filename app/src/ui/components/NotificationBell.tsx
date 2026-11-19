import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useNow, useRepo, useSession } from '../AppProviders';
import { istClock, istDate, prettyDate } from '../../domain/time';

export function NotificationBell() {
  const repo = useRepo();
  const { user } = useSession();
  const now = useNow();
  const [open, setOpen] = useState(false);
  const list = useQuery({
    queryKey: ['notifications', user?.id],
    queryFn: () => repo.listNotifications(user!),
    enabled: !!user,
  });
  // Only show what has "happened" by demo time.
  const items = (list.data ?? []).filter((n) => Date.parse(n.createdAt) <= now.getTime());
  const unread = items.filter((n) => !n.readAt).length;

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next && unread) void repo.markRead(items.filter((n) => !n.readAt).map((n) => n.id), now);
  };

  return (
    <div className="relative">
      <button
        onClick={toggle}
        aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
        aria-expanded={open}
        className="relative rounded-full p-2 hover:bg-white/10"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 min-w-5 rounded-full bg-turmeric px-1.5 text-center text-xs font-bold leading-5 text-ink">
            {unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-12 z-40 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-line bg-white text-ink shadow-xl">
          <p className="border-b border-line px-4 py-3 font-display font-bold">Notifications</p>
          {items.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted">Nothing yet. Reminders and confirmations will show up here.</p>
          ) : (
            <ul className="max-h-96 overflow-y-auto">
              {items.map((n) => (
                <li key={n.id} className={`border-b border-line px-4 py-3 last:border-0 ${n.readAt ? '' : 'bg-vegsoft/50'}`}>
                  <p className="font-bold">{n.title}</p>
                  <p className="text-sm">{n.body}</p>
                  <p className="mt-1 text-xs text-muted">
                    {istDate(new Date(n.createdAt)) === istDate(now) ? 'Today' : prettyDate(istDate(new Date(n.createdAt)))}, {istClock(n.createdAt)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
