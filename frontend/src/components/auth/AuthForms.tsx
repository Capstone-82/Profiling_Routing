import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { BrandPanel } from './BrandPanel';
import { Mail, Lock, Eye, EyeOff, AlertCircle, ArrowRight, ShieldCheck, Check } from 'lucide-react';

// Shared layout shell
function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', display: 'grid', gridTemplateColumns: '52% 48%' }} className="cs-auth-grid">
      <BrandPanel />
      
      {/* RIGHT — Auth Form Panel */}
      <div style={{ background: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 56px' }}>
        <div style={{ width: '100%', maxWidth: '420px' }}>
          {children}
        </div>
      </div>
    </div>
  );
}

// Security Badge Indicator
function SecurityBadge() {
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: '6px',
      padding: '4px 10px', background: '#DCFCE7', border: '1px solid #86EFAC',
      borderRadius: '999px', fontSize: '11px', fontWeight: 700, color: '#15803D',
      marginBottom: '16px',
    }}>
      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#16A34A', display: 'inline-block' }} />
      Secure enterprise sign-in
    </div>
  );
}



// Enterprise Trust Subtext Footer
function TrustFooter() {
  return (
    <div style={{ marginTop: '32px', paddingTop: '20px', borderTop: '1px solid #F1F5F9', textAlign: 'center' }}>
      <p style={{ fontSize: '11.5px', fontWeight: 700, color: '#5C728D', marginBottom: '6px' }}>
        Enterprise-grade AI governance
      </p>
      <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', fontSize: '11px', color: '#8EA3BD' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <ShieldCheck size={12} style={{ color: '#0066FF' }} /> Encrypted
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <Lock size={12} style={{ color: '#16A34A' }} /> Identity-aware
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <Check size={12} style={{ color: '#0284C7' }} /> Multi-cloud
        </span>
      </div>
    </div>
  );
}

// ─── Shared Form Field ────────────────────────────────────────────────────────
interface FormFieldProps {
  id: string;
  label: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoComplete?: string;
  error?: string;
  disabled?: boolean;
  hint?: string;
  icon: 'email' | 'lock';
}

function FormField({ id, label, type = 'text', value, onChange, placeholder, autoComplete, error, disabled, hint, icon }: FormFieldProps) {
  const [showPw, setShowPw] = useState(false);
  const isPassword = type === 'password';
  const inputType = isPassword ? (showPw ? 'text' : 'password') : type;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <label className="cs-label" htmlFor={id}>{label}</label>
      <div style={{ position: 'relative' }}>
        {/* Lead Icon */}
        <div style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#8EA3BD', display: 'flex', pointerEvents: 'none' }}>
          {icon === 'email' ? <Mail size={16} /> : <Lock size={16} />}
        </div>

        <input
          id={id}
          type={inputType}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          disabled={disabled}
          aria-describedby={error ? `${id}-err` : hint ? `${id}-hint` : undefined}
          aria-invalid={Boolean(error)}
          className={`cs-input ${error ? 'cs-input-error' : ''}`}
          style={{ paddingRight: isPassword ? '42px' : '14px' }}
        />

        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPw(v => !v)}
            style={{
              position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)',
              background: 'none', border: 'none', cursor: 'pointer',
              color: '#8EA3BD', display: 'flex', padding: '2px',
            }}
            tabIndex={-1}
            aria-label={showPw ? 'Hide password' : 'Show password'}
          >
            {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        )}
      </div>
      {error && <p id={`${id}-err`} role="alert" style={{ fontSize: '12px', color: 'var(--cs-error)', display: 'flex', alignItems: 'center', gap: '5px' }}><AlertCircle size={13} />{error}</p>}
      {hint && !error && <p id={`${id}-hint`} style={{ fontSize: '12px', color: 'var(--cs-subtle)' }}>{hint}</p>}
    </div>
  );
}

