import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useNow } from '../../AppProviders';
import { useItems, useOfferings } from '../../hooks';
import { accuracySeries, mape } from '../../../domain/accuracy';
import { addDays, istDate } from '../../../domain/time';

export function Accuracy() {
  const now = useNow();
  const today = istDate(now);
  const offerings = useOfferings({});
  const items = useItems();
  if (!offerings.data || !items.data) return <p className="text-muted">Loading…</p>;
  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-3xl font-extrabold tracking-tight">Forecast vs actual</h1>
        <p className="max-w-prose text-muted">
          Actual is plates requested plus walk-ins sold. The forecast leans high on purpose: extra raw stock keeps, but a short day breaks a promise to students.
        </p>
      </div>
      {items.data.map((item) => {
        const series = accuracySeries(offerings.data, item.id, today);
        const recent = series.filter((p) => p.date >= addDays(today, -28));
        const color = item.name === 'Chicken' ? '#A8231C' : '#C98A00';
        return (
          <section key={item.id} className="panel p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-display text-xl font-bold">{item.name}</h2>
              <p className="text-sm">Average error, last 4 weeks: <b className="font-display text-xl">{mape(recent)}%</b></p>
            </div>
            <div className="mt-3 h-56">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={series.map((p) => ({ ...p, label: p.date.slice(5) }))} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid stroke="#E9EDF0" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#5A6973' }} tickLine={false} axisLine={{ stroke: '#CBD3D9' }} minTickGap={16} />
                  <YAxis tick={{ fontSize: 11, fill: '#5A6973' }} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 13 }} />
                  <Line name="Forecast" type="monotone" dataKey="forecast" stroke="#1C2830" strokeDasharray="5 4" strokeWidth={2} dot={false} isAnimationActive={false} />
                  <Line name="Actual" type="monotone" dataKey="actual" stroke={color} strokeWidth={2.5} dot={{ r: 2.5 }} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>
        );
      })}
    </div>
  );
}
