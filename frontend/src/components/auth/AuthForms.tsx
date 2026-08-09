import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { CheckCircle2, AlertCircle, Eye, EyeOff, Check } from 'lucide-react';

function Logo() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2L2 7L12 12L22 7L12 2Z" fill="#0072CE" />
      <path d="M2 17L12 22L22 17M2 12L12 17L22 12" stroke="#0072CE" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ─── Shared Layout ────────────────────────────────────────────────────────────
function AuthLayout({ children }: { children: React.ReactNode }) {
  const pillars = [
    'Multi-provider AI governance',
    'Secure cloud provider connections',
    'Intelligent model routing',
  ];

  return (
    <div className="cs-auth-grid" style={{ minHeight: '100vh', display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
      {/* LEFT — Brand panel */}
      <div
        className="cs-auth-left"
        style={{
          background: 'linear-gradient(180deg, #F4F7FB 0%, #EBF4FD 100%)',
          padding: '48px 64px',
          display: 'flex',
          flexDirection: 'column',
          borderRight: '1px solid var(--cs-border-light)',
        }}
        aria-hidden="true"
      >
        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '80px' }}>
          <Logo />
          <div style={{ lineHeight: 1 }}>
            <div style={{ fontSize: '16px', fontWeight: 800, color: '#13263F', letterSpacing: '-0.2px' }}>CORESTACK</div>
            <div style={{ fontSize: '9px', fontWeight: 700, color: '#0072CE', letterSpacing: '0.08em', textTransform: 'uppercase', marginTop: '2px' }}>AI Governance OS</div>
          </div>
        </div>

        {/* Headline */}
        <div style={{ marginBottom: '32px' }}>
          <h1 style={{ fontSize: '32px', fontWeight: 800, color: '#13263F', lineHeight: 1.2, marginBottom: '16px' }}>
            Govern AI models<br />with confidence.
          </h1>
          <p style={{ fontSize: '15px', color: '#5A7184', lineHeight: 1.6, maxWidth: '400px' }}>
            Connect your cloud AI providers, govern model access, and intelligently route workloads across foundation models.
          </p>
        </div>

        {/* Pillars */}
        <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {pillars.map(p => (
            <li key={p} style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '14px', color: '#2B3F57', fontWeight: 500 }}>
              <CheckCircle2 size={18} style={{ color: '#0072CE', flexShrink: 0 }} />
              {p}
            </li>
          ))}
        </ul>
      </div>

      {/* RIGHT — Auth panel */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--cs-bg-page)',
          padding: '24px',
        }}
      >
        <div style={{ width: '100%', maxWidth: '440px' }}>
          {children}
        </div>
      </div>
    </div>
  );
}

// ─── UI Components ────────────────────────────────────────────────────────────

function AlertBox({ type, children }: { type: 'error' | 'success', children: React.ReactNode }) {
  const isError = type === 'error';
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '10px',
      padding: '12px 16px', borderRadius: '6px',
      background: isError ? 'var(--cs-error-bg)' : 'var(--cs-success-bg)',
      border: `1px solid ${isError ? 'var(--cs-error-border)' : 'var(--cs-success-border)'}`,
      color: isError ? 'var(--cs-error)' : 'var(--cs-success)',
      fontSize: '13px', fontWeight: 500, lineHeight: 1.5,
    }}>
      {isError ? <AlertCircle size={16} style={{ flexShrink: 0 }} /> : <CheckCircle2 size={16} style={{ flexShrink: 0 }} />}
      <div>{children}</div>
    </div>
  );
}

interface FormFieldProps {
  id: string;
  label: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  error?: string;
  placeholder?: string;
  autoComplete?: string;
  disabled?: boolean;
}

