import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Wrench, Lock, Mail, Key, ShieldCheck, User, HardHat, ArrowRight, KeyRound } from 'lucide-react';

export const LoginModal = ({ isOpen, onClose, onOpenPasswordReset }) => {
  const { login, accounts } = useApp();
  const [emailOrPhone, setEmailOrPhone] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    const res = await login(emailOrPhone, password);
    if (res && res.success) {
      onClose();
    } else {
      setErrorMsg('Invalid email/phone or password. Please try again.');
    }
  };

  const handleQuickLogin = async (email, pass) => {
    setEmailOrPhone(email);
    setPassword(pass);
    const res = await login(email, pass);
    if (res && res.success) {
      onClose();
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '520px' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header" style={{ borderBottom: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-cyan))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white'
            }}>
              <Wrench size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.2rem' }}>Sign In to Welpack Engineering</h3>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Field Engineering Dispatch & Billing Hub
              </span>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {errorMsg && (
              <div style={{
                backgroundColor: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid #ef4444',
                color: '#fca5a5',
                padding: '10px 14px',
                borderRadius: '8px',
                fontSize: '0.85rem',
                marginBottom: '1rem'
              }}>
                {errorMsg}
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Email Address or Phone Number</label>
              <div style={{ position: 'relative' }}>
                <Mail size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                <input 
                  type="text"
                  className="input"
                  placeholder="e.g. admin@apex.com or dmiller@acmesemi.com"
                  value={emailOrPhone}
                  onChange={e => setEmailOrPhone(e.target.value)}
                  style={{ paddingLeft: '38px' }}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                Password
                <span 
                  style={{ color: 'var(--accent-cyan)', cursor: 'pointer', fontSize: '0.8rem' }}
                  onClick={() => {
                    onClose();
                    onOpenPasswordReset();
                  }}
                >
                  Forgot / Change Password?
                </span>
              </label>
              <div style={{ position: 'relative' }}>
                <Key size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                <input 
                  type="password"
                  className="input"
                  placeholder="Enter account password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  style={{ paddingLeft: '38px' }}
                  required
                />
              </div>
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '0.5rem', padding: '0.75rem' }}>
              Sign In <ArrowRight size={16} />
            </button>

            {/* Quick Demo Sign In Shortcut Bar */}
            <div style={{ marginTop: '1.75rem', paddingTop: '1.25rem', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '8px' }}>
                ⚡ Quick Demo One-Click Logins:
              </span>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <button 
                  type="button" 
                  className="btn btn-secondary btn-sm"
                  style={{ justifyContent: 'flex-start' }}
                  onClick={() => handleQuickLogin('admin@apex.com', 'admin123')}
                >
                  <ShieldCheck size={14} className="text-cyan" /> 
                  Login as Admin Manager (admin@apex.com)
                </button>

                <button 
                  type="button" 
                  className="btn btn-secondary btn-sm"
                  style={{ justifyContent: 'flex-start' }}
                  onClick={() => handleQuickLogin('alex@apex.com', 'staff123')}
                >
                  <HardHat size={14} className="text-amber" /> 
                  Login as Senior Engineer Alex Wong (alex@apex.com)
                </button>

                <button 
                  type="button" 
                  className="btn btn-secondary btn-sm"
                  style={{ justifyContent: 'flex-start' }}
                  onClick={() => handleQuickLogin('dmiller@acmesemi.com', 'cust123')}
                >
                  <User size={14} className="text-emerald" /> 
                  Login as Customer Acme Mfg (dmiller@acmesemi.com)
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
