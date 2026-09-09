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
    resetDemo
  } = useApp();

  const [showPassModal, setShowPassModal] = useState(false);

  const unassignedCount = requests.filter(r => r.status === 'Pending').length;
  const unbilledCount = requests.filter(
    r => (r.status === 'Completed' || r.status === 'Billed') && r.billing?.billingStatus === 'Unbilled'
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
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

            {currentRole === 'admin' && (
              <button
                className="btn btn-secondary btn-sm"
                onClick={resetDemo}
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
    </>
  );
};
