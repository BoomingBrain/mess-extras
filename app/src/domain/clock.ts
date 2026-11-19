export interface ClockState {
  /** Demo time anchor (ISO), or null for real time */
  demoNow: string | null;
  /** Real time (ISO) at which the anchor was set */
  demoSetAt: string | null;
}

/** Demo time keeps flowing from its anchor so countdowns still tick. */
export function resolveNow(state: ClockState, real: Date): Date {
  if (!state.demoNow || !state.demoSetAt) return real;
  return new Date(Date.parse(state.demoNow) + (real.getTime() - Date.parse(state.demoSetAt)));
}
