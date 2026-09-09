import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const API_BASE = import.meta.env.VITE_API_BASE || '/api';
const TOKEN_KEY = 'welpack_token';
const AppContext = createContext();

const getToken = () => {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
};
const setStoredToken = (t) => {
  try { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY); } catch { /* ignore */ }
};

export const AppProvider = ({ children }) => {
  const [accounts, setAccounts] = useState([]);
  const [engineers, setEngineers] = useState([]);
  const [requests, setRequests] = useState([]);

  const [currentUser, setCurrentUser] = useState(null);
  const [currentRole, setCurrentRole] = useState(null);
  const [authReady, setAuthReady] = useState(false);

  const [selectedEngineerId, setSelectedEngineerId] = useState(null);
  const [notification, setNotification] = useState(null);

  const showNotification = useCallback((msg, type = 'success') => {
    setNotification({ text: msg, type });
    setTimeout(() => setNotification(null), 4000);
  }, []);

  // Central fetch helper: injects the auth header, parses JSON safely, handles 401.
  const apiFetch = useCallback(async (path, options = {}) => {
    const token = getToken();
    const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
    if (token) headers.Authorization = `Bearer ${token}`;

    let res;
    try {
      res = await fetch(`${API_BASE}${path}`, { ...options, headers });
    } catch {
      return { success: false, error: 'Cannot reach the server. Is the backend running?' };
    }

    if (res.status === 401) {
      setStoredToken(null);
      setCurrentUser(null);
      setCurrentRole(null);
      return { success: false, error: 'Your session has expired. Please sign in again.' };
    }

    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      return { success: false, error: `Server returned ${res.status}.` };
    }
    try {
      return await res.json();
    } catch {
      return { success: false, error: 'Invalid response from server.' };
    }
  }, []);

  // Load the data the current role is allowed to see.
  const refreshData = useCallback(async (role = currentRole) => {
    const calls = [apiFetch('/requests'), apiFetch('/engineers')];
    if (role === 'admin') calls.push(apiFetch('/accounts'));

    const [reqData, engData, accData] = await Promise.all(calls);
    if (reqData?.success) setRequests(reqData.requests);
    if (engData?.success) setEngineers(engData.engineers);
    if (accData?.success) setAccounts(accData.accounts);
    else if (role !== 'admin') setAccounts([]);
  }, [apiFetch, currentRole]);

  const applySession = useCallback((account) => {
    setCurrentUser(account);
    setCurrentRole(account.role);
    if (account.engineerId) setSelectedEngineerId(account.engineerId);
    return account.role;
  }, []);

  // Restore a session from a stored token on first load.
  useEffect(() => {
    (async () => {
      const token = getToken();
      if (token) {
        const data = await apiFetch('/auth/me');
        if (data?.success) {
          const role = applySession(data.account);
          await refreshData(role);
        } else {
          setStoredToken(null);
        }
      }
      setAuthReady(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = async (emailOrPhone, password) => {
    const data = await apiFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ emailOrPhone, password })
    });

    if (data?.success) {
      setStoredToken(data.token);
      const role = applySession(data.account);
      await refreshData(role);
      showNotification(`Signed in as ${role.toUpperCase()} (${data.account.name})`);
      return { success: true, role };
    }
    showNotification(data?.error || 'Invalid credentials', 'error');
    return { success: false, error: data?.error };
  };

  const logout = () => {
    setStoredToken(null);
    setCurrentUser(null);
    setCurrentRole(null);
    setAccounts([]);
    setRequests([]);
    showNotification('Logged out.');
  };

  const adminCreateCustomerAccount = async (accData) => {
    const data = await apiFetch('/accounts/customer', { method: 'POST', body: JSON.stringify(accData) });
    if (data?.success) {
      showNotification(`Customer account created for ${accData.customerName}`);
      await refreshData();
      return true;
    }
    showNotification(data?.error || 'Failed to create customer account', 'error');
    return false;
  };

  const adminCreateEngineerAccount = async (engData) => {
    const data = await apiFetch('/accounts/engineer', { method: 'POST', body: JSON.stringify(engData) });
    if (data?.success) {
      showNotification(`Engineer account created for ${engData.name}`);
      await refreshData();
      return true;
    }
    showNotification(data?.error || 'Failed to create engineer account', 'error');
    return false;
  };

  const changePassword = async (emailOrPhone, currentPasswordOrCode, newPassword) => {
    const data = await apiFetch('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ emailOrPhone, currentPasswordOrCode, newPassword })
    });
    if (data?.success) {
      showNotification('Password updated successfully');
      return true;
    }
    showNotification(data?.error || 'Failed to change password', 'error');
    return false;
  };

  const sendOtpCode = async (emailOrPhone) => {
    const data = await apiFetch('/auth/send-otp', { method: 'POST', body: JSON.stringify({ emailOrPhone }) });
    if (data?.success) {
      showNotification(data.message || 'Verification code sent');
      return { success: true, otpCode: data.devOtpCode, message: data.message };
    }
    showNotification(data?.error || 'Failed to send verification code', 'error');
    return { success: false, error: data?.error };
  };

  const verifyOtpCode = async (emailOrPhone, currentPasswordOrCode) => {
    const data = await apiFetch('/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ emailOrPhone, currentPasswordOrCode })
    });
    if (data?.success) {
      showNotification('Identity verified. Set your new password.');
      return { success: true };
    }
    showNotification(data?.error || 'Invalid verification code or password', 'error');
    return { success: false, error: data?.error };
  };

  const createServiceRequest = async (formData) => {
    const data = await apiFetch('/requests', { method: 'POST', body: JSON.stringify(formData) });
    if (data?.success) {
      showNotification(`Service request ${data.request.id} submitted`);
      await refreshData();
      return data.request.id;
    }
    showNotification(data?.error || 'Failed to submit service request', 'error');
    return null;
  };

  const assignEngineerToRequest = async (requestId, engineerId) => {
    const data = await apiFetch(`/requests/${requestId}/assign`, {
      method: 'PATCH',
      body: JSON.stringify({ engineerId })
    });
    if (data?.success) {
      showNotification(`Engineer assigned to ${requestId}`);
      await refreshData();
      return true;
    }
    showNotification(data?.error || 'Error assigning engineer', 'error');
    return false;
  };

  const updateJobStatus = async (requestId, newStatus, remark = '') => {
    const data = await apiFetch(`/requests/${requestId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status: newStatus, remark })
    });
    if (data?.success) {
      showNotification(`Status updated to ${newStatus}`);
      await refreshData();
      return true;
    }
    showNotification(data?.error || 'Error updating status', 'error');
    return false;
  };

  const saveEngineerFieldReport = async (requestId, reportData) => {
    const data = await apiFetch(`/requests/${requestId}/report`, {
      method: 'PATCH',
      body: JSON.stringify(reportData)
    });
    if (data?.success) {
      showNotification(`Field report saved for ${requestId}`);
      await refreshData();
      return true;
    }
    showNotification(data?.error || 'Error saving field report', 'error');
    return false;
  };

  const addRemark = async (requestId, text) => {
    const data = await apiFetch(`/requests/${requestId}/remark`, {
      method: 'POST',
      body: JSON.stringify({ text })
    });
    if (data?.success) {
      showNotification('Message sent');
      await refreshData();
      return true;
    }
    showNotification(data?.error || 'Error sending message', 'error');
    return false;
  };

  const submitCustomerRating = async (requestId, stars, review) => {
    const data = await apiFetch(`/requests/${requestId}/rating`, {
      method: 'POST',
      body: JSON.stringify({ stars, review })
    });
    if (data?.success) {
      showNotification(`Thank you! Submitted ${stars}-star rating for ${requestId}`);
      await refreshData();
      return true;
    }
    showNotification(data?.error || 'Error submitting rating', 'error');
    return false;
  };

  const markInvoiceSent = async (requestId) => {
    const data = await apiFetch(`/requests/${requestId}/billing`, {
      method: 'PATCH',
      body: JSON.stringify({ billingStatus: 'Invoice Sent' })
    });
    if (data?.success) {
      showNotification(`Invoice sent for ${requestId}`);
      await refreshData();
      return true;
    }
    showNotification(data?.error || 'Failed to send invoice', 'error');
    return false;
  };

  const markInvoicePaid = async (requestId) => {
    const data = await apiFetch(`/requests/${requestId}/billing`, {
      method: 'PATCH',
      body: JSON.stringify({ billingStatus: 'Paid' })
    });
    if (data?.success) {
      showNotification(`Payment confirmed for ${requestId}`);
      await refreshData();
      return true;
    }
    showNotification(data?.error || 'Failed to mark invoice paid', 'error');
    return false;
  };

  const toggleEngineerActive = async (engineerId) => {
    const data = await apiFetch(`/engineers/${engineerId}/toggle-active`, { method: 'PATCH' });
    if (data?.success) {
      showNotification(data.message || 'Engineer status updated');
      await refreshData();
      return true;
    }
    showNotification(data?.error || 'Failed to update engineer status', 'error');
    return false;
  };

  const resetDemo = async () => {
    const data = await apiFetch('/admin/reset-demo', { method: 'POST' });
    if (data?.success) {
      showNotification('Demo data reset to initial state');
      await refreshData();
      return true;
    }
    showNotification(data?.error || 'Only an admin can reset the demo data', 'error');
    return false;
  };

  return (
    <AppContext.Provider value={{
      accounts,
      currentUser,
      currentRole,
      authReady,
      selectedEngineerId,
      setSelectedEngineerId,
      engineers,
      requests,
      notification,
      login,
      logout,
      adminCreateCustomerAccount,
      adminCreateEngineerAccount,
      changePassword,
      sendOtpCode,
      verifyOtpCode,
      createServiceRequest,
      assignEngineerToRequest,
      updateJobStatus,
      saveEngineerFieldReport,
      addRemark,
      submitCustomerRating,
      markInvoiceSent,
      markInvoicePaid,
      toggleEngineerActive,
      resetDemo,
      refreshData,
      showNotification
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => useContext(AppContext);
