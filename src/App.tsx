import React, { Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { OfflineIndicator } from './components/pwa/PWAInstallButton';
import { DialogProvider } from './components/ui/DialogContext';
import { HomePage } from './pages/public/HomePage';
import { RegisterPage } from './pages/public/RegisterPage';
import { ResultsPage } from './pages/public/ResultsPage';
import { TvDisplayPage } from './pages/public/TvDisplayPage';
import { VerifyPage } from './pages/public/VerifyPage';
import { LoginPage } from './pages/staff/LoginPage';

const AdminPortal = React.lazy(() =>
  import('./pages/staff/AdminPortal').then((m) => ({ default: m.AdminPortal }))
);
const TeamPortal = React.lazy(() =>
  import('./pages/staff/TeamPortal').then((m) => ({ default: m.TeamPortal }))
);
const JudgePortal = React.lazy(() =>
  import('./pages/staff/JudgePortal').then((m) => ({ default: m.JudgePortal }))
);
const TvControlPage = React.lazy(() =>
  import('./pages/staff/TvControlPage').then((m) => ({ default: m.TvControlPage }))
);

const RouteFallback: React.FC = () => (
  <div className="flex min-h-screen items-center justify-center bg-[#F8FAFC] text-xs font-medium text-slate-500">
    Loading portal…
  </div>
);

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <DialogProvider>
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            {/* Public Editorial Festival Routes */}
            <Route path="/" element={<HomePage />} />
            <Route path="/index.html" element={<HomePage />} />
            <Route path="/results" element={<ResultsPage />} />
            <Route path="/results.html" element={<ResultsPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/register.html" element={<RegisterPage />} />
            <Route path="/verify" element={<VerifyPage />} />
            <Route path="/verify.html" element={<VerifyPage />} />
            <Route path="/tv" element={<TvDisplayPage />} />
            <Route path="/tv.html" element={<TvDisplayPage />} />

            {/* Unified Staff Authentication */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/login.html" element={<LoginPage />} />

            {/* Role-Scoped Workspaces (Code-Split) */}
            <Route path="/admin" element={<AdminPortal />} />
            <Route path="/admin.html" element={<AdminPortal />} />
            <Route path="/team" element={<TeamPortal />} />
            <Route path="/team.html" element={<TeamPortal />} />
            <Route path="/judge" element={<JudgePortal />} />
            <Route path="/judge.html" element={<JudgePortal />} />
            <Route path="/tv-control" element={<TvControlPage />} />
            <Route path="/tv-control.html" element={<TvControlPage />} />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
        <OfflineIndicator />
      </DialogProvider>
    </BrowserRouter>
  );
};

export default App;