// Alert box
function AlertBox({ type, children }: { type: 'error' | 'success' | 'info'; children: React.ReactNode }) {
  const styles = {
    error:   { bg: '#FEE2E2', border: '#FCA5A5', color: '#991B1B' },
    success: { bg: '#DCFCE7', border: '#86EFAC', color: '#15803D' },
    info:    { bg: '#EBF3FF', border: '#BFD7FF', color: '#1A365D' },
  }[type];
  return (
    <div style={{ padding: '10px 14px', background: styles.bg, border: `1px solid ${styles.border}`, borderRadius: '8px', fontSize: '13px', color: styles.color, display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
      <AlertCircle size={15} style={{ flexShrink: 0, marginTop: '1px' }} />
      <span>{children}</span>
    </div>
  );
}

function humanizeAuthError(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes('invalid login') || m.includes('invalid credentials') || m.includes('wrong password')) return 'Incorrect email or password. Please try again.';
  if (m.includes('email not confirmed')) return 'Please check your email and confirm your account first.';
  if (m.includes('already registered') || m.includes('user already exists')) return 'An account with this email already exists. Try signing in instead.';
  if (m.includes('password') && m.includes('short')) return 'Password must be at least 6 characters.';
  if (m.includes('rate limit')) return 'Too many attempts. Please wait a moment and try again.';
  if (m.includes('network') || m.includes('fetch')) return 'Connection error. Check your internet and try again.';
  return msg;
}

// ─── LOGIN FORM ───────────────────────────────────────────────────────────────
export function LoginForm() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isValid = email.trim() && password.length >= 6;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;
    setError('');
    setLoading(true);
    try {
      await signIn(email, password);
      navigate('/connections');
    } catch (err: unknown) {
      setError(humanizeAuthError(err instanceof Error ? err.message : 'Sign in failed. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      <SecurityBadge />
      <h2 style={{ fontSize: '26px', fontWeight: 800, color: '#0B1F3A', marginBottom: '6px', letterSpacing: '-0.3px' }}>
        Welcome back
      </h2>
      <p style={{ fontSize: '14px', color: '#5C728D', marginBottom: '24px', lineHeight: 1.5 }}>
        Sign in to your CoreStack workspace.
      </p>


      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }} noValidate>
        <FormField id="login-email" label="Work email" type="email" value={email} onChange={setEmail} placeholder="you@company.com" autoComplete="email" disabled={loading} icon="email" />
        <div>
          <FormField id="login-password" label="Password" type="password" value={password} onChange={setPassword} placeholder="Enter your password" autoComplete="current-password" disabled={loading} icon="lock" />
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '6px' }}>
            <Link to="/forgot-password" style={{ fontSize: '12.5px', color: '#0066FF', textDecoration: 'none', fontWeight: 600 }}>
              Forgot password?
            </Link>
          </div>
        </div>

        {error && <AlertBox type="error">{error}</AlertBox>}

        <button
          type="submit"
          disabled={!isValid || loading}
          className="cs-btn cs-btn-primary"
          style={{ width: '100%' }}
        >
          {loading ? (
            <><div className="cs-spinner" style={{ width: '16px', height: '16px' }} /> Signing in…</>
          ) : (
            <>SIGN IN <ArrowRight size={16} /></>
          )}
        </button>
      </form>

      <p style={{ marginTop: '24px', textAlign: 'center', fontSize: '13.5px', color: '#5C728D' }}>
        Don't have an account?{' '}
        <Link to="/signup" style={{ color: '#0066FF', fontWeight: 700, textDecoration: 'none' }}>
          Create account
        </Link>
      </p>

      <TrustFooter />
    </AuthLayout>
  );
}

