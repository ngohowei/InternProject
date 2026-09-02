import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Wrench, Mail, Key, ArrowRight, ShieldCheck, HardHat, User, CheckCircle2, AlertTriangle, KeyRound } from 'lucide-react';
import { ChangePasswordModal } from './ChangePasswordModal';

export const LoginPage = () => {
  const { login, accounts } = useApp();
  const [emailOrPhone, setEmailOrPhone] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [showPassModal, setShowPassModal] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    const res = await login(emailOrPhone, password);
    if (!res || !res.success) {
      setErrorMsg('Invalid email/phone or password. Please check your credentials.');
    }
  };

  const handleQuickLogin = async (email, pass) => {
    setEmailOrPhone(email);
    setPassword(pass);
    await login(email, pass);
  };

  return (
    <div style={{
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
      <div style={{ textAlign: 'center', marginBottom: '2.5rem', maxWidth: '600px' }}>
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
        <h1 style={{ fontSize: '2.4rem', fontWeight: 800, background: 'linear-gradient(to right, #ffffff, #93c5fd)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          Welpack Engineering
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '1rem', marginTop: '6px' }}>
          On-Site Field Engineering Dispatch, Work Log & Automated Billing Hub
        </p>
      </div>

      {/* Main Login Box */}
      <div className="card" style={{ maxWidth: '480px', width: '100%', padding: '2.25rem', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)' }}>
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700 }}>Company Portal Login</h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            Enter your account email to automatically access your designated role portal (<strong>Admin</strong>, <strong>Staff Engineer</strong>, or <strong>Customer</strong>).
          </p>
        </div>

        {errorMsg && (
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
            {errorMsg}
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
                placeholder="e.g. admin@apex.com or alex@apex.com"
                value={emailOrPhone}
                onChange={e => setEmailOrPhone(e.target.value)}
                style={{ paddingLeft: '40px' }}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.375rem' }}>
              <label className="form-label" style={{ marginBottom: 0 }}>Password</label>
              <span
                style={{ color: 'var(--accent-cyan)', cursor: 'pointer', fontSize: '0.8rem' }}
                onClick={() => setShowPassModal(true)}
              >
                Change / Reset Password?
              </span>
            </div>
            <div style={{ position: 'relative' }}>
              <Key size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input
                type="password"
                className="input"
                placeholder="Enter password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                style={{ paddingLeft: '40px' }}
                required
              />
            </div>
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '0.8rem', fontSize: '0.95rem', marginTop: '0.5rem' }}>
            Sign In to Portal <ArrowRight size={18} />
          </button>
        </form>

        {/* Quick Demo Login Buttons */}
        <div style={{ marginTop: '2rem', paddingTop: '1.25rem', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.05em', marginBottom: '10px', textAlign: 'center' }}>
            ⚡ 1-Click Role Login Shortcuts:
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              style={{ justifyContent: 'flex-start', padding: '0.625rem 1rem' }}
              onClick={() => handleQuickLogin('admin@apex.com', 'admin123')}
            >
              <ShieldCheck size={16} className="text-cyan" />
              <span>Login as <strong>ADMIN</strong> (admin@apex.com)</span>
            </button>

            <button
              type="button"
              className="btn btn-secondary btn-sm"
              style={{ justifyContent: 'flex-start', padding: '0.625rem 1rem' }}
              onClick={() => handleQuickLogin('alex@apex.com', 'staff123')}
            >
              <HardHat size={16} className="text-amber" />
              <span>Login as <strong>STAFF ENGINEER</strong> (alex@apex.com)</span>
            </button>

            <button
              type="button"
              className="btn btn-secondary btn-sm"
              style={{ justifyContent: 'flex-start', padding: '0.625rem 1rem' }}
              onClick={() => handleQuickLogin('dmiller@acmesemi.com', 'cust123')}
            >
              <User size={16} className="text-emerald" />
              <span>Login as <strong>CUSTOMER</strong> (dmiller@acmesemi.com)</span>
            </button>
          </div>
        </div>
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