function FormField({ id, label, type = 'text', value, onChange, onBlur, error, placeholder, autoComplete, disabled }: FormFieldProps) {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === 'password';
  const inputType = isPassword ? (showPassword ? 'text' : 'password') : type;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <label htmlFor={id} style={{ fontSize: '11px', fontWeight: 700, color: 'var(--cs-navy)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}
      </label>
      <div style={{ position: 'relative' }}>
        <input
          id={id}
          type={inputType}
          value={value}
          onChange={e => onChange(e.target.value)}
          onBlur={onBlur}
          placeholder={placeholder}
          autoComplete={autoComplete}
          disabled={disabled}
          className={`cs-input ${error ? 'cs-input-error' : ''}`}
          style={{ width: '100%', paddingRight: isPassword ? '40px' : '12px' }}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            tabIndex={-1}
            style={{
              position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
              background: 'none', border: 'none', color: 'var(--cs-subtle)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}
          >
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        )}
      </div>
      {error && <span style={{ fontSize: '12px', color: 'var(--cs-error)' }}>{error}</span>}
    </div>
  );
}

// ─── Login Form ───────────────────────────────────────────────────────────────

export function LoginForm() {
  const { signIn, loginAsDemo } = useAuth();
  const navigate = useNavigate();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState('');
  
  const [touchedEmail, setTouchedEmail] = useState(false);
  const [touchedPassword, setTouchedPassword] = useState(false);

  // Validation
  const emailError = touchedEmail && !email ? 'Enter your email address' : 
                     touchedEmail && !/\S+@\S+\.\S+/.test(email) ? 'Enter a valid email address' : '';
  const passwordError = touchedPassword && !password ? 'Enter your password' : '';
  const isValid = email && password && !emailError && !passwordError;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouchedEmail(true);
    setTouchedPassword(true);
    if (!isValid) return;

    setLoading(true);
    setServerError('');
    try {
      await signIn(email, password);
      navigate('/connections');
    } catch (err: any) {
      setServerError(err.message);
      setLoading(false);
    }
  };

  const handleDemoClick = () => {
    loginAsDemo(email || 'demo@corestack.io');
    navigate('/connections');
  };

  return (
    <AuthLayout>
      <div style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--cs-navy)', marginBottom: '8px' }}>Welcome back</h2>
        <p style={{ fontSize: '14px', color: 'var(--cs-muted)' }}>Sign in to your account to continue.</p>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }} noValidate>
        <FormField 
          id="email" 
          label="Work email" 
          type="email" 
          value={email} 
          onChange={setEmail} 
          onBlur={() => setTouchedEmail(true)}
          error={emailError}
          placeholder="you@company.com" 
          autoComplete="email" 
          disabled={loading} 
        />
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <FormField 
            id="password" 
            label="Password" 
            type="password" 
            value={password} 
            onChange={setPassword} 
            onBlur={() => setTouchedPassword(true)}
            error={passwordError}
            placeholder="Enter your password" 
            autoComplete="current-password" 
            disabled={loading} 
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '-2px' }}>
            <Link to="/forgot-password" style={{ fontSize: '12px', color: 'var(--cs-blue)', textDecoration: 'none', fontWeight: 500 }}>
              Forgot password?
            </Link>
          </div>
        </div>

        {serverError && <AlertBox type="error">{serverError}</AlertBox>}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '8px' }}>
          <button
            type="submit"
            disabled={!isValid || loading}
            className={`cs-btn cs-btn-primary ${loading ? 'is-loading' : ''}`}
            style={{ width: '100%', height: '44px', fontSize: '15px' }}
          >
            {loading ? <><div className="cs-spinner" style={{ width: '16px', height: '16px' }} /> Signing in…</> : 'Sign In'}
          </button>
          
          <button
            type="button"
            onClick={handleDemoClick}
            className="cs-btn"
            style={{ width: '100%', height: '40px', fontSize: '13px', background: 'var(--cs-bg-subtle)', border: '1px solid var(--cs-border)', color: 'var(--cs-navy)', justifyContent: 'center' }}
          >
            ⚡ Continue in Demo Mode (Skip Auth)
          </button>
        </div>
      </form>

      <p style={{ textAlign: 'center', marginTop: '24px', fontSize: '14px', color: 'var(--cs-muted)' }}>
        Don't have an account? <Link to="/signup" style={{ color: 'var(--cs-blue)', fontWeight: 600, textDecoration: 'none' }}>Create account</Link>
      </p>
    </AuthLayout>
  );
}

