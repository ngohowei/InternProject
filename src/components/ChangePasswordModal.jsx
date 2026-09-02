import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { KeyRound, CheckCircle2, ShieldCheck, ArrowRight } from 'lucide-react';

export const ChangePasswordModal = ({ isOpen, onClose }) => {
  const { currentUser, changePassword, sendOtpCode, verifyOtpCode, showNotification } = useApp();
  
  const [emailOrPhone, setEmailOrPhone] = useState(currentUser?.email || currentUser?.phone || '');
  const [verificationMethod, setVerificationMethod] = useState('current'); // 'current' | 'otp'
  const [currentPassOrCode, setCurrentPassOrCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [otpInfoMsg, setOtpInfoMsg] = useState('');

  if (!isOpen) return null;

  const handleResetModal = () => {
    setCurrentPassOrCode('');
    setNewPassword('');
    setConfirmPassword('');
    setIsVerified(false);
    setOtpInfoMsg('');
  };

  const handleClose = () => {
    handleResetModal();
    onClose();
  };

  const handleSendOtp = async () => {
    if (!emailOrPhone) {
      showNotification('Please enter your account email or phone number first', 'error');
      return;
    }
    setIsSendingOtp(true);
    setOtpInfoMsg('Sending real SMS / Email OTP via server...');
    
    const res = await sendOtpCode(emailOrPhone);
    setIsSendingOtp(false);
    
    if (res.success) {
      setCurrentPassOrCode('');
      setOtpInfoMsg(res.message || 'OTP Code dispatched! Check your email inbox / mobile phone.');
    } else {
      setOtpInfoMsg(res.error || 'Failed to send OTP code.');
    }
  };

  const handleVerifyStep = async (e) => {
    e.preventDefault();
    if (!emailOrPhone) {
      showNotification('Please enter your registered Email or Phone', 'error');
      return;
    }
    if (!currentPassOrCode) {
      showNotification(verificationMethod === 'current' ? 'Please enter your current password' : 'Please enter the 6-digit verification code', 'error');
      return;
    }

    setIsVerifying(true);
    const res = await verifyOtpCode(emailOrPhone, currentPassOrCode);
    setIsVerifying(false);

    if (res.success) {
      setIsVerified(true);
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    if (newPassword.length < 4) {
      showNotification('New password must be at least 4 characters long', 'error');
      return;
    }

    if (newPassword !== confirmPassword) {
      showNotification('New passwords do not match!', 'error');
      return;
    }

    const success = await changePassword(emailOrPhone, currentPassOrCode, newPassword);
    if (success) {
      handleClose();
    }
  };

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-content" style={{ maxWidth: '500px' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <KeyRound className="text-cyan" size={20} />
            <h3 style={{ margin: 0 }}>Change / Reset Customer Password</h3>
          </div>
          <button className="close-btn" onClick={handleClose}>✕</button>
        </div>

        {!isVerified ? (
          /* STEP 1: VERIFICATION STEP */
          <form onSubmit={handleVerifyStep}>
            <div className="modal-body">
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
                <strong>Step 1 of 2:</strong> Verify your identity using your registered <strong>Email</strong> or <strong>Phone Number</strong>.
              </p>

              <div className="form-group">
                <label className="form-label">Registered Account Email or Phone</label>
                <input 
                  type="text" 
                  className="input" 
                  placeholder="e.g. dmiller@acmesemi.com or +1 (555) 901-2345" 
                  value={emailOrPhone}
                  onChange={e => {
                    setEmailOrPhone(e.target.value);
                    setIsVerified(false);
                  }}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Verification Method</label>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    type="button"
                    className={`btn btn-sm ${verificationMethod === 'current' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => {
                      setVerificationMethod('current');
                      setIsVerified(false);
                    }}
                  >
                    Verify via Current Password
                  </button>
                  <button
                    type="button"
                    className={`btn btn-sm ${verificationMethod === 'otp' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => {
                      setVerificationMethod('otp');
                      setIsVerified(false);
                    }}
                  >
                    Verify via Email/SMS Code
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">
                  {verificationMethod === 'current' ? 'Enter Current Password' : 'Enter 6-Digit Verification Code'}
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input 
                    type={verificationMethod === 'current' ? 'password' : 'text'}
                    className="input" 
                    placeholder={verificationMethod === 'current' ? 'Current password' : 'Enter 6-digit OTP code'} 
                    value={currentPassOrCode}
                    onChange={e => setCurrentPassOrCode(e.target.value)}
                    required
                  />
                  {verificationMethod === 'otp' && (
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      style={{ whiteSpace: 'nowrap', padding: '0 12px' }}
                      onClick={handleSendOtp}
                      disabled={isSendingOtp}
                    >
                      {isSendingOtp ? 'Sending...' : '📲 Send Code'}
                    </button>
                  )}
                </div>
                {verificationMethod === 'otp' && otpInfoMsg && (
                  <div style={{ fontSize: '0.75rem', color: 'var(--accent-cyan)', marginTop: '6px' }}>
                    {otpInfoMsg}
                  </div>
                )}
              </div>
            </div>

            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={handleClose}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={isVerifying}>
                {isVerifying ? 'Verifying...' : 'Verify Code & Continue'} <ArrowRight size={16} />
              </button>
            </div>
          </form>
        ) : (
          /* STEP 2: NEW PASSWORD STEP (Only appears after verification is correct!) */
          <form onSubmit={handlePasswordSubmit}>
            <div className="modal-body">
              <div style={{
                background: 'rgba(16, 185, 129, 0.1)',
                border: '1px solid #10b981',
                borderRadius: '8px',
                padding: '12px 16px',
                marginBottom: '1.25rem',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                color: '#10b981'
              }}>
                <ShieldCheck size={22} />
                <div style={{ fontSize: '0.85rem' }}>
                  <strong>Identity Verified!</strong>
                  <div>Code verified for <strong>{emailOrPhone}</strong>. Set your new password below.</div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">New Password</label>
                  <input 
                    type="password" 
                    className="input" 
                    placeholder="Enter new password" 
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    required
                    autoFocus
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Confirm New Password</label>
                  <input 
                    type="password" 
                    className="input" 
                    placeholder="Re-enter new password" 
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    required
                  />
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setIsVerified(false)}>
                Back
              </button>
              <button type="submit" className="btn btn-success">
                <CheckCircle2 size={16} /> Update Password
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
