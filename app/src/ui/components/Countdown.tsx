export function countdownText(ms: number): string {
  if (ms <= 0) return 'Booking closed';
  const mins = Math.floor(ms / 60000);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `Closes in ${h}h ${m}m` : `Closes in ${m}m`;
}

export function Countdown({ cutoffAt, now }: { cutoffAt: string; now: Date }) {
  const ms = Date.parse(cutoffAt) - now.getTime();
  const urgent = ms > 0 && ms <= 60 * 60 * 1000;
  return (
    <p className={`font-display text-3xl font-extrabold leading-none tracking-tight ${ms <= 0 ? 'text-muted' : urgent ? 'text-chilli' : ''}`}>
      {countdownText(ms)}
    </p>
  );
}
