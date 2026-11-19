import { Navigate, NavLink, Outlet, Route, Routes } from 'react-router-dom';
import { useRepo, useSession } from './AppProviders';
import { NotificationBell } from './components/NotificationBell';
import { DemoPanel } from './components/DemoPanel';
import { Login } from './pages/Login';
import { Today } from './pages/student/Today';
import { Bill } from './pages/student/Bill';
import { Dashboard } from './pages/mess/Dashboard';
import { Items } from './pages/mess/Items';
import { Stock } from './pages/mess/Stock';
import { Accuracy } from './pages/mess/Accuracy';
import { Counter } from './pages/mess/Counter';
import type { Role } from '../domain/types';

const STUDENT_NAV = [['/student', 'Tonight'], ['/student/bill', 'My bill']] as const;
const MESS_NAV = [['/mess', 'Today'], ['/counter', 'Counter'], ['/mess/stock', 'Stock'], ['/mess/accuracy', 'Forecast'], ['/mess/items', 'Items']] as const;

/** A paneer-yellow token with its punched notch: the app's mark. */
function Wordmark() {
  return (
    <svg width="30" height="30" viewBox="0 0 30 30" aria-hidden className="shrink-0">
      <path d="M3 5h24a1 1 0 0 1 1 1v6a3 3 0 0 0 0 6v6a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-6a3 3 0 0 0 0-6V6a1 1 0 0 1 1-1z" fill="#F7DE8A" stroke="#1C2830" strokeWidth="1.6" />
      <path d="M10 9v12" stroke="#1C2830" strokeWidth="1.6" strokeDasharray="2 2" />
    </svg>
  );
}

function Shell({ role }: { role: Role }) {
  const { user, ready, logout } = useSession();
  const repo = useRepo();
  if (!ready) return <p className="p-6 text-muted">Loading…</p>;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== role) return <Navigate to={user.role === 'mess' ? '/mess' : '/student'} replace />;
  const nav = role === 'student' ? STUDENT_NAV : MESS_NAV;
  return (
    <div className="min-h-dvh pb-28">
      <header className="sticky top-0 z-30 border-b border-line bg-tray/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 pt-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <Wordmark />
            <div className="min-w-0">
              <p className="font-display text-lg font-extrabold leading-tight tracking-tight">Mess Extras</p>
              <p className="truncate text-xs text-inksoft">
                {user.role === 'mess' ? 'Mess counter' : `${user.name}, room ${user.room}`}
                {repo.mode === 'local' ? ' (local demo)' : ''}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <NotificationBell />
            <button onClick={logout} className="rounded-md px-2 py-1 text-sm text-inksoft hover:text-ink">Log out</button>
          </div>
        </div>
        <nav className="mx-auto mt-2 flex max-w-3xl gap-5 overflow-x-auto px-4" aria-label="Main">
          {nav.map(([to, label]) => (
            <NavLink key={to} to={to} end
              className={({ isActive }) => `-mb-px whitespace-nowrap border-b-[3px] py-2 text-sm font-bold ${isActive ? 'border-ink text-ink' : 'border-transparent text-inksoft hover:text-ink'}`}>
              {label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-5">
        <Outlet />
      </main>
    </div>
  );
}

export function App() {
  const { user } = useSession();
  return (
    <>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={<Shell role="student" />}>
          <Route path="/student" element={<Today />} />
          <Route path="/student/bill" element={<Bill />} />
        </Route>
        <Route element={<Shell role="mess" />}>
          <Route path="/mess" element={<Dashboard />} />
          <Route path="/mess/items" element={<Items />} />
          <Route path="/mess/stock" element={<Stock />} />
          <Route path="/mess/accuracy" element={<Accuracy />} />
          <Route path="/counter" element={<Counter />} />
        </Route>
        <Route path="*" element={<Navigate to={user ? (user.role === 'mess' ? '/mess' : '/student') : '/login'} replace />} />
      </Routes>
      {user && <DemoPanel />}
    </>
  );
}
