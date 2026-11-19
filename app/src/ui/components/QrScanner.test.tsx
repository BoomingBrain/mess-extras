import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { Counter } from '../pages/mess/Counter';
import { makeRepo, renderApp, TODAY } from '../../test/renderApp';
import { istAt } from '../../domain/time';

const started = vi.fn();
vi.mock('html5-qrcode', () => ({
  Html5Qrcode: class {
    async start() { started(); }
    async stop() {}
    clear() {}
  },
}));

describe('QrScanner on the counter', () => {
  it('starts the camera once and keeps it running while the clock ticks', async () => {
    const repo = await makeRepo(istAt(TODAY, '19:40'));
    renderApp(<Counter />, { repo, userId: 'u-MESS01' });
    await userEvent.click(await screen.findByRole('button', { name: 'Scan QR' }));
    await act(() => new Promise((r) => setTimeout(r, 2500)));
    expect(started).toHaveBeenCalledTimes(1);
  });
});
