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
  // Why the user was signed out (expired session / deactivated account); shown on the login page.
  const [authNotice, setAuthNotice] = useState('');
  // Whether this server is in demo mode (sign-in shortcuts + Reset Demo). null until the server answers.
  const [demoMode, setDemoMode] = useState(null);
  const [demoLogins, setDemoLogins] = useState([]); // sample logins for the 1-click buttons (demo mode only)

  const [selectedEngineerId, setSelectedEngineerId] = useState(null);
  const [notification, setNotification] = useState(null);

  const showNotification = useCallback((msg, type = 'success') => {
    setNotification({ text: msg, type });
    setTimeout(() => setNotification(null), 4000);
  }, []);

  // Central fetch helper: injects the auth header, parses JSON safely, and ends the session
  // when the server says it is no longer valid (expired token, or account deactivated).
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

    let body;
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      // A non-JSON 5xx here is the dev proxy / tunnel failing to reach the backend, not our API.
      if (res.status >= 500) {
        return { success: false, error: 'The server is not responding. Please make sure the backend is running, then try again.' };
      }
      return { success: false, error: `Unexpected response from the server (${res.status}).` };
    }
    try {
      body = await res.json();
    } catch {
      return { success: false, error: 'Invalid response from server.' };
    }

    const endSession = (notice) => {
      setStoredToken(null);
      setCurrentUser(null);
      setCurrentRole(null);
      setAuthNotice(notice);
    };

    // Sign-in / password forms legitimately return 401 for a wrong password - that is not an
    // expired session, so only treat 401 as "session over" for normal authenticated calls.
    const isAuthForm = path.startsWith('/auth/') && path !== '/auth/me';
    if (res.status === 401 && token && !isAuthForm) {
      endSession('Your session has expired. Please sign in again.');
      return { success: false, error: 'Your session has expired. Please sign in again.' };
    }
    if (res.status === 403 && body?.code === 'DEACTIVATED' && token && !isAuthForm) {
      endSession(body.error);
    }
    return body;
  }, []);

  // Load the data the current role is allowed to see.
  const refreshData = useCallback(async (role = currentRole) => {
    const [reqData, engData, accData] = await Promise.all([
      apiFetch('/requests'),
      apiFetch('/engineers'),
      role === 'admin' ? apiFetch('/accounts') : null
    ]);
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

  // Ask the server which demo-only features to show. If it can't be reached, stay on the safe side (off).
  useEffect(() => {
    fetch(`${API_BASE}/config`)
      .then((r) => r.json())
      .then((c) => {
        setDemoMode(c?.demoMode === true);
        setDemoLogins(c?.demoMode === true && Array.isArray(c.demoLogins) ? c.demoLogins : []);
      })
      .catch(() => { setDemoMode(false); setDemoLogins([]); });
  }, []);

  const login = async (emailOrPhone, password) => {
    const data = await apiFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ emailOrPhone, password })
    });

    if (data?.success) {
      setStoredToken(data.token);
      setAuthNotice('');
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

  // Parts catalog. The catalog can be large, so it is never loaded all at once: each screen asks the
  // server for just the page / search results it needs.
  const fetchParts = useCallback(async (params = {}) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '' && v !== 'ALL') qs.set(k, String(v));
    });
    return apiFetch('/parts' + (qs.toString() ? '?' + qs.toString() : ''));
  }, [apiFetch]);

  // Admin: add (no partId) or edit an item. Returns true on success; the caller reloads its list.
  const savePart = async (fields, partId = null) => {
    const data = await apiFetch(partId ? '/parts/' + partId : '/parts', {
      method: partId ? 'PATCH' : 'POST',
      body: JSON.stringify(fields)
    });
    if (data?.success) {
      showNotification(partId ? 'Item ' + data.part.code + ' updated' : 'Item ' + data.part.code + ' added to the catalog');
      return true;
    }
    showNotification(data?.error || 'Failed to save item', 'error');
    return false;
  };

  const deletePart = async (partId) => {
    const data = await apiFetch('/parts/' + partId, { method: 'DELETE' });
    if (data?.success) {
      showNotification(data.message || 'Item deleted');
      return true;
    }
    showNotification(data?.error || 'Failed to delete item', 'error');
    return false;
  };

  // Admin: bulk add / update from a CSV file. dryRun=true only reports what would happen.
  const importParts = async (items, dryRun) =>
    apiFetch('/parts/import', { method: 'POST', body: JSON.stringify({ items, dryRun }) });

  // Erases ALL data and restores the sample data. The caller passes the word the user typed to confirm.
  const resetDemo = async (confirmText) => {
    const data = await apiFetch('/admin/reset-demo', { method: 'POST', body: JSON.stringify({ confirm: confirmText }) });
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
      authNotice,
      demoMode,
      demoLogins,
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
      fetchParts,
      savePart,
      deletePart,
      importParts,
      resetDemo,
      refreshData,
      showNotification
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => useContext(AppContext);
