import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  Wrench,
  User,
  ShieldCheck,
  HardHat,
  RotateCcw,
  LogOut,
  KeyRound,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import { ChangePasswordModal } from './ChangePasswordModal';

const ROLE_META = {
  customer: { icon: User, label: 'Customer Portal' },
  engineer: { icon: HardHat, label: 'Engineer Portal' },
  admin: { icon: ShieldCheck, label: 'Admin Operations Center' }
};

export const RoleHeader = () => {
  const {
    currentUser,
    currentRole,
    engineers,
    requests,
    notification,
    logout,
    resetDemo,
    demoMode
  } = useApp();

  const [showPassModal, setShowPassModal] = useState(false);

  // Reset Demo erases EVERYTHING, so it needs the user to type RESET first.
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetText, setResetText] = useState('');
  const [resetting, setResetting] = useState(false);
  const closeReset = () => { if (!resetting) { setShowResetConfirm(false); setResetText(''); } };
  const doReset = async (e) => {
    e.preventDefault();
    if (resetText !== 'RESET') return;
    setResetting(true);
    const ok = await resetDemo(resetText);
    setResetting(false);
    if (ok) { setShowResetConfirm(false); setResetText(''); }
  };

  const unassignedCount = requests.filter(r => r.status === 'Pending').length;
  const unbilledCount = requests.filter(
    r => r.status === 'Completed' && r.billing?.billingStatus === 'Unbilled'
  ).length;

  const meta = ROLE_META[currentRole] || ROLE_META.customer;
  const RoleIcon = meta.icon;
  const myEngineer = engineers.find(e => e.id === currentUser?.engineerId);

  return (
    <>
      <header className="top-header">
        <div className="header-inner">
          <div className="logo-brand">
            <div className="logo-icon">
              <Wrench size={22} />
            </div>
            <div className="logo-text">
              <h1>Welpack Engineering</h1>
              <span>Dispatch & Billing Hub</span>
            </div>
          </div>

          {/* Current role (fixed by the signed-in account) */}
          <div className="role-switcher-container">
            <span className="role-btn active" style={{ cursor: 'default' }}>
              <RoleIcon size={16} />
              {meta.label}
              {currentRole === 'admin' && (unassignedCount > 0 || unbilledCount > 0) && (
                <span className="role-badge" title="Pending action items">
                  {unassignedCount + unbilledCount}
                </span>
              )}
            </span>
          </div>

          {/* User / auth bar */}
          <div className="header-actions">
            <div style={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              padding: '4px 10px',
              borderRadius: '8px',
              fontSize: '0.8rem',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981' }} />
              <strong>{currentUser?.name}</strong>
              <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>({currentRole})</span>
            </div>

            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setShowPassModal(true)}
              title="Change your account password"
            >
              <KeyRound size={14} /> Password
            </button>

            <button className="btn btn-secondary btn-sm" onClick={logout} title="Log out">
              <LogOut size={14} /> Log Out
            </button>

            {currentRole === 'admin' && demoMode === true && (
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setShowResetConfirm(true)}
                title="Wipe all data and restore the initial demo state"
              >
                <RotateCcw size={14} /> Reset Demo
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Role notice banner */}
      <div className="role-notice-banner">
        <div className="role-info">
          {currentRole === 'customer' && (
            <>
              <User size={16} />
              <span>
                Customer Portal &bull; <strong>{currentUser?.customerName || currentUser?.name}</strong> ({currentUser?.email})
              </span>
            </>
          )}
          {currentRole === 'engineer' && (
            <>
              <HardHat size={16} />
              <span>
                Field Engineer: <strong>{myEngineer?.name || currentUser?.name}</strong>
                {myEngineer?.specialty ? ` • ${myEngineer.specialty}` : ''}
              </span>
            </>
          )}
          {currentRole === 'admin' && (
            <>
              <ShieldCheck size={16} />
              <span>
                Operations &amp; Billing Command Center &bull;
                <strong style={{ color: '#fbbf24', marginLeft: '6px' }}>{unassignedCount} Unassigned</strong>,
                <strong style={{ color: '#c084fc', marginLeft: '6px' }}>{unbilledCount} Unbilled Jobs</strong>
              </span>
            </>
          )}
        </div>

        {notification && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: notification.type === 'error' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)',
            border: `1px solid ${notification.type === 'error' ? '#ef4444' : '#10b981'}`,
            color: notification.type === 'error' ? '#fca5a5' : '#6ee7b7',
            padding: '4px 12px',
            borderRadius: '6px',
            fontSize: '0.8rem',
            animation: 'fadeIn 0.2s ease'
          }}>
            {notification.type === 'error' ? <AlertTriangle size={14} /> : <CheckCircle2 size={14} />}
            {notification.text}
          </div>
        )}
      </div>

      <ChangePasswordModal isOpen={showPassModal} onClose={() => setShowPassModal(false)} />

      {/* Reset Demo confirmation: erases everything, so make the user type RESET */}
      {showResetConfirm && (
        <div className="modal-overlay" onClick={closeReset}>
          <div className="modal-content" style={{ maxWidth: '480px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ color: '#f87171' }}>Erase ALL data?</h3>
              <button className="close-btn" onClick={closeReset} disabled={resetting}>✕</button>
            </div>
            <form onSubmit={doReset}>
              <div className="modal-body">
                <div style={{ backgroundColor: 'rgba(239,68,68,0.1)', borderLeft: '4px solid #ef4444', padding: '10px 14px', borderRadius: '6px', fontSize: '0.85rem', marginBottom: '1rem' }}>
                  This permanently deletes <strong>every ticket, account, engineer and catalog item</strong> and
                  puts the sample demo data back. Passwords go back to the demo defaults. This cannot be undone.
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="resetConfirmInput">Type <strong>RESET</strong> to confirm</label>
                  <input
                    id="resetConfirmInput"
                    type="text"
                    className="input font-mono"
                    value={resetText}
                    onChange={(e) => setResetText(e.target.value)}
                    autoComplete="off"
                    autoFocus
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={closeReset} disabled={resetting}>Cancel</button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ backgroundColor: '#dc2626', borderColor: '#dc2626' }}
                  disabled={resetText !== 'RESET' || resetting}
                >
                  {resetting ? 'Erasing…' : 'Erase everything and reset'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
