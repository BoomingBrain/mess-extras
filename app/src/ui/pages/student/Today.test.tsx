import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Today } from './Today';
import { Bill } from './Bill';
import { makeRepo, renderApp, TODAY } from '../../../test/renderApp';
import { istAt } from '../../../domain/time';
import { runTick } from '../../../services/tick';

const me = 'u-21BCE1001';

describe('Student — Tonight', () => {
  it('books 2 plates, shows a QR coupon, then cancels it', async () => {
    const repo = await makeRepo(istAt(TODAY, '16:00'));
    renderApp(<Today />, { repo, userId: me });
    expect(await screen.findByText('Paneer')).toBeInTheDocument();
    expect(screen.getByText(/Closes in 1h 0m|Closes in 59m/)).toBeInTheDocument();
    expect(screen.queryByText(/plates left/i)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Add a plate' }));
    await userEvent.click(screen.getByRole('button', { name: 'Book 2 plates' }));
    const coupon = await screen.findByRole('article', { name: /Paneer coupon/ });
    expect(within(coupon).getByRole('img', { name: /QR code/ })).toBeInTheDocument();
    expect(within(coupon).getByText(/^P-[A-Z0-9]{6}$/)).toBeInTheDocument();
    expect(within(coupon).getByText('Booked')).toBeInTheDocument();

    await userEvent.click(within(coupon).getByRole('button', { name: 'Cancel booking' }));
    await waitFor(() => expect(screen.getByText('Cancelled, not charged')).toBeInTheDocument());
    expect(screen.queryByRole('img', { name: /QR code/ })).not.toBeInTheDocument();
  });

  it('shows booking closed and no actions after 5 pm, with the confirmed charge', async () => {
    const repo = await makeRepo(istAt(TODAY, '15:00'));
    renderApp(<Today />, { repo, userId: me });
    await userEvent.click(await screen.findByRole('button', { name: 'Book 1 plate' }));
    await screen.findByRole('article', { name: /Paneer coupon/ });
    await runTick(repo, istAt(TODAY, '17:01'));
    await repo.setClock({ demoNow: istAt(TODAY, '17:01').toISOString(), demoSetAt: new Date().toISOString() });
    await waitFor(() => expect(screen.getByText('Booking closed')).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: /^Book/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancel booking' })).not.toBeInTheDocument();
    expect(await screen.findByText('Confirmed, ₹60 charged')).toBeInTheDocument();
  });
});

describe('Student — My bill', () => {
  it('lists this month\'s charges with a total', async () => {
    const repo = await makeRepo(istAt(TODAY, '10:00'));
    const charges = await repo.listCharges(me, '2026-11');
    const total = charges.reduce((s, c) => s + c.amountPaise, 0) / 100;
    renderApp(<Bill />, { repo, userId: me });
    expect(await screen.findByText(`₹${total}`)).toBeInTheDocument();
    expect(screen.getAllByRole('row')).toHaveLength(charges.length + 1);
  });
});
