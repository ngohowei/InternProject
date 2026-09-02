import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { 
  Wrench, 
  User, 
  ShieldCheck, 
  HardHat, 
  RotateCcw, 
  LogIn, 
  LogOut, 
  KeyRound, 
  CheckCircle2, 
  AlertTriangle 
} from 'lucide-react';
import { LoginModal } from './LoginModal';
import { ChangePasswordModal } from './ChangePasswordModal';

export const RoleHeader = () => {
  const { 
    currentUser, 
    currentRole, 
    setCurrentRole, 
    selectedEngineerId, 
    setSelectedEngineerId, 
    engineers, 
    requests,
    notification,
    logout,
    resetDemo 
  } = useApp();

  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showPassModal, setShowPassModal] = useState(false);

  const unassignedCount = requests.filter(r => r.status === 'Pending').length;
  const unbilledCount = requests.filter(r => (r.status === 'Completed' || r.status === 'Billed') && r.billing?.billingStatus === 'Unbilled').length;

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

          {/* Role Switcher */}
          <div className="role-switcher-container">
            <button
              className={`role-btn ${currentRole === 'customer' ? 'active' : ''}`}
              onClick={() => setCurrentRole('customer')}
            >
              <User size={16} />
              Customer Portal
            </button>

            <button
              className={`role-btn ${currentRole === 'engineer' ? 'active' : ''}`}
              onClick={() => setCurrentRole('engineer')}
            >
              <HardHat size={16} />
              Engineer Portal
            </button>

            <button
              className={`role-btn ${currentRole === 'admin' ? 'active' : ''}`}
              onClick={() => setCurrentRole('admin')}
            >
              <ShieldCheck size={16} />
              Admin Center
              {(unassignedCount > 0 || unbilledCount > 0) && (
                <span className="role-badge" title="Pending Action Items">
                  {unassignedCount + unbilledCount}
                </span>
              )}
            </button>
          </div>

          {/* User Auth Profile Bar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {currentUser ? (
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
                  <div style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: '#10b981'
                  }} />
                  <strong>{currentUser.name}</strong>
                  <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>({currentUser.role})</span>
                </div>

                <button 
                  className="btn btn-secondary btn-sm" 
                  onClick={() => setShowPassModal(true)}
                  title="Change your account password via email/phone"
                >
                  <KeyRound size={14} /> Password
                </button>

                <button 
                  className="btn btn-secondary btn-sm"
                  onClick={logout}
                  title="Log out"
                >
                  <LogOut size={14} /> Log Out
                </button>
              </div>
            ) : (
              <button className="btn btn-primary btn-sm" onClick={() => setShowLoginModal(true)}>
                <LogIn size={14} /> Sign In
              </button>
            )}

            <button 
              className="btn btn-secondary btn-sm" 
              onClick={resetDemo} 
              title="Reset system demo state"
            >
              <RotateCcw size={14} /> Demo Reset
            </button>
          </div>
        </div>
      </header>

      {/* Role Notice & Active User Information */}
      <div className="role-notice-banner">
        <div className="role-info">
          {currentRole === 'customer' && (
            <>
              <User size={16} />
              <span>
                Customer Portal &bull; Active Customer: <strong>{currentUser?.customerName || 'Acme Semiconductor Manufacturing'}</strong> ({currentUser?.email || 'dmiller@acmesemi.com'})
              </span>
            </>
          )}
          {currentRole === 'engineer' && (
            <>
              <HardHat size={16} />
              <span>
                Active Field Engineer: 
                <select 
                  className="select" 
                  value={selectedEngineerId} 
                  onChange={(e) => setSelectedEngineerId(e.target.value)}
                  style={{ width: 'auto', display: 'inline-block', marginLeft: '8px', padding: '2px 8px' }}
                >
                  {engineers.map(eng => (
                    <option key={eng.id} value={eng.id}>
                      {eng.name} ({eng.specialty})
                    </option>
                  ))}
                </select>
              </span>
            </>
          )}
          {currentRole === 'admin' && (
            <>
              <ShieldCheck size={16} />
              <span>
                Operations & Billing Command Center &bull; 
                <strong style={{ color: '#fbbf24', marginLeft: '6px' }}>{unassignedCount} Unassigned</strong>, 
                <strong style={{ color: '#c084fc', marginLeft: '6px' }}>{unbilledCount} Unbilled Jobs</strong>
              </span>
            </>
          )}
        </div>

        {/* Global Toast Notification */}
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

      {/* Login Modal */}
      <LoginModal 
        isOpen={showLoginModal} 
        onClose={() => setShowLoginModal(false)}
        onOpenPasswordReset={() => setShowPassModal(true)}
      />

      {/* Password Change Modal */}
      <ChangePasswordModal 
        isOpen={showPassModal} 
        onClose={() => setShowPassModal(false)} 
      />
    </>
  );
};
