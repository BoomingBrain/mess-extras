import { waitFor } from '@testing-library/react';
import { makeRepo, renderApp, TODAY } from '../test/renderApp';
import { istAt } from '../domain/time';
import { jumpState } from '../services/clock';

describe('Sync tick loop', () => {
  it('runs the due close right after a clock jump, even if a tick was still running', async () => {
    const repo = await makeRepo(istAt(TODAY, '16:50'));
    // Make the first tick slow, as it is against a remote database.
    let release!: () => void;
    const gate = new Promise<void>((r) => { release = r; });
    const listOfferings = repo.listOfferings.bind(repo);
    let first = true;
    repo.listOfferings = async (q) => {
      if (first) { first = false; await gate; }
      return listOfferings(q);
    };

    renderApp(<p>app</p>, { repo });
    await waitFor(() => expect(first).toBe(false)); // the slow tick has started
    await repo.setClock(jumpState(istAt(TODAY, '17:00'), new Date()));
    await new Promise((r) => setTimeout(r, 300)); // the app has seen the new clock while the old tick still runs
    release();

    // Well inside the 3 s local-mode interval: only an immediate re-tick closes it this fast.
    await waitFor(async () => {
      const [o] = await listOfferings({ from: TODAY, to: TODAY });
      expect(o.status).toBe('closed');
    }, { timeout: 1500 });
  });
});

describe('Sync query refresh', () => {
  it('still shows fresh data while change events keep arriving faster than a read takes', async () => {
    const { screen } = await import('@testing-library/react');
    const { useOfferings } = await import('./hooks');
    const repo = await makeRepo(istAt(TODAY, '10:00'));
    let fire!: () => void;
    const subscribe = repo.subscribe.bind(repo);
    repo.subscribe = (cb) => { fire = cb; return subscribe(cb); };
    const listOfferings = repo.listOfferings.bind(repo);
    repo.listOfferings = async (q) => { await new Promise((r) => setTimeout(r, 120)); return listOfferings(q); };

    function Count() {
      const o = useOfferings({ from: TODAY, to: TODAY });
      return <p>{o.data ? `offerings: ${o.data.length}` : 'loading'}</p>;
    }
    renderApp(<Count />, { repo });
    expect(await screen.findByText('offerings: 1')).toBeInTheDocument();
    const [o] = await listOfferings({ from: TODAY, to: TODAY });
    const storm = setInterval(() => fire(), 50); // e.g. dozens of booking inserts in a row
    try {
      await repo.insertOfferingIfAbsent({ ...o, id: 'second', itemId: 'item-chicken' });
      expect(await screen.findByText('offerings: 2', undefined, { timeout: 1500 })).toBeInTheDocument();
    } finally { clearInterval(storm); }
  });
});
