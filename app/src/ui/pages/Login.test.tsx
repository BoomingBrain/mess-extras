import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { Login } from './Login';
import { makeRepo, renderApp, TODAY } from '../../test/renderApp';
import { istAt } from '../../domain/time';

describe('Login', () => {
  it('logs in from a quick-login button clicked before the user list has loaded', async () => {
    const repo = await makeRepo(istAt(TODAY, '10:00'));
    let release!: () => void;
    const gate = new Promise<void>((r) => { release = r; });
    const listUsers = repo.listUsers.bind(repo);
    repo.listUsers = async () => { await gate; return listUsers(); };

    renderApp(
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/student" element={<p>Student home</p>} />
      </Routes>,
      { repo, path: '/login' },
    );
    await userEvent.click(screen.getByRole('button', { name: 'Student 21BCE1001' }));
    release();
    expect(await screen.findByText('Student home')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
