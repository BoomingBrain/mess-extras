import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '../AppProviders';

export function Login() {
  const session = useSession();
  const navigate = useNavigate();
  const [roll, setRoll] = useState('');
  const [error, setError] = useState<string | null>(null);

  const go = async (value: string) => {
    const r = await session.login(value);
    if (!r.ok) return setError(r.error);
    navigate(r.value.role === 'mess' ? '/mess' : '/student');
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!roll.trim()) return setError('Enter your roll number');
    void go(roll);
  };

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-10">
      <h1 className="font-display text-4xl font-extrabold leading-[1.05] tracking-tight">
        Book tonight's extra.<br />Skip the rush.
      </h1>
      <p className="mt-3 text-muted">
        Book paneer or chicken before 5 pm and your plate is kept for you. The mess cooks only what's booked.
      </p>
      <form onSubmit={submit} className="mt-8 space-y-3">
        <label htmlFor="roll" className="block font-bold">Roll number</label>
        <input id="roll" className="field text-lg" autoComplete="username" placeholder="21BCE1001"
          value={roll} onChange={(e) => { setRoll(e.target.value); setError(null); }} />
        {error && <p role="alert" className="text-sm font-bold text-bad">{error}</p>}
        <button className="btn-primary w-full text-lg" type="submit">Log in</button>
      </form>
      <div className="mt-8 rounded-xl border border-dashed border-line p-4 text-sm">
        <p className="font-bold">Trying the demo?</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <button className="btn-quiet py-1.5 text-sm" onClick={() => void go('21BCE1001')}>Student 21BCE1001</button>
          <button className="btn-quiet py-1.5 text-sm" onClick={() => void go('21BCE1002')}>Student 21BCE1002</button>
          <button className="btn-quiet py-1.5 text-sm" onClick={() => void go('MESS01')}>Mess counter</button>
        </div>
      </div>
    </main>
  );
}
