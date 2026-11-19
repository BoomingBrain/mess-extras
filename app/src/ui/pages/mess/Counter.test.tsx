import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Counter } from './Counter';
import { makeRepo, renderApp, TODAY } from '../../../test/renderApp';
import { istAt } from '../../../domain/time';
import { makeBooking } from '../../../domain/booking';
import { mulberry32 } from '../../../domain/random';
import { runTick } from '../../../services/tick';
import type { Booking } from '../../../domain/types';

async function setup() {
  const repo = await makeRepo(istAt(TODAY, '10:00'));
  const [o] = await repo.listOfferings({ from: TODAY, to: TODAY });
  const item = (await repo.listItems()).find((i) => i.id === o.itemId)!;
  const mk = async (id: string, user: string, plates: number) => {
    const r = makeBooking({ id, offering: o, item, userId: user, plates, now: istAt(TODAY, '11:00'), rand: mulberry32(id.length * 7) });
    if (!r.ok) throw new Error(r.error);
    await repo.createBooking(r.value);
    return r.value;
  };
  const keep = await mk('keep', 'u-21BCE1014', 2);
  const gone = await mk('gone-booking', 'u-21BCE1002', 1);
  await repo.cancelBooking(gone.id, istAt(TODAY, '12:00'));
  await runTick(repo, istAt(TODAY, '19:40'));
  await repo.setClock({ demoNow: istAt(TODAY, '19:40').toISOString(), demoSetAt: new Date().toISOString() });
  return { repo, keep, gone };
}

const typeCode = async (code: string) => {
  const input = screen.getByLabelText('Coupon code');
  await userEvent.clear(input);
  await userEvent.type(input, code);
  await userEvent.click(screen.getByRole('button', { name: 'Check code' }));
};

describe('Counter', () => {
  it('serves a coupon typed in lowercase, then rejects it the second time', async () => {
    const { repo, keep } = await setup();
    renderApp(<Counter />, { repo, userId: 'u-MESS01' });
    await screen.findByLabelText('Coupon code');
    await typeCode(keep.shortCode.toLowerCase());
    expect(await screen.findByText('2 plates · Paneer · Room 114')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Mark served' }));
    await waitFor(async () => expect((await repo.listBookings({ shortCode: keep.shortCode }))[0].servedAt).not.toBeNull());
    await typeCode(keep.shortCode);
    expect(await screen.findByText(/^Already served at \d{1,2}:\d{2} (am|pm)$/)).toBeInTheDocument();
  });

  it('accepts a code without the dash and rejects a cancelled coupon', async () => {
    const { repo, gone } = await setup();
    renderApp(<Counter />, { repo, userId: 'u-MESS01' });
    await screen.findByLabelText('Coupon code');
    await typeCode((gone as Booking).shortCode.replace('-', ''));
    expect(await screen.findByText('Booking was cancelled')).toBeInTheDocument();
  });

  it('stops walk-in sales at the buffer', async () => {
    const { repo } = await setup();
    const [o] = await repo.listOfferings({ from: TODAY, to: TODAY });
    renderApp(<Counter />, { repo, userId: 'u-MESS01' });
    const btn = await screen.findByRole('button', { name: /Sell 1 walk-in plate/ });
    for (let i = 0; i < (o.bufferPlates ?? 0); i++) {
      await userEvent.click(btn);
      await waitFor(async () => expect((await repo.listOfferings({ from: TODAY, to: TODAY }))[0].walkinsSold).toBe(i + 1));
    }
    await waitFor(() => expect(screen.getByRole('button', { name: /Sell 1 walk-in plate/ })).toBeDisabled());
  });
});
