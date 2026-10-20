import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Wrench, Mail, Key, ArrowRight, ShieldCheck, HardHat, User, CheckCircle2, AlertTriangle, KeyRound, Eye, EyeOff } from 'lucide-react';
import { ChangePasswordModal } from './ChangePasswordModal';

const DEMO_ICONS = {
  admin: { icon: ShieldCheck, color: 'text-cyan' },
  engineer: { icon: HardHat, color: 'text-amber' },
  customer: { icon: User, color: 'text-emerald' }
};

export const LoginPage = () => {
  const { login, authNotice, demoMode, demoLogins } = useApp();
  const [emailOrPhone, setEmailOrPhone] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [showPassModal, setShowPassModal] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    const res = await login(emailOrPhone, password);
    if (!res || !res.success) {
      setErrorMsg(res?.error || 'Unable to sign in. Please try again.');
    }
  };

  const handleQuickLogin = async (email, pass) => {
    setEmailOrPhone(email);
    setPassword(pass);
    setErrorMsg('');
    const res = await login(email, pass);
    if (!res || !res.success) {
      setErrorMsg(res?.error || 'Unable to sign in. Please try again.');
    }
  };

  return (
    <div className="login-page" style={{
      minHeight: '100vh',
      backgroundColor: 'var(--bg-primary)',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      padding: '2rem 1.5rem',
      position: 'relative',
      backgroundImage: 'radial-gradient(circle at 50% 20%, rgba(59, 130, 246, 0.12) 0%, transparent 60%)'
    }}>
      {/* Company Branding Banner */}
      <div className="login-brand" style={{ textAlign: 'center', marginBottom: '2.5rem', maxWidth: '600px' }}>
        <div style={{
          width: '64px',
          height: '64px',
          borderRadius: '16px',
          background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-cyan))',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          boxShadow: 'var(--shadow-glow)',
          marginBottom: '1rem'
        }}>
          <Wrench size={34} />
        </div>
        <h1 className="login-title" style={{ fontSize: '2.4rem', fontWeight: 800, background: 'linear-gradient(to right, #ffffff, #93c5fd)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          Welpack Engineering
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '1rem', marginTop: '6px' }}>
          On-Site Field Engineering Dispatch, Work Log & Automated Billing Hub
        </p>
      </div>

      {/* Main Login Box */}
      <div className="card login-card" style={{ maxWidth: '480px', width: '100%', padding: '2.25rem', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)' }}>
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700 }}>Company Portal Login</h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            Enter your account email to automatically access your designated role portal (<strong>Admin</strong>, <strong>Staff Engineer</strong>, or <strong>Customer</strong>).
          </p>
        </div>

        {(errorMsg || authNotice) && (
          <div style={{
            backgroundColor: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid #ef4444',
            color: '#fca5a5',
            padding: '10px 14px',
            borderRadius: '8px',
            fontSize: '0.85rem',
            marginBottom: '1.25rem'
          }}>
            <AlertTriangle size={14} style={{ display: 'inline', marginRight: '6px' }} />
            {errorMsg || authNotice}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Email Address or Phone Number</label>
            <div style={{ position: 'relative' }}>
              <Mail size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input
                type="text"
                className="input"
                placeholder={demoMode === true ? 'e.g. admin@welpack.com' : 'name@company.com'}
                inputMode="email"
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                value={emailOrPhone}
                onChange={e => setEmailOrPhone(e.target.value)}
                style={{ paddingLeft: '40px' }}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.375rem' }}>
              <label className="form-label" style={{ marginBottom: 0 }}>Password</label>
              <button type="button" className="link-btn" onClick={() => setShowPassModal(true)}>
                Change / Reset Password?
              </button>
            </div>
            <div style={{ position: 'relative' }}>
              <Key size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input
                type={showPassword ? 'text' : 'password'}
                className="input"
                placeholder="Enter password"
                autoComplete="current-password"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                value={password}
                onChange={e => setPassword(e.target.value)}
                style={{ paddingLeft: '40px', paddingRight: '48px' }}
                required
              />
              <button
                type="button"
                className="eye-btn"
                onClick={() => setShowPassword(v => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '0.8rem', fontSize: '0.95rem', marginTop: '0.5rem' }}>
            Sign In to Portal <ArrowRight size={18} />
          </button>
        </form>

        {/* Quick Demo Login Buttons - the server only sends these in demo mode, so a live site has none */}
        {demoMode === true && demoLogins.length > 0 && (
          <div style={{ marginTop: '2rem', paddingTop: '1.25rem', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.05em', marginBottom: '10px', textAlign: 'center' }}>
              ⚡ 1-Click Role Login Shortcuts:
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {demoLogins.map((d) => {
                const Icon = DEMO_ICONS[d.role]?.icon || User;
                return (
                  <button
                    key={d.email}
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{ justifyContent: 'flex-start', padding: '0.625rem 1rem' }}
                    onClick={() => handleQuickLogin(d.email, d.password)}
                  >
                    <Icon size={16} className={DEMO_ICONS[d.role]?.color || 'text-cyan'} />
                    <span>Login as <strong>{d.label}</strong> ({d.email})</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <footer style={{ marginTop: '3rem', color: 'var(--text-dim)', fontSize: '0.8rem', textAlign: 'center' }}>
        Welpack Engineering &bull; Company Engineering Dispatch & Billing System
      </footer>

      {/* Password Modal */}
      <ChangePasswordModal
        isOpen={showPassModal}
        onClose={() => setShowPassModal(false)}
      />
    </div>
  );
};
