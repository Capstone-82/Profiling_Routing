import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { LogOut, ChevronDown, Cpu } from 'lucide-react';

interface AppHeaderProps {
  activePath: string;
}

function CoreStackLogo() {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <path d="M16 2L25 7.5V17L16 22.5L7 17V7.5L16 2Z" fill="#E8334A" opacity="0.9"/>
      <path d="M16 2L25 7.5V12L16 17.5L7 12V7.5L16 2Z" fill="#F5A623" opacity="0.9"/>
      <path d="M16 7.5L22.5 11.2V17.3L16 21L9.5 17.3V11.2L16 7.5Z" fill="#0072CE"/>
      <path d="M16 11.5L20 13.8V18.2L16 20.5L12 18.2V13.8L16 11.5Z" fill="#fff" opacity="0.85"/>
    </svg>
  );
}

export function AppHeader({ activePath }: AppHeaderProps) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = React.useState(false);

  const handleSignOut = async () => {
    setMenuOpen(false);
    await signOut();
    navigate('/login');
  };

  const navLinks = [
    { to: '/connections', label: 'Connections' },
    { to: '/playground', label: 'AI Playground' },
  ];

  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        background: '#fff',
        borderBottom: '1px solid #D5E2EE',
        boxShadow: '0 1px 3px rgba(19,38,63,0.06)',
      }}
      role="banner"
    >
      <div
        style={{
          maxWidth: '1280px',
          margin: '0 auto',
          padding: '0 24px',
          height: '64px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '24px',
        }}
      >
        {/* Brand lockup */}
        <Link
          to={user ? '/connections' : '/login'}
          style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none', flexShrink: 0 }}
          aria-label="CoreStack AI Governance OS — home"
        >
          <CoreStackLogo />
          <div style={{ lineHeight: 1 }}>
            <div style={{ fontSize: '16px', fontWeight: 800, color: '#13263F', letterSpacing: '-0.2px' }}>
              CORESTACK
            </div>
            <div style={{ fontSize: '9px', fontWeight: 700, color: '#0072CE', letterSpacing: '0.08em', textTransform: 'uppercase', marginTop: '2px' }}>
              AI Governance OS
            </div>
          </div>
        </Link>

        {/* Nav links — only when authenticated */}
        {user && (
          <nav style={{ display: 'flex', alignItems: 'center', gap: '2px', flex: 1 }} role="navigation" aria-label="Main navigation">
            {navLinks.map(({ to, label }) => {
              const isActive = activePath.startsWith(to);
              return (
                <Link
                  key={to}
                  to={to}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '6px',
                    fontSize: '14px',
                    fontWeight: isActive ? 600 : 500,
                    color: isActive ? '#0072CE' : '#5A7184',
                    background: isActive ? '#EBF4FD' : 'transparent',
                    textDecoration: 'none',
                    transition: 'all 0.15s',
                    whiteSpace: 'nowrap',
                  }}
                  aria-current={isActive ? 'page' : undefined}
                >
                  {label}
                </Link>
              );
            })}
          </nav>
        )}

        {/* Right slot */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
          {user ? (
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setMenuOpen(v => !v)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  padding: '6px 10px 6px 6px',
                  border: '1px solid #D5E2EE',
                  borderRadius: '8px',
                  background: menuOpen ? '#EBF4FD' : '#fff',
                  cursor: 'pointer',
                  fontSize: '13px',
                  color: '#2B3F57',
                  fontWeight: 500,
                  transition: 'all 0.15s',
                }}
                aria-expanded={menuOpen}
                aria-haspopup="true"
                aria-label="User menu"
                id="user-menu-trigger"
              >
                <div style={{
                  width: '28px', height: '28px', borderRadius: '50%',
                  background: '#0072CE', color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '11px', fontWeight: 700, flexShrink: 0,
                }}>
                  {user.email.charAt(0).toUpperCase()}
                </div>
                <span style={{ maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {user.email}
                </span>
                <ChevronDown size={14} style={{ color: '#8FA3B4', transition: 'transform 0.15s', transform: menuOpen ? 'rotate(180deg)' : 'none', flexShrink: 0 }} />
              </button>

              {menuOpen && (
                <>
                  <div style={{ position: 'fixed', inset: 0, zIndex: 10 }} onClick={() => setMenuOpen(false)} aria-hidden />
                  <div
                    style={{
                      position: 'absolute', right: 0, top: 'calc(100% + 6px)',
                      minWidth: '220px',
                      background: '#fff',
                      border: '1px solid #D5E2EE',
                      borderRadius: '10px',
                      boxShadow: '0 8px 24px rgba(19,38,63,0.13)',
                      zIndex: 20,
                      overflow: 'hidden',
                    }}
                    role="menu"
                    aria-labelledby="user-menu-trigger"
                  >
                    <div style={{ padding: '12px 16px', borderBottom: '1px solid #E8EFF7' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '34px', height: '34px', borderRadius: '50%', background: '#0072CE', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 700, flexShrink: 0 }}>
                          {user.email.charAt(0).toUpperCase()}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: '13px', fontWeight: 600, color: '#13263F', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {user.email}
                          </div>
                          <div style={{ fontSize: '10px', color: '#8FA3B4', fontFamily: 'monospace', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {user.id.substring(0, 20)}…
                          </div>
                        </div>
                      </div>
                    </div>
                    <div style={{ padding: '4px' }}>
                      <Link
                        to="/connections"
                        onClick={() => setMenuOpen(false)}
                        style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 12px', borderRadius: '6px', color: '#2B3F57', fontSize: '13px', fontWeight: 500, textDecoration: 'none', transition: 'background 0.1s' }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#F4F7FB')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                        role="menuitem"
                      >
                        <Cpu size={14} style={{ color: '#0072CE' }} />
                        Connections
                      </Link>
                      <button
                        onClick={handleSignOut}
                        style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '9px 12px', borderRadius: '6px', color: '#B91C1C', fontSize: '13px', fontWeight: 500, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', transition: 'background 0.1s' }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#FEF2F2')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                        role="menuitem"
                      >
                        <LogOut size={14} />
                        Sign out
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Link to="/login" style={{ fontSize: '14px', fontWeight: 500, color: '#5A7184', textDecoration: 'none', padding: '8px 12px' }}>
                Sign In
              </Link>
              <Link
                to="/signup"
                className="cs-btn cs-btn-primary cs-btn-pill"
                style={{ height: '36px', padding: '0 18px', fontSize: '13px', textDecoration: 'none' }}
              >
                Get Started
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
