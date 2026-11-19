import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DemoPanel } from './DemoPanel';
import { makeRepo, renderApp, TODAY } from '../../test/renderApp';
import { istAt } from '../../domain/time';

describe('DemoPanel', () => {
  it('disables jumps earlier than the current demo time and jumps to next day 9 am', async () => {
    const repo = await makeRepo(istAt(TODAY, '17:30'));
    renderApp(<DemoPanel />, { repo, userId: 'u-21BCE1001' });
    await userEvent.click(await screen.findByRole('button', { name: 'Demo controls' }));
    await waitFor(() => expect(screen.getByRole('button', { name: '9:00 am' })).toBeDisabled());
    expect(screen.getByRole('button', { name: '4:00 pm' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '7:30 pm' })).toBeEnabled();
    await userEvent.click(screen.getByRole('button', { name: 'Next day, 9:00 am' }));
    await waitFor(async () => expect((await repo.getClock()).demoNow).toBe(istAt('2026-11-20', '09:00').toISOString()));
  });

  it('switches role between student and mess', async () => {
    const repo = await makeRepo(istAt(TODAY, '10:00'));
    renderApp(<DemoPanel />, { repo, userId: 'u-21BCE1001' });
    await userEvent.click(await screen.findByRole('button', { name: 'Demo controls' }));
    await userEvent.click(screen.getByRole('button', { name: 'Switch to mess' }));
    expect(localStorage.getItem('mess-extras-session')).toBe('u-MESS01');
  });
});
