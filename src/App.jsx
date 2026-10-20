import React from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { RoleHeader } from './components/RoleHeader';
import { LoginPage } from './components/LoginPage';
import { CustomerPortal } from './components/CustomerPortal';
import { EngineerPortal } from './components/EngineerPortal';
import { AdminPortal } from './components/AdminPortal';
import { MobileLayout } from './components/mobile/MobileLayout';
import { useLayoutMode } from './hooks/useLayoutMode';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Uncaught error caught by ErrorBoundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          backgroundColor: '#0f172a',
          color: '#f8fafc',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem',
          textAlign: 'center'
        }}>
          <div style={{
            backgroundColor: '#1e293b',
            border: '1px solid #ef4444',
            padding: '2rem',
            borderRadius: '16px',
            maxWidth: '560px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)'
          }}>
            <h2 style={{ color: '#ef4444', marginBottom: '0.5rem' }}>⚠️ Interface Render Error</h2>
            <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '1.25rem' }}>
              An unexpected error occurred while rendering the portal interface.
            </p>
            <div style={{
              backgroundColor: 'rgba(0,0,0,0.4)',
              padding: '12px',
              borderRadius: '8px',
              color: '#fca5a5',
              fontFamily: 'monospace',
              fontSize: '0.8rem',
              textAlign: 'left',
              marginBottom: '1.5rem',
              overflowX: 'auto'
            }}>
              {this.state.error?.toString() || 'Unknown Error'}
            </div>
            <button 
              onClick={() => {
                localStorage.clear();
                window.location.reload();
              }}
              style={{
                backgroundColor: '#3b82f6',
                color: 'white',
                border: 'none',
                padding: '10px 20px',
                borderRadius: '8px',
                fontWeight: 'bold',
                cursor: 'pointer'
              }}
            >
              🔄 Reset App & Reload
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

const MainLayout = () => {
  const { currentUser, currentRole, authReady } = useApp();
  // Phones get the phone layout; computers keep the original one (see hooks/useLayoutMode.js)
  const { isMobile } = useLayoutMode();

  // Wait until a stored session has been checked, so we don't flash the login page on refresh.
  if (!authReady) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
        Loading…
      </div>
    );
  }

  // Not logged in: show the Company Login Page
  if (!currentUser) {
    return <LoginPage />;
  }

  if (isMobile) {
    return <MobileLayout />;
  }

  return (
    <div className="app-container">
      <RoleHeader />
      <main className="main-content">
        {currentRole === 'customer' && <CustomerPortal />}
        {currentRole === 'engineer' && <EngineerPortal />}
        {currentRole === 'admin' && <AdminPortal />}
      </main>

      <footer style={{
        textAlign: 'center',
        padding: '1.5rem',
        borderTop: '1px solid var(--border-color)',
        color: 'var(--text-dim)',
        fontSize: '0.85rem'
      }}>
        Welpack Engineering &bull; Engineering Dispatch & Billing Management Portal &bull; Designed for Zero Missed Revenue & Instant Field Communication
      </footer>
    </div>
  );
};

export default function App() {
  return (
    <ErrorBoundary>
      <AppProvider>
        <MainLayout />
      </AppProvider>
    </ErrorBoundary>
  );
}