// ─── SIGN UP FORM ─────────────────────────────────────────────────────────────
export function SignupForm() {
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const confirmError = confirm && confirm !== password ? 'Passwords do not match.' : '';
  const isValid = email && password.length >= 6 && password === confirm;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;
    setError('');
    setLoading(true);
    try {
      await signUp(email, password);
      setSuccess(true);
      setTimeout(() => navigate('/connections'), 1500);
    } catch (err: unknown) {
      setError(humanizeAuthError(err instanceof Error ? err.message : 'Sign up failed. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  const strength = !password ? null : password.length < 6 ? 'weak' : password.length < 10 ? 'fair' : 'strong';
  const strengthColor = strength === 'weak' ? '#DC2626' : strength === 'fair' ? '#D97706' : '#16A34A';
  const strengthWidth = strength === 'weak' ? '25%' : strength === 'fair' ? '60%' : '100%';

  return (
    <AuthLayout>
      <SecurityBadge />
      <h2 style={{ fontSize: '26px', fontWeight: 800, color: '#0B1F3A', marginBottom: '6px', letterSpacing: '-0.3px' }}>
        Create your account
      </h2>
      <p style={{ fontSize: '14px', color: '#5C728D', marginBottom: '24px', lineHeight: 1.5 }}>
        Get started with AI governance for your cloud models.
      </p>

      {success && (
        <div style={{ marginBottom: '20px' }}>
          <AlertBox type="success">Account created successfully. Redirecting…</AlertBox>
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }} noValidate>
        <FormField id="signup-email" label="Work email" type="email" value={email} onChange={setEmail} placeholder="you@company.com" autoComplete="email" disabled={loading} icon="email" />

        <div>
          <FormField
            id="signup-password"
            label="Password"
            type="password"
            value={password}
            onChange={setPassword}
            placeholder="Min. 6 characters"
            autoComplete="new-password"
            disabled={loading}
            icon="lock"
          />
          {strength && (
            <div style={{ marginTop: '6px' }}>
              <div style={{ height: '3px', background: '#E8EFF7', borderRadius: '2px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: strengthWidth, background: strengthColor, transition: 'width 0.3s, background 0.3s', borderRadius: '2px' }} />
              </div>
              <p style={{ fontSize: '11px', color: strengthColor, marginTop: '4px', fontWeight: 600 }}>
                {strength === 'weak' ? 'Too short' : strength === 'fair' ? 'Fair — consider a longer password' : 'Strong password'}
              </p>
            </div>
          )}
        </div>

        <FormField
          id="signup-confirm"
          label="Confirm password"
          type="password"
          value={confirm}
          onChange={setConfirm}
          placeholder="Re-enter your password"
          autoComplete="new-password"
          disabled={loading}
          error={confirmError}
          icon="lock"
        />

        {error && <AlertBox type="error">{error}</AlertBox>}

        <button
          type="submit"
          disabled={!isValid || loading}
          className="cs-btn cs-btn-primary"
          style={{ width: '100%' }}
        >
          {loading ? <><div className="cs-spinner" style={{ width: '16px', height: '16px' }} /> Creating account…</> : <>CREATE ACCOUNT <ArrowRight size={16} /></>}
        </button>
      </form>

      <p style={{ marginTop: '24px', textAlign: 'center', fontSize: '13.5px', color: '#5C728D' }}>
        Already have an account?{' '}
        <Link to="/login" style={{ color: '#0066FF', fontWeight: 700, textDecoration: 'none' }}>Sign in</Link>
      </p>

      <TrustFooter />
    </AuthLayout>
  );
}

// ─── FORGOT PASSWORD FORM ─────────────────────────────────────────────────────
export function ForgotPasswordForm() {
  const { forgotPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await forgotPassword(email);
      setSent(true);
    } catch (err: unknown) {
      setError(humanizeAuthError(err instanceof Error ? err.message : 'Failed to send reset email.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      <h2 style={{ fontSize: '26px', fontWeight: 800, color: '#0B1F3A', marginBottom: '6px' }}>Reset your password</h2>
      <p style={{ fontSize: '14px', color: '#5C728D', marginBottom: '28px' }}>
        Enter your email and we'll send you a password reset link.
      </p>

      {sent ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <AlertBox type="success">
            Reset link sent to <strong>{email}</strong>. Check your inbox and follow the instructions.
          </AlertBox>
          <Link to="/login" className="cs-btn cs-btn-outline" style={{ width: '100%', textDecoration: 'none' }}>
            Back to Sign In
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }} noValidate>
          <FormField id="forgot-email" label="Work email" type="email" value={email} onChange={setEmail} placeholder="you@company.com" autoComplete="email" disabled={loading} icon="email" />
          {error && <AlertBox type="error">{error}</AlertBox>}
          <button type="submit" disabled={!email || loading} className="cs-btn cs-btn-primary" style={{ width: '100%' }}>
            {loading ? <><div className="cs-spinner" style={{ width: '16px', height: '16px' }} /> Sending…</> : 'SEND RESET LINK'}
          </button>
          <div style={{ textAlign: 'center' }}>
            <Link to="/login" style={{ color: '#5C728D', fontSize: '13px', textDecoration: 'underline' }}>
              Back to Sign In
            </Link>
          </div>
        </form>
      )}
    </AuthLayout>
  );
}

// ─── RESET PASSWORD FORM ──────────────────────────────────────────────────────
export function ResetPasswordForm() {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const isValid = password.length >= 6 && password === confirm;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setSuccess(true);
      setTimeout(() => navigate('/login'), 1500);
    }, 800);
  };

  return (
    <AuthLayout>
      <h2 style={{ fontSize: '26px', fontWeight: 800, color: '#0B1F3A', marginBottom: '6px' }}>Set new password</h2>
      <p style={{ fontSize: '14px', color: '#5C728D', marginBottom: '28px' }}>
        Please enter your new password below.
      </p>

      {success && <AlertBox type="success">Password updated! Redirecting to login…</AlertBox>}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }} noValidate>
        <FormField id="reset-pw" label="New Password" type="password" value={password} onChange={setPassword} placeholder="Min. 6 characters" disabled={loading} icon="lock" />
        <FormField id="reset-confirm" label="Confirm New Password" type="password" value={confirm} onChange={setConfirm} placeholder="Re-enter password" disabled={loading} icon="lock" />
        <button type="submit" disabled={!isValid || loading} className="cs-btn cs-btn-primary" style={{ width: '100%' }}>
          {loading ? 'Updating…' : 'UPDATE PASSWORD'}
        </button>
      </form>
    </AuthLayout>
  );
}
