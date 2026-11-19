import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import { App } from './ui/App';
import { AppProviders } from './ui/AppProviders';
import { createRepo } from './services/createRepo';

const repo = createRepo();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AppProviders repo={repo}>
        <App />
      </AppProviders>
    </BrowserRouter>
  </StrictMode>,
);
