import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LoginForm, SignupForm, ForgotPasswordForm, ResetPasswordForm } from './components/auth/AuthForms';
import { ConnectionsPage } from './components/connections/ConnectionsPage';
import { PlaygroundPage } from './components/playground/PlaygroundPage';
import { GovernancePage } from './components/governance/GovernancePage';
import { ModelsPage } from './components/models/ModelsPage';
import { getConnection } from './services/mock/mockService';

// ─── Full-screen loader ───────────────────────────────────────────────────────
function Loader() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F4F7FB' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
        <span
          style={{
            width: '28px', height: '28px',
            border: '3px solid #C2DCEF',
            borderTopColor: '#0072CE',
            borderRadius: '50%',
            animation: 'cs-spin 0.7s linear infinite',
            display: 'inline-block',
          }}
        />
        <p style={{ fontSize: '13px', color: '#5A7184', fontWeight: 500 }}>Loading…</p>
      </div>
    </div>
  );
}

// ─── RequireAuth — redirect to /login if not authenticated ────────────────────
function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <Loader />;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  return <>{children}</>;
}

// ─── RedirectIfAuth — send authenticated users away from auth pages ───────────
function RedirectIfAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <Loader />;
  if (user) return <Navigate to="/connections" replace />;
  return <>{children}</>;
}

// ─── RequireConnection — playground requires a verified provider ───────────────
function RequireConnection({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (!user) return;
    getConnection().then(conn => {
      if (conn.status !== 'verified') {
        navigate('/connections', { replace: true });
      } else {
        setChecking(false);
      }
    });
  }, [user, navigate]);

  if (loading || checking) return <Loader />;
  return <>{children}</>;
}

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Auth routes */}
          <Route
            path="/login"
            element={<RedirectIfAuth><LoginForm /></RedirectIfAuth>}
          />
          <Route
            path="/signup"
            element={<RedirectIfAuth><SignupForm /></RedirectIfAuth>}
          />
          <Route
            path="/forgot-password"
            element={<RedirectIfAuth><ForgotPasswordForm /></RedirectIfAuth>}
          />
          <Route
            path="/reset-password"
            element={<RedirectIfAuth><ResetPasswordForm /></RedirectIfAuth>}
          />

          {/* Protected: connections */}
          <Route
            path="/connections"
            element={<RequireAuth><ConnectionsPage /></RequireAuth>}
          />

          {/* Protected: playground */}
          <Route
            path="/playground"
            element={
              <RequireAuth>
                <RequireConnection>
                  <PlaygroundPage />
                </RequireConnection>
              </RequireAuth>
            }
          />

          {/* Protected: Governance policies management */}
          <Route
            path="/governance"
            element={
              <RequireAuth>
                <GovernancePage />
              </RequireAuth>
            }
          />

          {/* Protected: Bedrock Model Registry */}
          <Route
            path="/models"
            element={
              <RequireAuth>
                <ModelsPage />
              </RequireAuth>
            }
          />

          {/* Root redirect */}
          <Route path="/" element={<Navigate to="/connections" replace />} />
          <Route path="*" element={<Navigate to="/connections" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
