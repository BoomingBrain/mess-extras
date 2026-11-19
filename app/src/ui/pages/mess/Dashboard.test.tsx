import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Dashboard } from './Dashboard';
import { Items } from './Items';
import { makeRepo, renderApp, TODAY } from '../../../test/renderApp';
import { istAt } from '../../../domain/time';
import { makeBooking } from '../../../domain/booking';
import { mulberry32 } from '../../../domain/random';
import { runTick } from '../../../services/tick';

const mess = 'u-MESS01';

describe('Mess dashboard', () => {
  it('shows the forecast reason and records a purchase as stock', async () => {
    const repo = await makeRepo(istAt(TODAY, '10:00'));
    const [o] = await repo.listOfferings({ from: TODAY, to: TODAY });
    renderApp(<Dashboard />, { repo, userId: mess });
    expect(await screen.findByText(o.forecastReason)).toBeInTheDocument();
    const input = screen.getByLabelText('Kilograms bought');
    await userEvent.clear(input);
    await userEvent.type(input, '6.45');
    await userEvent.click(screen.getByRole('button', { name: 'Record purchase' }));
    await waitFor(async () => {
      const batches = await repo.listBatches('item-paneer');
      expect(batches.some((b) => b.gramsInitial === 6450 && b.purchasedOn === TODAY)).toBe(true);
    });
  });

  it('shows the cooking sheet after 5 pm and flags an assumed purchase', async () => {
    const repo = await makeRepo(istAt(TODAY, '10:00'));
    const [o] = await repo.listOfferings({ from: TODAY, to: TODAY });
    const item = (await repo.listItems()).find((i) => i.id === o.itemId)!;
    for (const [u, p] of [['u-21BCE1001', 2], ['u-21BCE1002', 3]] as const) {
      const b = makeBooking({ id: `b-${u}`, offering: o, item, userId: u, plates: p, now: istAt(TODAY, '11:00'), rand: mulberry32(2) });
      if (b.ok) await repo.createBooking(b.value);
    }
    await runTick(repo, istAt(TODAY, '17:30'));
    await repo.setClock({ demoNow: istAt(TODAY, '17:30').toISOString(), demoSetAt: new Date().toISOString() });
    const [closed] = await repo.listOfferings({ from: TODAY, to: TODAY });
    renderApp(<Dashboard />, { repo, userId: mess });
    const total = (closed.confirmedPlates ?? 0) + (closed.bufferPlates ?? 0);
    expect(await screen.findByText(`Cook ${total} plates`)).toBeInTheDocument();
    expect(screen.getByText(`${closed.confirmedPlates} booked + ${closed.bufferPlates} for walk-ins`, { exact: false })).toBeInTheDocument();
    expect(screen.getByText('Purchase assumed')).toBeInTheDocument();
  });
});

describe('Items', () => {
  it('saves an edited price', async () => {
    const repo = await makeRepo(istAt(TODAY, '10:00'));
    renderApp(<Items />, { repo, userId: mess });
    const price = await screen.findByLabelText('Paneer price per plate (₹)');
    await userEvent.clear(price);
    await userEvent.type(price, '65');
    await userEvent.click(screen.getByRole('button', { name: 'Save Paneer' }));
    await waitFor(async () => expect((await repo.listItems()).find((i) => i.name === 'Paneer')!.pricePaise).toBe(6500));
  });
});
