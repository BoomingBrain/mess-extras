import type { MemoryState, Persistence } from './memoryRepo';

const VERSION = 1;

/** Browser persistence for local mode. Never throws: storage can be blocked or full. */
export function localPersistence(key = 'mess-extras-state'): Persistence {
  return {
    load() {
      try {
        const raw = localStorage.getItem(key);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as { v: number; s: MemoryState };
        return parsed.v === VERSION ? parsed.s : null;
      } catch {
        return null;
      }
    },
    save(s) {
      try {
        localStorage.setItem(key, JSON.stringify({ v: VERSION, s }));
      } catch {
        /* storage unavailable: keep working in memory */
      }
    },
    watch(onExternal) {
      try {
        window.addEventListener('storage', (e) => {
          if (e.key !== key || !e.newValue) return;
          try {
            const parsed = JSON.parse(e.newValue) as { v: number; s: MemoryState };
            if (parsed.v === VERSION) onExternal(parsed.s);
          } catch {
            /* ignore */
          }
        });
      } catch {
        /* no window */
      }
    },
  };
}
