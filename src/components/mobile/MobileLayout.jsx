import React, { useMemo, useState } from 'react';
import {
  Wrench,
  HardHat,
  ClipboardList,
  Plus,
  User,
  History,
  LayoutDashboard,
  Package,
  Users,
  KeyRound,
  Monitor,
  LogOut,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { setLayoutOverride } from '../../hooks/useLayoutMode';
import { ChangePasswordModal } from '../ChangePasswordModal';
import { CustomerPortal } from '../CustomerPortal';
import { EngineerPortal } from '../EngineerPortal';
import { AdminPortal } from '../AdminPortal';

/*
 * The phone layout: a slim top bar, the screen, and a bottom tab bar like a normal phone app.
 * It is shown instead of the computer layout (header + wide pages) on phones. The screens
 * themselves are the same portals, told to draw themselves in phone mode.
 */

const ROLE_LABEL = { customer: 'Customer', engineer: 'Field Engineer', admin: 'Administrator' };

// Bottom tabs per role. kind: 'page' switches screen, 'action' does something, 'account' opens the account sheet.
const TABS = {
  customer: [
    { id: 'requests', label: 'Requests', icon: ClipboardList, kind: 'page', title: 'My Requests' },
    { id: 'new', label: 'New', icon: Plus, kind: 'action', title: 'My Requests', primary: true },
    { id: 'account', label: 'Account', icon: User, kind: 'account' }
  ],
  engineer: [
    { id: 'active', label: 'My Jobs', icon: HardHat, kind: 'page', title: 'My Jobs' },
    { id: 'history', label: 'History', icon: History, kind: 'page', title: 'Job History' },
    { id: 'account', label: 'Account', icon: User, kind: 'account' }
  ],
  admin: [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard, kind: 'page', title: 'Overview' },
    { id: 'tickets', label: 'Tickets', icon: ClipboardList, kind: 'page', title: 'Tickets' },
    { id: 'catalog', label: 'Parts', icon: Package, kind: 'page', title: 'Parts Catalog' },
    { id: 'people', label: 'People', icon: Users, kind: 'page', title: 'People' },
    { id: 'account', label: 'Account', icon: User, kind: 'account' }
  ]
};

const initialsOf = (name = '') =>
  name.replace(/\(.*?\)/g, '').trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() || '').join('') || '?';

const isOpen = (r) => !['Completed', 'Billed', 'Paid'].includes(r?.status);

const AccountSheet = ({ onClose, onPassword }) => {
  const { currentUser, currentRole, logout } = useApp();
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content m-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="m-sheet-handle" />
        <div className="m-account-head">
          <div className="m-avatar">{initialsOf(currentUser?.name)}</div>
          <div style={{ minWidth: 0 }}>
            <div className="m-account-name">{currentUser?.name}</div>
            <div className="m-account-sub">{ROLE_LABEL[currentRole] || currentRole}</div>
            <div className="m-account-sub">{currentUser?.email}</div>
          </div>
        </div>

        <button className="m-sheet-btn" onClick={() => { onClose(); onPassword(); }}>
          <KeyRound size={20} /> Change password
        </button>
        <button className="m-sheet-btn" onClick={() => setLayoutOverride('desktop')}>
          <Monitor size={20} /> Use desktop layout
        </button>
        <button className="m-sheet-btn danger" onClick={() => { onClose(); logout(); }}>
          <LogOut size={20} /> Log out
        </button>
      </div>
    </div>
  );
};

export const MobileLayout = () => {
  const { currentUser, currentRole, requests, notification } = useApp();
  const tabs = TABS[currentRole] || TABS.customer;
  const firstPage = tabs.find((t) => t.kind === 'page');

  const [tab, setTab] = useState(firstPage.id);
  const [newRequestTick, setNewRequestTick] = useState(0); // customer "New" button -> opens the request form
  const [showAccount, setShowAccount] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // numbers shown on the tabs
  const badges = useMemo(() => {
    const open = (requests || []).filter(isOpen).length;
    const unassigned = (requests || []).filter((r) => r.status === 'Pending').length;
    const toBill = (requests || []).filter((r) => r.status === 'Completed' && r.billing?.billingStatus === 'Unbilled').length;
    return {
      requests: open,
      active: open,
      tickets: currentRole === 'admin' ? unassigned + toBill : 0
    };
  }, [requests, currentRole]);

  const activeTab = tabs.find((t) => t.id === tab) || firstPage;

  const onTab = (t) => {
    if (t.kind === 'account') setShowAccount(true);
    else if (t.kind === 'action') setNewRequestTick((n) => n + 1);
    else setTab(t.id);
  };

  return (
    <div className="m-app">
      <header className="m-topbar">
        <div className="m-topbar-brand">
          <span className="m-logo"><Wrench size={16} /></span>
          <span className="m-topbar-title">{activeTab.title}</span>
        </div>
        <span className="m-role-chip">{ROLE_LABEL[currentRole]}</span>
      </header>

      <main className="m-main">
        {currentRole === 'customer' && <CustomerPortal mobile newRequestTick={newRequestTick} />}
        {currentRole === 'engineer' && <EngineerPortal mobile tab={tab} />}
        {currentRole === 'admin' && <AdminPortal mobile tab={tab} />}
      </main>

      <nav className="m-tabbar" aria-label="Main">
        {tabs.map((t) => {
          const Icon = t.icon;
          const count = badges[t.id] || 0;
          const selected = t.kind === 'page' ? tab === t.id : t.kind === 'account' ? showAccount : false;
          return (
            <button
              key={t.id}
              type="button"
              className={`m-tab ${selected ? 'selected' : ''} ${t.primary ? 'primary' : ''}`}
              onClick={() => onTab(t)}
              aria-current={selected ? 'page' : undefined}
            >
              <span className="m-tab-icon">
                <Icon size={t.primary ? 22 : 22} />
                {count > 0 && <span className="m-tab-badge">{count > 99 ? '99+' : count}</span>}
              </span>
              <span className="m-tab-label">{t.label}</span>
            </button>
          );
        })}
      </nav>

      {notification && (
        <div className={`m-toast ${notification.type === 'error' ? 'error' : ''}`} role="status">
          {notification.type === 'error' ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />}
          <span>{notification.text}</span>
        </div>
      )}

      {showAccount && (
        <AccountSheet onClose={() => setShowAccount(false)} onPassword={() => setShowPassword(true)} />
      )}
      <ChangePasswordModal isOpen={showPassword} onClose={() => setShowPassword(false)} />
    </div>
  );
};