// ─── Signup Form ──────────────────────────────────────────────────────────────

export function SignupForm() {
  const { signUp, loginAsDemo } = useAuth();
  const navigate = useNavigate();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState('');
  
  const [touchedEmail, setTouchedEmail] = useState(false);
  const [touchedConfirm, setTouchedConfirm] = useState(false);

  const [successState, setSuccessState] = useState(false);

  const emailError = touchedEmail && !email ? 'Enter your email address' : 
                     touchedEmail && !/\S+@\S+\.\S+/.test(email) ? 'Enter a valid email address' : '';
  const confirmError = touchedConfirm && confirmPassword !== password ? 'Passwords don\'t match.' : '';

  const hasLength = password.length >= 8;
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const isPasswordValid = hasLength && hasUpper && hasLower && hasNumber;

  const isValid = email && !emailError && isPasswordValid && confirmPassword === password;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouchedEmail(true);
    setTouchedConfirm(true);
    if (!isValid) return;

    setLoading(true);
    setServerError('');
    try {
      const { requiresConfirmation } = await signUp(email, password);
      if (requiresConfirmation) {
        setSuccessState(true);
      } else {
        navigate('/connections');
      }
    } catch (err: any) {
      setServerError(err.message);
      setLoading(false);
    }
  };

  const handleDemoClick = () => {
    loginAsDemo(email || 'musharraf@corestack.io');
    navigate('/connections');
  };

  if (successState) {
    return (
      <AuthLayout>
        <div style={{ textAlign: 'center' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '48px', height: '48px', borderRadius: '50%', background: 'var(--cs-success-bg)', color: 'var(--cs-success)', marginBottom: '24px' }}>
            <CheckCircle2 size={24} />
          </div>
          <h2 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--cs-navy)', marginBottom: '12px' }}>Check your email</h2>
          <p style={{ fontSize: '15px', color: 'var(--cs-muted)', lineHeight: 1.6, marginBottom: '24px' }}>
            We've sent a verification link to:<br/>
            <strong style={{ color: 'var(--cs-navy)' }}>{email}</strong>
          </p>
          <p style={{ fontSize: '14px', color: 'var(--cs-muted)', marginBottom: '32px' }}>
            Click the link in the email to verify your account.
          </p>
          <Link to="/login" className="cs-btn" style={{ width: '100%', background: 'var(--cs-bg-subtle)', borderColor: 'var(--cs-border)', color: 'var(--cs-navy)' }}>
            Back to sign in
          </Link>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <div style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--cs-navy)', marginBottom: '8px' }}>Create your account</h2>
        <p style={{ fontSize: '14px', color: 'var(--cs-muted)' }}>Get started with AI governance for your cloud providers.</p>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }} noValidate>
        <FormField 
          id="signup-email" 
          label="Work email" 
          type="email" 
          value={email} 
          onChange={setEmail} 
          onBlur={() => setTouchedEmail(true)}
          error={emailError}
          placeholder="you@company.com" 
          disabled={loading} 
        />
        
        <div>
          <FormField 
            id="signup-password" 
            label="Password" 
            type="password" 
            value={password} 
            onChange={setPassword} 
            placeholder="Create a password" 
            disabled={loading} 
          />
          {password && !isPasswordValid && (
            <div style={{ background: 'var(--cs-bg-subtle)', padding: '12px', borderRadius: '6px', marginTop: '8px' }}>
              <p style={{ fontSize: '11px', fontWeight: 600, color: 'var(--cs-navy)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Password must contain:
              </p>
              <ul style={{ listStyle: 'none', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                {[
                  { label: '8+ characters', met: hasLength },
                  { label: 'Uppercase letter', met: hasUpper },
                  { label: 'Lowercase letter', met: hasLower },
                  { label: 'Number', met: hasNumber },
                ].map((req, i) => (
                  <li key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: req.met ? 'var(--cs-success)' : 'var(--cs-muted)' }}>
                    <Check size={12} style={{ opacity: req.met ? 1 : 0.3 }} /> {req.label}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <FormField 
          id="signup-confirm" 
          label="Confirm Password" 
          type="password" 
          value={confirmPassword} 
          onChange={setConfirmPassword} 
          onBlur={() => setTouchedConfirm(true)}
          error={confirmError}
          placeholder="Confirm your password" 
          disabled={loading} 
        />

        {serverError && <AlertBox type="error">{serverError}</AlertBox>}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '8px' }}>
          <button
            type="submit"
            disabled={!isValid || loading}
            className={`cs-btn cs-btn-primary ${loading ? 'is-loading' : ''}`}
            style={{ width: '100%', height: '44px', fontSize: '15px' }}
          >
            {loading ? <><div className="cs-spinner" style={{ width: '16px', height: '16px' }} /> Creating account…</> : 'Create account'}
          </button>

          <button
            type="button"
            onClick={handleDemoClick}
            className="cs-btn"
            style={{ width: '100%', height: '40px', fontSize: '13px', background: 'var(--cs-bg-subtle)', border: '1px solid var(--cs-border)', color: 'var(--cs-navy)', justifyContent: 'center' }}
          >
            ⚡ Continue in Demo Mode (Skip Auth)
          </button>
        </div>
      </form>

      <p style={{ textAlign: 'center', marginTop: '24px', fontSize: '14px', color: 'var(--cs-muted)' }}>
        Already have an account? <Link to="/login" style={{ color: 'var(--cs-blue)', fontWeight: 600, textDecoration: 'none' }}>Sign in</Link>
      </p>
    </AuthLayout>
  );
}

// ─── Forgot Password ──────────────────────────────────────────────────────────

export function ForgotPasswordForm() {
  const { forgotPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState('');
  const [success, setSuccess] = useState(false);
  
  const [touchedEmail, setTouchedEmail] = useState(false);
  const emailError = touchedEmail && !email ? 'Enter your email address' : 
                     touchedEmail && !/\S+@\S+\.\S+/.test(email) ? 'Enter a valid email address' : '';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouchedEmail(true);
    if (!email || emailError) return;

    setLoading(true);
    setServerError('');
    try {
      await forgotPassword(email);
      setSuccess(true);
    } catch (err: any) {
      setServerError(err.message);
      setLoading(false);
    }
  };

  if (success) {
    return (
      <AuthLayout>
        <div style={{ textAlign: 'center' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '48px', height: '48px', borderRadius: '50%', background: 'var(--cs-success-bg)', color: 'var(--cs-success)', marginBottom: '24px' }}>
            <CheckCircle2 size={24} />
          </div>
          <h2 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--cs-navy)', marginBottom: '12px' }}>Check your email</h2>
          <p style={{ fontSize: '15px', color: 'var(--cs-muted)', lineHeight: 1.6, marginBottom: '32px' }}>
            We sent a password reset link to <strong style={{ color: 'var(--cs-navy)' }}>{email}</strong>.
          </p>
          <Link to="/login" className="cs-btn" style={{ width: '100%', background: 'var(--cs-bg-subtle)', borderColor: 'var(--cs-border)', color: 'var(--cs-navy)' }}>
            Back to sign in
          </Link>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <div style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--cs-navy)', marginBottom: '8px' }}>Reset your password</h2>
        <p style={{ fontSize: '14px', color: 'var(--cs-muted)' }}>Enter your work email and we'll send you a password reset link.</p>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }} noValidate>
        <FormField 
          id="forgot-email" 
          label="Work email" 
          type="email" 
          value={email} 
          onChange={setEmail} 
          onBlur={() => setTouchedEmail(true)}
          error={emailError}
          placeholder="you@company.com" 
          disabled={loading} 
        />
        
        {serverError && <AlertBox type="error">{serverError}</AlertBox>}

        <button
          type="submit"
          disabled={!email || !!emailError || loading}
          className={`cs-btn cs-btn-primary ${loading ? 'is-loading' : ''}`}
          style={{ width: '100%', height: '44px', fontSize: '15px', marginTop: '8px' }}
        >
          {loading ? <><div className="cs-spinner" style={{ width: '16px', height: '16px' }} /> Sending…</> : 'Send reset link'}
        </button>
      </form>

      <p style={{ textAlign: 'center', marginTop: '24px', fontSize: '14px' }}>
        <Link to="/login" style={{ color: 'var(--cs-muted)', fontWeight: 500, textDecoration: 'none' }}>Back to sign in</Link>
      </p>
    </AuthLayout>
  );
}

// ─── Reset Password ───────────────────────────────────────────────────────────

export function ResetPasswordForm() {
  const { updatePassword } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState('');
  const [success, setSuccess] = useState(false);
  
  const [touchedConfirm, setTouchedConfirm] = useState(false);
  const confirmError = touchedConfirm && confirmPassword !== password ? 'Passwords don\'t match.' : '';

  const hasLength = password.length >= 8;
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const isPasswordValid = hasLength && hasUpper && hasLower && hasNumber;

  const isValid = password && isPasswordValid && confirmPassword === password;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouchedConfirm(true);
    if (!isValid) return;

    setLoading(true);
    setServerError('');
    try {
      await updatePassword(password);
      setSuccess(true);
    } catch (err: any) {
      setServerError(err.message);
      setLoading(false);
    }
  };

  if (success) {
    return (
      <AuthLayout>
        <div style={{ textAlign: 'center' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '48px', height: '48px', borderRadius: '50%', background: 'var(--cs-success-bg)', color: 'var(--cs-success)', marginBottom: '24px' }}>
            <CheckCircle2 size={24} />
          </div>
          <h2 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--cs-navy)', marginBottom: '12px' }}>Password updated</h2>
          <p style={{ fontSize: '15px', color: 'var(--cs-muted)', lineHeight: 1.6, marginBottom: '32px' }}>
            Your password has been updated successfully.
          </p>
          <Link to="/login" className="cs-btn cs-btn-primary" style={{ width: '100%' }}>
            Sign in
          </Link>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <div style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--cs-navy)', marginBottom: '8px' }}>Set a new password</h2>
        <p style={{ fontSize: '14px', color: 'var(--cs-muted)' }}>Enter your new password below.</p>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }} noValidate>
        <div>
          <FormField 
            id="reset-password" 
            label="New password" 
            type="password" 
            value={password} 
            onChange={setPassword} 
            placeholder="Create a new password" 
            disabled={loading} 
          />
          {password && !isPasswordValid && (
            <div style={{ background: 'var(--cs-bg-subtle)', padding: '12px', borderRadius: '6px', marginTop: '8px' }}>
              <p style={{ fontSize: '11px', fontWeight: 600, color: 'var(--cs-navy)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Password must contain:
              </p>
              <ul style={{ listStyle: 'none', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                {[
                  { label: '8+ characters', met: hasLength },
                  { label: 'Uppercase letter', met: hasUpper },
                  { label: 'Lowercase letter', met: hasLower },
                  { label: 'Number', met: hasNumber },
                ].map((req, i) => (
                  <li key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: req.met ? 'var(--cs-success)' : 'var(--cs-muted)' }}>
                    <Check size={12} style={{ opacity: req.met ? 1 : 0.3 }} /> {req.label}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <FormField 
          id="reset-confirm" 
          label="Confirm password" 
          type="password" 
          value={confirmPassword} 
          onChange={setConfirmPassword} 
          onBlur={() => setTouchedConfirm(true)}
          error={confirmError}
          placeholder="Confirm your new password" 
          disabled={loading} 
        />
        
        {serverError && <AlertBox type="error">{serverError}</AlertBox>}

        <button
          type="submit"
          disabled={!isValid || loading}
          className={`cs-btn cs-btn-primary ${loading ? 'is-loading' : ''}`}
          style={{ width: '100%', height: '44px', fontSize: '15px', marginTop: '8px' }}
        >
          {loading ? <><div className="cs-spinner" style={{ width: '16px', height: '16px' }} /> Updating…</> : 'Update password'}
        </button>
      </form>
    </AuthLayout>
  );
}
