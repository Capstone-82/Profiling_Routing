import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { CoreStackLogo } from '../common/Logo';
import { LogOut, ChevronDown, Cpu, Search, ShieldCheck } from 'lucide-react';

interface AppHeaderProps {
  activePath: string;
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
    { to: '/governance', label: 'AI Governance' },
    { to: '/models', label: 'Model Registry' },
  ];


  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        background: '#FFFFFF',
        borderBottom: '1.5px solid #D5E3F5',
        boxShadow: '0 2px 8px rgba(19, 38, 63, 0.05)',
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
          style={{ textDecoration: 'none', display: 'flex', alignItems: 'center' }}
          aria-label="CoreStack AI Governance OS"
        >
          <CoreStackLogo size="md" />
        </Link>

        {/* Nav links — active pill style */}
        {user && (
          <nav style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1, marginLeft: '12px' }} role="navigation" aria-label="Main navigation">
            {navLinks.map(({ to, label }) => {
              const isActive = activePath.startsWith(to);
              return (
                <Link
                  key={to}
                  to={to}
                  style={{
                    padding: '8px 18px',
                    borderRadius: '999px', // Pill shape for nav items
                    fontSize: '14px',
                    fontWeight: isActive ? 700 : 600,
                    color: isActive ? '#0072CE' : '#2B3F57',
                    background: isActive ? '#EBF4FD' : 'transparent',
                    textDecoration: 'none',
                    transition: 'all 0.15s ease',
                    whiteSpace: 'nowrap',
                  }}
                  onMouseEnter={e => {
                    if (!isActive) {
                      e.currentTarget.style.color = '#0072CE';
                      e.currentTarget.style.background = '#F4F7FB';
                    }
                  }}
                  onMouseLeave={e => {
                    if (!isActive) {
                      e.currentTarget.style.color = '#2B3F57';
                      e.currentTarget.style.background = 'transparent';
                    }
                  }}
                  aria-current={isActive ? 'page' : undefined}
                >
                  {label}
                </Link>
              );
            })}
          </nav>
        )}

        {/* Right slot — search icon + profile dropdown */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
          {user ? (
            <>
              {/* Search button icon */}
              <button
                type="button"
                style={{
                  width: '36px', height: '36px', borderRadius: '50%',
                  border: '1.5px solid #D5E3F5', background: '#FFFFFF',
                  color: '#2B3F57', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', transition: 'all 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = '#0072CE'; e.currentTarget.style.color = '#0072CE'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = '#D5E3F5'; e.currentTarget.style.color = '#2B3F57'; }}
                aria-label="Search"
              >
                <Search size={16} />
              </button>

              {/* User menu trigger */}
              <div style={{ position: 'relative' }}>
                <button
                  onClick={() => setMenuOpen(v => !v)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    padding: '6px 12px 6px 6px',
                    border: '1.5px solid #D5E3F5',
                    borderRadius: '999px',
                    background: menuOpen ? '#EBF4FD' : '#FFFFFF',
                    cursor: 'pointer',
                    fontSize: '13px',
                    color: '#13263F',
                    fontWeight: 600,
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => { if (!menuOpen) e.currentTarget.style.borderColor = '#0072CE'; }}
                  onMouseLeave={e => { if (!menuOpen) e.currentTarget.style.borderColor = '#D5E3F5'; }}
                  aria-expanded={menuOpen}
                  aria-haspopup="true"
                  aria-label="User menu"
                  id="user-menu-trigger"
                >
                  <div style={{
                    width: '28px', height: '28px', borderRadius: '50%',
                    background: '#0072CE', color: '#FFFFFF',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '12px', fontWeight: 800, flexShrink: 0,
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
                      className="cs-dropdown-anim"
                      style={{
                        position: 'absolute', right: 0, top: 'calc(100% + 8px)',
                        minWidth: '220px',
                        background: '#FFFFFF',
                        border: '1.5px solid #D5E3F5',
                        borderRadius: '10px',
                        boxShadow: '0 8px 24px rgba(19, 38, 63, 0.12)',
                        zIndex: 20,
                        overflow: 'hidden',
                      }}
                      role="menu"
                      aria-labelledby="user-menu-trigger"
                    >
                      <div style={{ padding: '12px 16px', borderBottom: '1px solid #E8EFF7' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{ width: '34px', height: '34px', borderRadius: '50%', background: '#0072CE', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 800, flexShrink: 0 }}>
                            {user.email.charAt(0).toUpperCase()}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: '13px', fontWeight: 700, color: '#13263F', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {user.email}
                            </div>
                            <div style={{ fontSize: '10px', color: '#8FA3B4', fontFamily: 'monospace', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {user.id.substring(0, 20)}…
                            </div>
                          </div>
                        </div>
                      </div>
                      <div style={{ padding: '6px' }}>
                        <Link
                          to="/connections"
                          onClick={() => setMenuOpen(false)}
                          style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 12px', borderRadius: '6px', color: '#2B3F57', fontSize: '13px', fontWeight: 600, textDecoration: 'none', transition: 'background 0.1s' }}
                          onMouseEnter={e => (e.currentTarget.style.background = '#EBF4FD')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                          role="menuitem"
                        >
                          <Cpu size={15} style={{ color: '#0072CE' }} />
                          Connections
                        </Link>
                        <Link
                          to="/governance"
                          onClick={() => setMenuOpen(false)}
                          style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 12px', borderRadius: '6px', color: '#2B3F57', fontSize: '13px', fontWeight: 600, textDecoration: 'none', transition: 'background 0.1s' }}
                          onMouseEnter={e => (e.currentTarget.style.background = '#EBF4FD')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                          role="menuitem"
                        >
                          <ShieldCheck size={15} style={{ color: '#0072CE' }} />
                          AI Governance
                        </Link>
                        <button
                          onClick={handleSignOut}
                          style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '9px 12px', borderRadius: '6px', color: '#DC2626', fontSize: '13px', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', transition: 'background 0.1s' }}
                          onMouseEnter={e => (e.currentTarget.style.background = '#FEE2E2')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                          role="menuitem"
                        >
                          <LogOut size={15} />
                          Sign out
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Link to="/login" style={{ fontSize: '14px', fontWeight: 600, color: '#2B3F57', textDecoration: 'none', padding: '8px 14px' }}>
                Sign In
              </Link>
              <Link
                to="/signup"
                className="cs-btn cs-btn-primary"
                style={{ height: '38px', padding: '0 20px', fontSize: '13px', textDecoration: 'none' }}
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
