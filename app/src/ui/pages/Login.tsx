import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '../AppProviders';
import { FoodMark } from '../components/FoodMark';

/** A picture of what you get: tonight's paneer token, already stamped. */
function SampleToken() {
  return (
    <div aria-hidden className="token token-paneer mx-auto w-full max-w-[19rem] -rotate-2 p-4 shadow-[0_10px_24px_-12px_rgb(28_40_48/0.35)]">
      <div className="flex items-center gap-2">
        <FoodMark veg />
        <p className="text-xs font-bold text-inksoft">Dinner tonight, from 7:30 pm</p>
      </div>
      <div className="mt-1 flex items-end justify-between gap-2">
        <p className="font-display text-4xl font-extrabold leading-none tracking-tight condensed">2 × Paneer</p>
        <span className="stamp" style={{ color: '#1C2830' }}>Plate kept</span>
      </div>
      <div className="tear mt-4" style={{ ['--pad' as string]: '16px' }} />
      <p className="mt-3 font-display text-xl font-extrabold tracking-wide condensed">P-7KQ2XM</p>
    </div>
  );
}

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
      <SampleToken />
      <h1 className="mt-10 font-display text-4xl font-extrabold leading-[1.05] tracking-tight">
        Book tonight's extra.<br />Skip the rush.
      </h1>
      <p className="mt-3 text-inksoft">
        Book paneer or chicken before 5 pm and your plate is kept for you. The mess cooks only what's booked.
      </p>
      <form onSubmit={submit} className="mt-8 space-y-3">
        <label htmlFor="roll" className="block font-bold">Roll number</label>
        <input id="roll" className="field text-lg" autoComplete="username" placeholder="21BCE1001"
          value={roll} onChange={(e) => { setRoll(e.target.value); setError(null); }} />
        {error && <p role="alert" className="text-sm font-bold text-bad">{error}</p>}
        <button className="btn-primary w-full text-lg" type="submit">Log in</button>
      </form>
      <div className="mt-10 border-t border-line pt-5 text-sm">
        <p className="font-bold">Trying the demo? Log in as</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <button className="btn-quiet py-1.5 text-sm" onClick={() => void go('21BCE1001')}>Student 21BCE1001</button>
          <button className="btn-quiet py-1.5 text-sm" onClick={() => void go('21BCE1002')}>Student 21BCE1002</button>
          <button className="btn-quiet py-1.5 text-sm" onClick={() => void go('MESS01')}>Mess counter</button>
        </div>
      </div>
    </main>
  );
}
