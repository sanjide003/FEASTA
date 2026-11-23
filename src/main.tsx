import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import { bootstrapFirebase } from './lib/firebase';

async function startApp() {
  await bootstrapFirebase();
  const rootEl = document.getElementById('root');
  if (!rootEl) return;
  createRoot(rootEl).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}

startApp();
