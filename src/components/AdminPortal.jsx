import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  ShieldCheck,
  AlertTriangle,
  Users,
  User,
  DollarSign,
  FileText,
  UserCheck,
  Search,
  Filter,
  Clock,
  CheckCircle2,
  MessageSquare,
  Send,
  HardHat,
  Eye,
  Activity,
  UserPlus,
  Lock,
  Mail,
  Phone,
  Building,
  Download,
  Power,
  PowerOff
} from 'lucide-react';
import { InvoiceModal } from './InvoiceModal';
import { PartsCatalog } from './PartsCatalog';

export const AdminPortal = () => {
  const {
    requests,
    engineers,
    accounts,
    assignEngineerToRequest,
    markInvoiceSent,
    markInvoicePaid,
    adminCreateCustomerAccount,
    adminCreateEngineerAccount,
    addRemark,
    showNotification,
    toggleEngineerActive
  } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [engineerFilter, setEngineerFilter] = useState('ALL');
  const [selectedInvoiceReq, setSelectedInvoiceReq] = useState(null);
  const [selectedLogReq, setSelectedLogReq] = useState(null);
  const [modalRemarkInput, setModalRemarkInput] = useState('');
  const [showCreateCustModal, setShowCreateCustModal] = useState(false);
  const [accountTypeTab, setAccountTypeTab] = useState('customer'); // 'customer' | 'engineer'
  const [accountsTableTab, setAccountsTableTab] = useState('customer'); // 'customer' | 'engineer'

  // New Customer Account Form State
  const [custForm, setCustForm] = useState({
    customerName: '',
    name: '',
    email: '',
    phone: '',
    password: 'cust123'
  });

  // New Engineer Account Form State
  const [engForm, setEngForm] = useState({
    name: '',
    email: '',
    phone: '',
    specialty: 'Electrical & High Power',
    password: 'staff123'
  });

  // Calculated Metrics
  const totalCount = (requests || []).length;
  const unassignedCount = (requests || []).filter(r => r?.status === 'Pending').length;
  const inProgressCount = (requests || []).filter(r => r?.status === 'En Route' || r?.status === 'In Progress' || r?.status === 'Assigned').length;
  // A job is ready to bill only once the engineer has completed it and no invoice was sent yet.
  const isReadyToBill = (r) => r?.status === 'Completed' && r?.billing?.billingStatus === 'Unbilled';
  const unbilledCount = (requests || []).filter(isReadyToBill).length;

  const totalRevenue = (requests || []).reduce((sum, r) => {
    if (r?.billing?.billingStatus === 'Paid' || r?.billing?.billingStatus === 'Invoice Sent') {
      return sum + (r?.billing?.grandTotal || 0);
    }
    return sum;
  }, 0);

  // Filter accounts by role
  const customerAccounts = (accounts || []).filter(a => a?.role === 'customer');
  const engineerAccounts = (accounts || []).filter(a => a?.role === 'staff');

  // Filter requests by search, status, and assigned engineer
  const filteredRequests = (requests || []).filter(req => {
    if (!req) return false;
    const reqId = req.id || '';
    const title = req.title || '';
    const customerName = req.customerName || '';
    const engineerName = req.assignedEngineerName || '';

    const matchesSearch =
      reqId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      engineerName.toLowerCase().includes(searchQuery.toLowerCase());

    let matchesEng = true;
    if (engineerFilter === 'UNASSIGNED') {
      matchesEng = !req.assignedEngineerId;
    } else if (engineerFilter !== 'ALL') {
      matchesEng = req.assignedEngineerId === engineerFilter;
    }

    let matchesStatus = true;
    if (statusFilter === 'UNASSIGNED') matchesStatus = req.status === 'Pending';
    else if (statusFilter === 'UNBILLED') matchesStatus = isReadyToBill(req);
    else if (statusFilter !== 'ALL') matchesStatus = req.status === statusFilter;

    return matchesSearch && matchesEng && matchesStatus;
  });

  const handleCreateCustomer = async (e) => {
    e.preventDefault();
    if (!custForm.customerName || !custForm.email || !custForm.name) {
      alert('Please fill out all required fields.');
      return;
    }
    const success = await adminCreateCustomerAccount(custForm);
    if (success) {
      setShowCreateCustModal(false);
      setCustForm({
        customerName: '',
        name: '',
        email: '',
        phone: '',
        password: 'cust123'
      });
    }
  };

  const handleCreateEngineer = async (e) => {
    e.preventDefault();
    if (!engForm.name || !engForm.email || !engForm.specialty) {
      alert('Please fill out all required fields for engineer.');
      return;
    }
    const success = await adminCreateEngineerAccount(engForm);
    if (success) {
      setShowCreateCustModal(false);
      setEngForm({
        name: '',
        email: '',
        phone: '',
        specialty: 'Electrical & High Power',
        password: 'staff123'
      });
    }
  };

  const handleAdminAddRemark = async (reqId) => {
    if (!modalRemarkInput.trim()) return;
    const ok = await addRemark(reqId, modalRemarkInput, 'Operations Admin', 'Admin');
    if (ok) {
      setModalRemarkInput('');
      const updatedReq = requests.find(r => r.id === reqId);
      if (updatedReq) {
        setSelectedLogReq({ ...updatedReq });
      }
    }
  };

  // Export Dispatches to CSV Button Handler
  const handleExportCSV = () => {
    const headers = ['Ticket ID', 'Title', 'Customer', 'Category', 'Urgency', 'Assigned Engineer', 'Status', 'Billing Status', 'Total ($)', 'Date Submitted'];
    const rows = requests.map(r => [
      r.id || '',
      `"${(r.title || '').replace(/"/g, '""')}"`,
      `"${(r.customerName || '').replace(/"/g, '""')}"`,
      r.category || '',
      r.priority || '',
      r.assignedEngineerName || 'Unassigned',
      r.status || 'Pending',
      r.billing?.billingStatus || 'Unbilled',
      (r.billing?.grandTotal || 0).toFixed(2),
      r.dateSubmitted || ''
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Welpack_FieldEng_Dispatches_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showNotification('Exported Dispatches CSV Report!');
  };

  return (
    <div className="admin-portal">
      {/* Top Banner */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: 'linear-gradient(135deg, #1e293b, #0f172a)',
        padding: '1.5rem 1.75rem',
        borderRadius: '16px',
        border: '1px solid #334155',
        marginBottom: '2rem',
        boxShadow: 'var(--shadow-card)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{
            width: '54px',
            height: '54px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, #3b82f6, #06b6d4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white'
          }}>
            <ShieldCheck size={28} />
          </div>
          <div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800 }}>Admin Operations & Billing Control Center</h2>
            <p className="text-muted" style={{ fontSize: '0.875rem' }}>
              Full visibility over customer requests, field engineer dispatches, live remarks, and customer account creation.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn btn-secondary" onClick={handleExportCSV}>
            <Download size={16} /> Export Dispatches CSV
          </button>
          <button className="btn btn-primary" onClick={() => setShowCreateCustModal(true)}>
            <UserPlus size={18} /> Register New Customer Account
          </button>
        </div>
      </div>

      {/* KPI Stats Bar */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon" style={{ backgroundColor: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24' }}>
            <AlertTriangle size={24} />
          </div>
          <div>
            <div className="stat-value" style={{ color: unassignedCount > 0 ? '#fbbf24' : '#f8fafc' }}>
              {unassignedCount}
            </div>
            <div className="stat-label">Unassigned Requests</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ backgroundColor: 'rgba(6, 182, 212, 0.15)', color: '#22d3ee' }}>
            <Activity size={24} />
          </div>
          <div>
            <div className="stat-value">{inProgressCount}</div>
            <div className="stat-label">Active Field Jobs</div>
          </div>
        </div>

        <div className="stat-card" style={{ borderColor: unbilledCount > 0 ? '#c084fc' : 'var(--border-color)' }}>
          <div className="stat-icon" style={{ backgroundColor: 'rgba(168, 85, 247, 0.15)', color: '#c084fc' }}>
            <FileText size={24} />
          </div>
          <div>
            <div className="stat-value text-purple" style={{ color: '#c084fc' }}>
              {unbilledCount}
            </div>
            <div className="stat-label">Unbilled Completed Jobs</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#34d399' }}>
            <DollarSign size={24} />
          </div>
          <div>
            <div className="stat-value text-emerald">
              ${totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
            <div className="stat-label">Processed Invoices</div>
          </div>
        </div>
      </div>

      {/* Real-time Staff Engineer Roster & Workload Overview */}
      <div className="card" style={{ marginBottom: '1.5rem', backgroundColor: 'rgba(15, 23, 42, 0.6)' }}>
        <div className="card-header" style={{ marginBottom: '0.75rem' }}>
          <div className="card-title" style={{ fontSize: '1.05rem' }}>
            <HardHat className="text-amber" size={18} />
            Staff Engineer Task Roster & Workload Control
          </div>
          {engineerFilter !== 'ALL' && (
            <button className="btn btn-secondary btn-sm" onClick={() => setEngineerFilter('ALL')}>
              Reset Filter ({engineerFilter})
            </button>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
          {engineers.map(eng => {
            const engJobs = requests.filter(r => r.assignedEngineerId === eng.id);
            const activeEngJobs = engJobs.filter(r => r.status !== 'Completed' && r.status !== 'Billed' && r.status !== 'Paid');
            const isSelected = engineerFilter === eng.id;

            return (
              <div
                key={eng.id}
                style={{
                  backgroundColor: isSelected ? 'rgba(59, 130, 246, 0.15)' : eng.isActive === false ? 'rgba(239, 68, 68, 0.05)' : 'var(--bg-input)',
                  border: isSelected ? '2px solid #3b82f6' : eng.isActive === false ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid var(--border-color)',
                  borderRadius: '10px',
                  padding: '12px 14px',
                  opacity: eng.isActive === false ? 0.6 : 1,
                  transition: 'all 0.2s ease'
                }}
              >
                <div
                  onClick={() => setEngineerFilter(isSelected ? 'ALL' : eng.id)}
                  style={{ cursor: 'pointer' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong style={{ fontSize: '0.95rem' }}>{eng.name}</strong>
                    <span className="badge" style={{ backgroundColor: 'rgba(255,255,255,0.08)', fontSize: '0.7rem' }}>
                      {eng.id}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '2px' }}>{eng.specialty}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' }}>
                    {eng.isActive === false ? (
                      <span style={{ fontSize: '0.8rem', color: '#ef4444', fontWeight: 600 }}>
                        ⛔ Inactive
                      </span>
                    ) : (
                      <span style={{ fontSize: '0.8rem', color: activeEngJobs.length > 0 ? '#fbbf24' : '#34d399', fontWeight: 600 }}>
                        ⚡ {activeEngJobs.length} Active {activeEngJobs.length === 1 ? 'Task' : 'Tasks'}
                      </span>
                    )}
                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                      {engJobs.length} Total
                    </span>
                  </div>
                </div>
                <button
                  className={`btn btn-sm ${eng.isActive === false ? 'btn-primary' : 'btn-secondary'}`}
                  style={{
                    width: '100%',
                    marginTop: '8px',
                    fontSize: '0.75rem',
                    padding: '5px 8px',
                    borderColor: eng.isActive === false ? '#22c55e' : '#ef4444',
                    color: eng.isActive === false ? '#22c55e' : '#ef4444',
                    backgroundColor: eng.isActive === false ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)'
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleEngineerActive(eng.id);
                  }}
                >
                  {eng.isActive === false ? <Power size={12} /> : <PowerOff size={12} />}
                  {eng.isActive === false ? ' Reactivate' : ' Deactivate'}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Operations Desk Table */}
      <div className="card">
        <div className="card-header" style={{ flexWrap: 'wrap', gap: '1rem' }}>
          <div className="card-title">
            <UserCheck className="text-cyan" size={20} />
            Central Service Dispatch & Billing Desk
          </div>

          {/* Search & Filter Bar */}
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', width: '220px' }}>
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input
                type="text"
                className="input"
                placeholder="Search ticket, customer, engineer..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{ paddingLeft: '32px' }}
              />
            </div>

            <select
              className="select"
              value={engineerFilter}
              onChange={e => setEngineerFilter(e.target.value)}
              style={{ width: 'auto' }}
            >
              <option value="ALL">All Engineers</option>
              <option value="UNASSIGNED">⚠️ Unassigned Tickets</option>
              {engineers.map(eng => (
                <option key={eng.id} value={eng.id}>
                  {eng.isActive === false ? '🚫' : '👤'} {eng.name} ({eng.specialty}){eng.isActive === false ? ' [INACTIVE]' : ''}
                </option>
              ))}
            </select>

            <select
              className="select"
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              style={{ width: 'auto' }}
            >
              <option value="ALL">All Statuses</option>
              <option value="UNASSIGNED">⚠️ Unassigned Only ({unassignedCount})</option>
              <option value="In Progress">In Progress</option>
              <option value="Completed">Completed</option>
              <option value="UNBILLED">🧾 Unbilled Completed Jobs ({unbilledCount})</option>
              <option value="Billed">Billed</option>
              <option value="Paid">Paid</option>
            </select>
          </div>
        </div>

        {/* Requests Management Table */}
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Ticket ID</th>
                <th>Customer & Location</th>
                <th>Category & Urgency</th>
                <th>Assigned Engineer</th>
                <th>Dispatch Progress</th>
                <th>Billing Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRequests.map(req => (
                <tr key={req.id}>
                  <td>
                    <span className="font-mono text-cyan" style={{ fontWeight: 700 }}>{req.id}</span>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{req.dateSubmitted}</div>
                  </td>

                  <td>
                    <strong style={{ display: 'block' }}>{req.customerName}</strong>
                    <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>{req.title}</div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>📍 {req.location}</div>
                  </td>

                  <td>
                    <div style={{ marginBottom: '4px' }}>
                      <span className="badge" style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}>{req.category}</span>
                    </div>
                    <span className={`badge priority-${req.priority.toLowerCase()}`}>
                      {req.priority}
                    </span>
                  </td>

                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {/* Locked once the engineer has finished the job (completed / invoiced / paid) */}
                      <select
                        className="select"
                        value={req.assignedEngineerId || ''}
                        disabled={['Completed', 'Billed', 'Paid'].includes(req.status)}
                        title={['Completed', 'Billed', 'Paid'].includes(req.status) ? 'This job is finished, so the engineer can no longer be changed' : undefined}
                        onChange={e => assignEngineerToRequest(req.id, e.target.value)}
                        style={{
                          fontSize: '0.8rem',
                          padding: '4px 8px',
                          borderColor: !req.assignedEngineerId ? '#f59e0b' : 'var(--border-color)'
                        }}
                      >
                        <option value="" disabled>-- Assign Engineer --</option>
                        {/* keep the current engineer visible even if they were deactivated */}
                        {(engineers || [])
                          .filter(eng => eng.isActive !== false || eng.id === req.assignedEngineerId)
                          .map(eng => (
                            <option key={eng.id} value={eng.id} disabled={eng.isActive === false}>
                              {eng.name} ({eng.specialty}){eng.isActive === false ? ' - inactive' : ''}
                            </option>
                          ))}
                      </select>
                      {req.assignedEngineerName && (
                        <span style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <HardHat size={12} className="text-amber" /> {req.assignedEngineerName}
                        </span>
                      )}
                    </div>
                  </td>

                  <td>
                    <span className={`badge status-${(req.status || 'Pending').toLowerCase().replace(/ /g, '-')}`}>
                      {req.status || 'Pending'}
                    </span>
                    {(req.workLog || []).length > 0 && (
                      <div
                        style={{ fontSize: '0.75rem', color: '#38bdf8', marginTop: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                        onClick={() => setSelectedLogReq(req)}
                      >
                        <MessageSquare size={12} /> {req.workLog.length} field logs
                      </div>
                    )}
                  </td>

                  <td>
                    <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>
                      ${(req.billing?.grandTotal || 0).toFixed(2)}
                    </div>
                    <span className={`badge ${req.billing?.billingStatus === 'Paid' ? 'status-paid' :
                      req.billing?.billingStatus === 'Invoice Sent' ? 'status-billed' : 'status-pending'
                      }`} style={{ marginTop: '4px' }}>
                      {req.billing?.billingStatus || 'Unbilled'}
                    </span>
                  </td>

                  <td>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => setSelectedInvoiceReq(req)}
                        title="View detailed invoice breakdown"
                      >
                        <FileText size={14} /> Invoice
                      </button>

                      {isReadyToBill(req) && (
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => {
                            markInvoiceSent(req.id);
                          }}
                          title="Generate and send invoice to customer"
                        >
                          <Send size={14} /> Send Bill
                        </button>
                      )}

                      {req.billing?.billingStatus === 'Invoice Sent' && (
                        <button
                          className="btn btn-success btn-sm"
                          onClick={() => markInvoicePaid(req.id)}
                          title="Mark payment received"
                        >
                          <CheckCircle2 size={14} /> Mark Paid
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Parts catalog (search, filters, paging, CSV import) */}
      <PartsCatalog />

      {/* Admin User Account Management Section */}
      <div className="card">
        <div className="card-header" style={{ flexWrap: 'wrap', gap: '1rem' }}>
          <div className="card-title">
            <Building className="text-cyan" size={20} />
            Admin Authorized System Accounts
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              className={`btn btn-sm ${accountsTableTab === 'customer' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setAccountsTableTab('customer')}
            >
              <User size={14} /> Customer Accounts ({customerAccounts.length})
            </button>

            <button
              className={`btn btn-sm ${accountsTableTab === 'engineer' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setAccountsTableTab('engineer')}
            >
              <HardHat size={14} /> Staff Engineer Accounts ({engineerAccounts.length})
            </button>

            <button
              className="btn btn-primary btn-sm"
              onClick={() => {
                setAccountTypeTab('customer');
                setShowCreateCustModal(true);
              }}
            >
              <UserPlus size={14} /> Register New Account
            </button>
          </div>
        </div>

        <p className="text-muted" style={{ fontSize: '0.85rem', marginBottom: '1rem' }}>
          🔒 User accounts can <strong>only be registered by Admin</strong>. Registered users (Customers & Staff Engineers) can log in using these credentials.
        </p>

        <div className="table-responsive">
          {accountsTableTab === 'customer' ? (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Account ID</th>
                  <th>Company Name</th>
                  <th>Contact Person</th>
                  <th>Login Email</th>
                  <th>Phone Number</th>
                  <th>Created Date</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {customerAccounts.map(acc => (
                  <tr key={acc.id}>
                    <td className="font-mono text-cyan" style={{ fontWeight: 700 }}>{acc.id}</td>
                    <td><strong>{acc.customerName}</strong></td>
                    <td>{acc.name}</td>
                    <td>{acc.email}</td>
                    <td>{acc.phone}</td>
                    <td style={{ fontSize: '0.8rem', color: '#64748b' }}>
                      {acc.createdAt ? new Date(acc.createdAt).toLocaleDateString() : '—'}
                    </td>
                    <td>
                      <span className="badge status-completed">Authorized</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Engineer ID</th>
                  <th>Engineer Name</th>
                  <th>Specialty</th>
                  <th>Login Email</th>
                  <th>Phone Number</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {engineers.map(eng => (
                  <tr key={eng.id} style={{ opacity: eng.isActive === false ? 0.5 : 1 }}>
                    <td className="font-mono text-amber" style={{ fontWeight: 700 }}>{eng.id}</td>
                    <td><strong>{eng.name}</strong></td>
                    <td><span className="badge" style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}>{eng.specialty}</span></td>
                    <td>{eng.email}</td>
                    <td>{eng.phone}</td>
                    <td>
                      {eng.isActive === false ? (
                        <span className="badge status-pending" style={{ color: '#ef4444', borderColor: '#ef4444' }}>Inactive</span>
                      ) : (
                        <span className="badge status-completed">Active Staff</span>
                      )}
                    </td>
                    <td>
                      <button
                        className={`btn btn-sm ${eng.isActive === false ? 'btn-primary' : 'btn-secondary'}`}
                        style={{
                          fontSize: '0.75rem',
                          borderColor: eng.isActive === false ? '#22c55e' : '#ef4444',
                          color: eng.isActive === false ? '#22c55e' : '#ef4444',
                          backgroundColor: eng.isActive === false ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)'
                        }}
                        onClick={() => toggleEngineerActive(eng.id)}
                      >
                        {eng.isActive === false ? <Power size={12} /> : <PowerOff size={12} />}
                        {eng.isActive === false ? ' Activate' : ' Deactivate'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Create Account Modal (Customer or Staff Engineer) */}
      {showCreateCustModal && (
        <div className="modal-overlay" onClick={() => setShowCreateCustModal(false)}>
          <div className="modal-content" style={{ maxWidth: '580px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Admin: Register New System Account</h3>
              <button className="close-btn" onClick={() => setShowCreateCustModal(false)}>✕</button>
            </div>

            {/* Account Type Selector Tabs */}
            <div style={{ display: 'flex', gap: '8px', padding: '12px 1.5rem', backgroundColor: 'var(--bg-input)', borderBottom: '1px solid var(--border-color)' }}>
              <button
                type="button"
                className={`btn btn-sm ${accountTypeTab === 'customer' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ flex: 1 }}
                onClick={() => setAccountTypeTab('customer')}
              >
                <User size={14} /> Customer Account
              </button>
              <button
                type="button"
                className={`btn btn-sm ${accountTypeTab === 'engineer' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ flex: 1 }}
                onClick={() => setAccountTypeTab('engineer')}
              >
                <HardHat size={14} /> Staff Engineer Account
              </button>
            </div>

            {accountTypeTab === 'customer' ? (
              <form onSubmit={handleCreateCustomer}>
                <div className="modal-body">
                  <div style={{ backgroundColor: 'rgba(59,130,246,0.1)', borderLeft: '4px solid #3b82f6', padding: '10px 14px', borderRadius: '6px', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
                    Provision Customer Portal login credentials. Provide company and contact details below.
                  </div>

                  <div className="form-group">
                    <label className="form-label">Customer Company / Organization Name</label>
                    <input
                      type="text"
                      className="input"
                      placeholder="e.g. Welpack Industrial Energy Corp"
                      value={custForm.customerName}
                      onChange={e => setCustForm({ ...custForm, customerName: e.target.value })}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Primary Contact Person Name</label>
                    <input
                      type="text"
                      className="input"
                      placeholder="e.g. Robert Smith (Facility Manager)"
                      value={custForm.name}
                      onChange={e => setCustForm({ ...custForm, name: e.target.value })}
                      required
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div className="form-group">
                      <label className="form-label">Customer Login Email</label>
                      <input
                        type="email"
                        className="input"
                        placeholder="rsmith@welpackenergy.com"
                        value={custForm.email}
                        onChange={e => setCustForm({ ...custForm, email: e.target.value })}
                        required
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Phone Number</label>
                      <input
                        type="text"
                        className="input"
                        placeholder="+1 (555) 321-9876"
                        value={custForm.phone}
                        onChange={e => setCustForm({ ...custForm, phone: e.target.value })}
                        required
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Initial Password for Customer</label>
                    <input
                      type="text"
                      className="input"
                      placeholder="Initial password (e.g. cust123)"
                      value={custForm.password}
                      onChange={e => setCustForm({ ...custForm, password: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowCreateCustModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary">
                    <UserPlus size={16} /> Register & Create Customer Account
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleCreateEngineer}>
                <div className="modal-body">
                  <div style={{ backgroundColor: 'rgba(245, 158, 11, 0.1)', borderLeft: '4px solid #f59e0b', padding: '10px 14px', borderRadius: '6px', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
                    Provision Staff Engineer login credentials. Provide technical specialty and contact details below.
                  </div>

                  <div className="form-group">
                    <label className="form-label">Engineer Full Name</label>
                    <input
                      type="text"
                      className="input"
                      placeholder="e.g. Dr. Alan Turing"
                      value={engForm.name}
                      onChange={e => setEngForm({ ...engForm, name: e.target.value })}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Engineering Technical Specialty</label>
                    <select
                      className="select"
                      value={engForm.specialty}
                      onChange={e => setEngForm({ ...engForm, specialty: e.target.value })}
                    >
                      <option value="Electrical & High Power">Electrical & High Power</option>
                      <option value="HVAC & Cleanroom Refrigeration">HVAC & Cleanroom Refrigeration</option>
                      <option value="Automation & PLC Control">Automation & PLC Control</option>
                      <option value="Mechanical, Pumps & Compressors">Mechanical, Pumps & Compressors</option>
                      <option value="Software & Network Control">Software & Network Control</option>
                    </select>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div className="form-group">
                      <label className="form-label">Engineer Login Email</label>
                      <input
                        type="email"
                        className="input"
                        placeholder="turing@welpack.com"
                        value={engForm.email}
                        onChange={e => setEngForm({ ...engForm, email: e.target.value })}
                        required
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Phone Number</label>
                      <input
                        type="text"
                        className="input"
                        placeholder="+1 (555) 888-9999"
                        value={engForm.phone}
                        onChange={e => setEngForm({ ...engForm, phone: e.target.value })}
                        required
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Initial Password for Engineer</label>
                    <input
                      type="text"
                      className="input"
                      placeholder="Initial password (e.g. staff123)"
                      value={engForm.password}
                      onChange={e => setEngForm({ ...engForm, password: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowCreateCustModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" style={{ backgroundColor: '#d97706', borderColor: '#d97706' }}>
                    <HardHat size={16} /> Register & Create Staff Engineer Account
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Work Log History Modal & Live Chat for Admin Inspection */}
      {selectedLogReq && (() => {
        // Keep active modal synced with latest requests data
        const currentReq = requests.find(r => r.id === selectedLogReq.id) || selectedLogReq;

        return (
          <div className="modal-overlay" onClick={() => setSelectedLogReq(null)}>
            <div className="modal-content" style={{ maxWidth: '650px' }} onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h3>Field Log Timeline & Live Stream - {currentReq.id}</h3>
                <button className="close-btn" onClick={() => setSelectedLogReq(null)}>✕</button>
              </div>
              <div className="modal-body">
                <div style={{ marginBottom: '1rem', backgroundColor: 'var(--bg-input)', padding: '10px 14px', borderRadius: '8px' }}>
                  <strong>{currentReq.title}</strong> &bull; Customer: <strong>{currentReq.customerName}</strong>
                  <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '2px' }}>
                    Assigned Engineer: <strong className="text-amber">{currentReq.assignedEngineerName || 'Unassigned'}</strong>
                  </div>
                </div>

                <div className="remarks-timeline" style={{ maxHeight: '320px', overflowY: 'auto', marginBottom: '1.25rem' }}>
                  {currentReq.workLog.map((log, idx) => (
                    <div key={idx} className="remark-item">
                      <div className="remark-header">
                        <span className="remark-author">{log.author} ({log.role})</span>
                        <span className="remark-time">{log.timestamp}</span>
                      </div>
                      <div className="remark-text">{log.text}</div>
                    </div>
                  ))}
                </div>

                {/* Admin Live Reply Input Box */}
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    className="input"
                    placeholder="Type real-time remark/message to customer & engineer..."
                    value={modalRemarkInput}
                    onChange={e => setModalRemarkInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAdminAddRemark(currentReq.id)}
                  />
                  <button className="btn btn-primary" onClick={() => handleAdminAddRemark(currentReq.id)}>
                    <Send size={14} /> Send Reply
                  </button>
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setSelectedLogReq(null)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Invoice Inspection Modal */}
      {selectedInvoiceReq && (
        <InvoiceModal
          request={selectedInvoiceReq}
          onClose={() => setSelectedInvoiceReq(null)}
        />
      )}
    </div>
  );
};
