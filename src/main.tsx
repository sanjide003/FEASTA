import React from 'react';
import { createRoot } from 'react-dom/client';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import './index.css';
import { bootstrapFirebase } from './lib/firebase';

const isNativeApp = Capacitor.isNativePlatform();

if (typeof window !== 'undefined' && 'serviceWorker' in navigator && !isNativeApp) {
  registerSW({ immediate: true });
}

if (typeof window !== 'undefined' && isNativeApp) {
  CapacitorApp.addListener('backButton', ({ canGoBack }) => {
    if (canGoBack && window.location.pathname !== '/') {
      window.history.back();
    } else {
      CapacitorApp.exitApp();
    }
  }).catch(() => {});
}

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
