import type { ClockState } from '../domain/clock';
import { addDays, istAt, istDate } from '../domain/time';

export interface Jump {
  label: string;
  at: Date;
  disabled: boolean;
}

/** Demo jumps for the current demo day. Jumps into the past are disabled: closed days never reopen. */
export function jumpTargets(now: Date): Jump[] {
  const day = istDate(now);
  const t = now.getTime();
  const same = ([label, hhmm]: [string, string]) => {
    const at = istAt(day, hhmm);
    return { label, at, disabled: at.getTime() <= t };
  };
  return [
    ...([['9:00 am', '09:00'], ['4:00 pm', '16:00'], ['5:00 pm', '17:00'], ['7:30 pm', '19:30']] as [string, string][]).map(same),
    { label: 'Next day, 9:00 am', at: istAt(addDays(day, 1), '09:00'), disabled: false },
  ];
}

export const jumpState = (target: Date, real: Date): ClockState => ({
  demoNow: target.toISOString(),
  demoSetAt: real.toISOString(),
});

export const realState: ClockState = { demoNow: null, demoSetAt: null };
