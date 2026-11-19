import { QueryClient, QueryClientProvider, useQuery, useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Repo } from '../services/repo';
import type { Role, User } from '../domain/types';
import { err, ok, type Result } from '../domain/types';
import { resolveNow, type ClockState } from '../domain/clock';
import { runTick } from '../services/tick';

const RepoCtx = createContext<Repo | null>(null);
export const useRepo = (): Repo => {
  const r = useContext(RepoCtx);
  if (!r) throw new Error('No repo');
  return r;
};

const SESSION_KEY = 'mess-extras-session';
const readSession = () => { try { return localStorage.getItem(SESSION_KEY); } catch { return null; } };
const writeSession = (v: string | null) => {
  try { if (v) localStorage.setItem(SESSION_KEY, v); else localStorage.removeItem(SESSION_KEY); } catch { /* ignore */ }
};

export function useClockState(): ClockState | undefined {
  const repo = useRepo();
  return useQuery({ queryKey: ['clock'], queryFn: () => repo.getClock() }).data;
}

/** The app's single notion of "now" (demo-aware), re-rendering every second. */
export function useNow(): Date {
  const clock = useClockState();
  const [real, setReal] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setReal(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return resolveNow(clock ?? { demoNow: null, demoSetAt: null }, real);
}

interface Session {
  user: User | null;
  ready: boolean;
  login(rollNo: string): Promise<Result<User>>;
  logout(): void;
  switchRole(role: Role): Promise<void>;
}
const SessionCtx = createContext<Session | null>(null);
export const useSession = (): Session => {
  const s = useContext(SessionCtx);
  if (!s) throw new Error('No session');
  return s;
};

export function useUsers() {
  const repo = useRepo();
  return useQuery({ queryKey: ['users'], queryFn: () => repo.listUsers() });
}

function SessionProvider({ children }: { children: ReactNode }) {
  const users = useUsers();
  const [userId, setUserId] = useState<string | null>(readSession);
  const lastStudent = useRef<string>('u-21BCE1001');
  const user = users.data?.find((u) => u.id === userId) ?? null;
  if (user?.role === 'student') lastStudent.current = user.id;

  const set = useCallback((id: string | null) => { writeSession(id); setUserId(id); }, []);
  const value = useMemo<Session>(() => ({
    user,
    ready: users.isSuccess,
    async login(rollNo) {
      const list = users.data ?? [];
      const u = list.find((x) => x.rollNo.toLowerCase() === rollNo.trim().toLowerCase());
      if (!u) return err(`No student with roll number ${rollNo.trim()}`);
      set(u.id);
      return ok(u);
    },
    logout: () => set(null),
    async switchRole(role) {
      set(role === 'mess' ? (users.data?.find((u) => u.role === 'mess')?.id ?? 'u-MESS01') : lastStudent.current);
    },
  }), [user, users.isSuccess, users.data, set]);
  return <SessionCtx.Provider value={value}>{children}</SessionCtx.Provider>;
}

/** Keeps queries fresh on any store change and runs due transitions. */
function Sync() {
  const repo = useRepo();
  const qc = useQueryClient();
  const clock = useClockState();
  const running = useRef(false);

  useEffect(() => repo.subscribe(() => void qc.invalidateQueries()), [repo, qc]);

  useEffect(() => {
    if (!clock) return;
    const tick = async () => {
      if (running.current) return;
      running.current = true;
      try { await runTick(repo, resolveNow(clock, new Date())); } catch (e) { console.error('tick failed', e); }
      finally { running.current = false; }
    };
    void tick();
    const t = setInterval(tick, repo.mode === 'local' ? 3000 : 15000);
    return () => clearInterval(t);
  }, [repo, clock]);
  return null;
}

export function AppProviders({ repo, children }: { repo: Repo; children: ReactNode }) {
  const [qc] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 2000 } } }));
  return (
    <RepoCtx.Provider value={repo}>
      <QueryClientProvider client={qc}>
        <Sync />
        <SessionProvider>{children}</SessionProvider>
      </QueryClientProvider>
    </RepoCtx.Provider>
  );
}
