import React, { createContext, useContext, useState, useEffect } from 'react';

const API_BASE = 'http://localhost:5000/api';
const AppContext = createContext();

export const AppProvider = ({ children }) => {
  const [accounts, setAccounts] = useState([]);
  const [engineers, setEngineers] = useState([]);
  const [requests, setRequests] = useState([]);

  // Always start in logged out status (null) on page refresh/startup
  const [currentUser, setCurrentUser] = useState(null);
  const [currentRole, setCurrentRole] = useState(null);

  const [selectedEngineerId, setSelectedEngineerId] = useState('ENG-101');
  const [notification, setNotification] = useState(null);

  const showNotification = (msg, type = 'success') => {
    setNotification({ text: msg, type });
    setTimeout(() => {
      setNotification(null);
    }, 4000);
  };

  // Helper: Safely parse JSON from API response
  const safeJsonParse = async (res) => {
    try {
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        return await res.json();
      }
      return { success: false, error: 'Backend Express server (http://localhost:5000) is offline or returned HTML.' };
    } catch (e) {
      return { success: false, error: 'Failed to parse JSON response from server.' };
    }
  };

  // Fetch initial data from MongoDB API
  const refreshDataFromMongoDB = async () => {
    try {
      const [reqRes, engRes, accRes] = await Promise.all([
        fetch(`${API_BASE}/requests`),
        fetch(`${API_BASE}/engineers`),
        fetch(`${API_BASE}/accounts`)
      ]);

      const reqData = await safeJsonParse(reqRes);
      const engData = await safeJsonParse(engRes);
      const accData = await safeJsonParse(accRes);

      if (reqData?.success) setRequests(reqData.requests);
      if (engData?.success) setEngineers(engData.engineers);
      if (accData?.success) setAccounts(accData.accounts);
    } catch (err) {
      console.error('Error fetching data from MongoDB backend:', err);
    }
  };

  useEffect(() => {
    refreshDataFromMongoDB();
  }, []);

  // Auth: Login via MongoDB API
  const login = async (emailOrPhone, password) => {
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailOrPhone, password })
      });
      const data = await safeJsonParse(res);

      if (data?.success) {
        const userAcc = data.account;
        setCurrentUser(userAcc);
        setCurrentRole(userAcc.role);
        if (userAcc.engineerId) {
          setSelectedEngineerId(userAcc.engineerId);
        }
        showNotification(`MongoDB Auth Successful! Logged in as ${userAcc.role.toUpperCase()} (${userAcc.name})`);
        return { success: true, role: userAcc.role };
      } else {
        showNotification(data?.error || 'Invalid credentials or server unavailable', 'error');
        return { success: false, error: data?.error };
      }
    } catch (err) {
      showNotification('Unable to connect to MongoDB server', 'error');
      return { success: false, error: err.message };
    }
  };

  // Auth: Logout
  const logout = () => {
    setCurrentUser(null);
    setCurrentRole(null);
    showNotification('Logged out. Returned to Company Login Page.');
  };

  // Admin: Register Customer Account in MongoDB
  const adminCreateCustomerAccount = async (accData) => {
    if (currentRole !== 'admin') {
      showNotification('Only Admin can create customer accounts', 'error');
      return false;
    }

    try {
      const res = await fetch(`${API_BASE}/accounts/customer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(accData)
      });
      const data = await safeJsonParse(res);

      if (data?.success) {
        showNotification(`Customer Account created in MongoDB for ${accData.customerName}! Password: ${accData.password || 'cust123'}`);
        await refreshDataFromMongoDB();
        return true;
      } else {
        showNotification(data?.error || 'Failed to create customer account', 'error');
        return false;
      }
    } catch (err) {
      showNotification('Database connection error', 'error');
      return false;
    }
  };

  // Admin: Register Staff Engineer Account in MongoDB
  const adminCreateEngineerAccount = async (engData) => {
    if (currentRole !== 'admin') {
      showNotification('Only Admin can create engineer accounts', 'error');
      return false;
    }

    try {
      const res = await fetch(`${API_BASE}/accounts/engineer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(engData)
      });
      const data = await safeJsonParse(res);

      if (data?.success) {
        showNotification(`Staff Engineer Account created in MongoDB for ${engData.name}! Password: ${engData.password || 'staff123'}`);
        await refreshDataFromMongoDB();
        return true;
      } else {
        showNotification(data?.error || 'Failed to create engineer account', 'error');
        return false;
      }
    } catch (err) {
      showNotification('Database connection error', 'error');
      return false;
    }
  };

  // Change Password in MongoDB
  const changePassword = async (emailOrPhone, currentPasswordOrCode, newPassword) => {
    try {
      const res = await fetch(`${API_BASE}/auth/change-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailOrPhone, currentPasswordOrCode, newPassword })
      });
      const data = await safeJsonParse(res);

      if (data?.success) {
        showNotification('Password updated successfully in MongoDB!');
        await refreshDataFromMongoDB();
        if (currentUser) {
          setCurrentUser(prev => ({ ...prev, password: newPassword }));
        }
        return true;
      } else {
        showNotification(data?.error || 'Failed to change password', 'error');
        return false;
      }
    } catch (err) {
      showNotification('Database error', 'error');
      return false;
    }
  };

  // Request Real OTP via Twilio SMS / Nodemailer Email
  const sendOtpCode = async (emailOrPhone) => {
    try {
      const res = await fetch(`${API_BASE}/auth/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailOrPhone })
      });
      const data = await safeJsonParse(res);

      if (data?.success) {
        showNotification(data.message || `Verification code generated!`);
        return { success: true, otpCode: data.otpCode, message: data.message };
      } else {
        showNotification(data?.error || 'Failed to send verification code', 'error');
        return { success: false, error: data?.error };
      }
    } catch (err) {
      showNotification('Server connection error', 'error');
      return { success: false, error: err.message };
    }
  };

  // Verify OTP code or password before enabling password reset fields
  const verifyOtpCode = async (emailOrPhone, currentPasswordOrCode) => {
    try {
      const res = await fetch(`${API_BASE}/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailOrPhone, currentPasswordOrCode })
      });
      const data = await safeJsonParse(res);

      if (data?.success) {
        showNotification('✅ Identity Verified! You may now set your new password.');
        return { success: true };
      } else {
        showNotification(data?.error || 'Invalid verification code or password', 'error');
        return { success: false, error: data?.error };
      }
    } catch (err) {
      showNotification('Server connection error', 'error');
      return { success: false, error: err.message };
    }
  };

  // Customer: Create Service Request in MongoDB
  const createServiceRequest = async (formData) => {
    try {
      const payload = {
        ...formData,
        customerName: formData.customerName || currentUser?.customerName || 'Acme Semiconductor Manufacturing',
        contactPerson: formData.contactPerson || currentUser?.name || 'Contact Person',
        phone: formData.phone || currentUser?.phone || '+1 (555) 000-0000',
        email: formData.email || currentUser?.email || 'customer@company.com'
      };

      const res = await fetch(`${API_BASE}/requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (data.success) {
        showNotification(`Service Request ${data.request.id} saved in MongoDB! Admin notified.`);
        await refreshDataFromMongoDB();
        return data.request.id;
      } else {
        showNotification(data.error || 'Failed to submit service request', 'error');
        return null;
      }
    } catch (err) {
      showNotification('Failed to submit request to MongoDB', 'error');
      return null;
    }
  };

  // Admin: Assign Staff Engineer in MongoDB
  const assignEngineerToRequest = async (requestId, engineerId) => {
    try {
      const res = await fetch(`${API_BASE}/requests/${requestId}/assign`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ engineerId, adminName: currentUser?.name || 'Operations Admin' })
      });
      const data = await res.json();

      if (data.success) {
        showNotification(`Assigned Staff Engineer to ticket ${requestId} in MongoDB`);
        await refreshDataFromMongoDB();
        return true;
      } else {
        showNotification(data.error || 'Error assigning engineer', 'error');
        return false;
      }
    } catch (err) {
      showNotification('Error updating assignment', 'error');
      return false;
    }
  };

  // Update Status in MongoDB
  const updateJobStatus = async (requestId, newStatus, remark = '') => {
    try {
      const res = await fetch(`${API_BASE}/requests/${requestId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: newStatus,
          remark,
          authorName: currentUser?.name || 'Staff Engineer',
          role: (currentRole === 'engineer' || currentRole === 'staff') ? 'Staff Engineer' : 'Admin'
        })
      });
      const data = await res.json();

      if (data.success) {
        showNotification(`Status updated to ${newStatus} in MongoDB`);
        await refreshDataFromMongoDB();
        return true;
      } else {
        showNotification(data.error || 'Error updating status', 'error');
        return false;
      }
    } catch (err) {
      showNotification('Error updating status in database', 'error');
      return false;
    }
  };

  // Staff Engineer: Save Field Report & Work Log in MongoDB
  const saveEngineerFieldReport = async (requestId, reportData) => {
    try {
      const res = await fetch(`${API_BASE}/requests/${requestId}/report`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...reportData,
          authorName: currentUser?.name || 'Staff Engineer'
        })
      });
      const data = await res.json();

      if (data.success) {
        showNotification(`Field work report saved to MongoDB for ticket ${requestId}`);
        await refreshDataFromMongoDB();
        return true;
      } else {
        showNotification(data.error || 'Error saving field report', 'error');
        return false;
      }
    } catch (err) {
      showNotification('Error saving field report', 'error');
      return false;
    }
  };

  // Add Remark in MongoDB
  const addRemark = async (requestId, text, customAuthor = null, customRole = null) => {
    try {
      const author = customAuthor || currentUser?.name || currentUser?.customerName || 'User';
      let role = customRole;
      if (!role) {
        if (currentRole === 'engineer' || currentRole === 'staff') role = 'Staff Engineer';
        else if (currentRole === 'admin') role = 'Admin';
        else if (currentRole === 'customer') role = 'Customer';
        else role = 'User';
      }

      const res = await fetch(`${API_BASE}/requests/${requestId}/remark`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          author,
          role,
          text
        })
      });
      const data = await res.json();

      if (data.success) {
        showNotification('Remark / Message saved in MongoDB');
        await refreshDataFromMongoDB();
        return true;
      } else {
        showNotification(data.error || 'Error sending message', 'error');
        return false;
      }
    } catch (err) {
      showNotification('Error saving remark', 'error');
      return false;
    }
  };

  // Customer Service Rating & Feedback
  const submitCustomerRating = async (requestId, rating, feedbackText) => {
    const text = `Customer Service Rating: ${'⭐'.repeat(rating)} (${rating}/5 Stars). Review: "${feedbackText}"`;
    const res = await addRemark(requestId, text);
    if (res) {
      showNotification(`Thank you! Submitted ${rating}-Star Rating for ${requestId}`);
      return true;
    }
    return false;
  };

  // Admin: Send Invoice in MongoDB
  const markInvoiceSent = async (requestId) => {
    try {
      const res = await fetch(`${API_BASE}/requests/${requestId}/billing`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          billingStatus: 'Invoice Sent',
          authorName: currentUser?.name || 'Billing Dept'
        })
      });
      const data = await res.json();

      if (data.success) {
        showNotification(`Invoice sent and updated in MongoDB for ${requestId}`);
        await refreshDataFromMongoDB();
        return true;
      } else {
        showNotification(data.error || 'Failed to send invoice', 'error');
        return false;
      }
    } catch (err) {
      showNotification('Error updating invoice status', 'error');
      return false;
    }
  };

  // Admin: Mark Invoice Paid in MongoDB
  const markInvoicePaid = async (requestId) => {
    try {
      const res = await fetch(`${API_BASE}/requests/${requestId}/billing`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          billingStatus: 'Paid',
          authorName: currentUser?.name || 'Billing Dept'
        })
      });
      const data = await res.json();

      if (data.success) {
        showNotification(`Payment confirmed and updated in MongoDB for ${requestId}`);
        await refreshDataFromMongoDB();
        return true;
      } else {
        showNotification(data.error || 'Failed to mark invoice paid', 'error');
        return false;
      }
    } catch (err) {
      showNotification('Error marking payment', 'error');
      return false;
    }
  };

  // Reset Demo Data
  const resetDemo = async () => {
    setCurrentUser(null);
    setCurrentRole(null);
    localStorage.clear();
    await refreshDataFromMongoDB();
    showNotification('System reset! Returned to initial Company Login Page.');
  };

  return (
    <AppContext.Provider value={{
      accounts,
      currentUser,
      currentRole,
      setCurrentRole,
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
      resetDemo,
      refreshDataFromMongoDB,
      showNotification
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => useContext(AppContext);
