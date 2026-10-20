import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import {
  Plus,
  Clock,
  CheckCircle,
  MapPin,
  User,
  Phone,
  Mail,
  FileText,
  AlertOctagon,
  MessageSquare,
  ChevronRight,
  ChevronDown,
  HardHat,
  Star
} from 'lucide-react';
import { InvoiceModal } from './InvoiceModal';

// mobile: drawn for the phone layout (no banner, roomier touch targets). newRequestTick: the phone's "New" tab
// bumps this number to open the request form.
export const CustomerPortal = ({ mobile = false, newRequestTick = 0 }) => {
  const { requests, currentUser, createServiceRequest, addRemark, submitCustomerRating } = useApp();
  const [showNewModal, setShowNewModal] = useState(false);
  const [selectedInvoiceReq, setSelectedInvoiceReq] = useState(null);
  const [ratingModalReq, setRatingModalReq] = useState(null);
  const [remarkInput, setRemarkInput] = useState({});

  const lastTick = useRef(newRequestTick);
  useEffect(() => {
    if (newRequestTick !== lastTick.current) {
      lastTick.current = newRequestTick;
      setShowNewModal(true);
    }
  }, [newRequestTick]);

  // Which dispatch cards are expanded (collapsed by default so long service
  // histories stay easy to scan)
  const [expandedIds, setExpandedIds] = useState(() => new Set());

  const toggleCard = (id) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Rating State
  const [starRating, setStarRating] = useState(5);
  const [reviewText, setReviewText] = useState('');

  // Form State
  const [formData, setFormData] = useState({
    title: '',
    category: 'Electrical',
    priority: 'High',
    customerName: currentUser?.customerName || 'Acme Semiconductor Manufacturing',
    contactPerson: currentUser?.name || 'David Miller (Plant Director)',
    phone: currentUser?.phone || '+1 (555) 901-2345',
    email: currentUser?.email || 'dmiller@acmesemi.com',
    location: 'Building A, Cleanroom Sector 2',
    description: ''
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title || !formData.description) {
      alert('Please fill out request title and problem description.');
      return;
    }
    const reqId = await createServiceRequest(formData);
    if (reqId) {
      setShowNewModal(false);
      setFormData(prev => ({ ...prev, title: '', description: '' }));
    }
  };

  const handleAddRemark = async (reqId) => {
    const text = remarkInput[reqId];
    if (text && text.trim()) {
      const author = currentUser?.name || currentUser?.customerName || 'Customer Contact';
      const ok = await addRemark(reqId, text, author, 'Customer');
      if (ok) {
        setRemarkInput(prev => ({ ...prev, [reqId]: '' }));
      }
    }
  };

  const handleRatingSubmit = async (e) => {
    e.preventDefault();
    if (ratingModalReq) {
      const ok = await submitCustomerRating(ratingModalReq.id, starRating, reviewText);
      if (ok) {
        setRatingModalReq(null);
        setReviewText('');
      }
    }
  };

  const filteredRequests = requests.filter(req => {
    const matchesSearch =
      req.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      req.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      req.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      req.location.toLowerCase().includes(searchQuery.toLowerCase());

    if (statusFilter === 'ALL') return matchesSearch;
    return matchesSearch && req.status === statusFilter;
  });

  const getStepClass = (reqStatus, stepIndex) => {
    const statusMap = {
      'Pending': 1,
      'Assigned': 2,
      'En Route': 3,
      'In Progress': 4,
      'Completed': 5,
      'Billed': 6,
      'Paid': 6
    };

    const currentStep = statusMap[reqStatus] || 1;
    if (stepIndex < currentStep) return 'completed';
    if (stepIndex === currentStep) return 'active';
    return '';
  };

  return (
    <div className="customer-portal">
      {/* Top Welcome Banner & CTA */}
      {!mobile && (
      <div className="portal-banner" style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: 'linear-gradient(135deg, #1e293b, #0f172a)',
        padding: '1.75rem',
        borderRadius: '16px',
        border: '1px solid #334155',
        marginBottom: '2rem',
        boxShadow: 'var(--shadow-card)'
      }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Customer Dispatch Portal</h2>
          <p className="text-muted" style={{ fontSize: '0.9rem', marginTop: '4px' }}>
            Submit on-site engineering dispatch tickets, track live engineer response, and review transparent service billing.
          </p>
        </div>

        <button className="btn btn-primary" onClick={() => setShowNewModal(true)}>
          <Plus size={18} /> Request Field Engineer
        </button>
      </div>
      )}

      {/* Customer Active Tickets Feed */}
      <div className="card">
        <div className="card-header" style={{ flexWrap: 'wrap', gap: '1rem' }}>
          <div className="card-title">
            <Clock className="text-cyan" size={20} />
            {mobile ? `Your requests (${filteredRequests.length})` : `Your Field Service Dispatches (${filteredRequests.length} of ${requests.length})`}
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              type="text"
              className="input"
              placeholder="Filter by ticket ID, title..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ width: mobile ? '100%' : '200px' }}
            />
            <select
              className="select"
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              style={{ width: mobile ? '100%' : 'auto' }}
            >
              <option value="ALL">All Statuses</option>
              <option value="Pending">Pending</option>
              <option value="Assigned">Assigned</option>
              <option value="En Route">En Route</option>
              <option value="In Progress">In Progress</option>
              <option value="Completed">Completed</option>
              <option value="Paid">Paid</option>
            </select>
            {!mobile && (
              <>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => setExpandedIds(new Set(filteredRequests.map(r => r.id)))}
                >
                  Expand all
                </button>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => setExpandedIds(new Set())}
                >
                  Collapse all
                </button>
              </>
            )}
          </div>
        </div>

        {filteredRequests.length === 0 && (
          <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-muted)' }}>
            {requests.length === 0
              ? <>No requests yet.{mobile && <> Tap <strong>New</strong> below to ask for an engineer.</>}</>
              : 'No request matches your search.'}
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: mobile ? '0.9rem' : '1.5rem' }}>
          {filteredRequests.map(req => (
            <div
              key={req.id}
              className="ticket-card"
              style={{
                backgroundColor: 'var(--bg-input)',
                border: '1px solid var(--border-color)',
                borderRadius: '12px',
                padding: mobile ? '0.9rem' : '1.5rem',
                transition: 'border-color 0.2s ease'
              }}
            >
              {/* Header Info - click to expand / collapse the full dispatch detail */}
              <div
                onClick={() => toggleCard(req.id)}
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', cursor: 'pointer' }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px', flexWrap: 'wrap' }}>
                    <span style={{ color: 'var(--text-muted)', display: 'flex' }}>
                      {expandedIds.has(req.id) ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    </span>
                    <span className="font-mono text-cyan" style={{ fontSize: '0.85rem', fontWeight: 700 }}>
                      {req.id}
                    </span>
                    <span className={`badge priority-${req.priority.toLowerCase()}`}>
                      {req.priority}
                    </span>
                    <span className="badge" style={{ backgroundColor: 'rgba(255,255,255,0.06)', color: '#94a3b8' }}>
                      {req.category}
                    </span>
                    <span className="badge" style={{ backgroundColor: 'rgba(56,189,248,0.12)', color: '#38bdf8' }}>
                      {req.status}
                    </span>
                  </div>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>{req.title}</h3>
                  <p className="text-muted" style={{ fontSize: '0.85rem', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <MapPin size={14} className="text-cyan" /> {req.location} &bull; Submitted: {req.dateSubmitted}
                  </p>
                </div>

                <div style={{ textAlign: mobile ? 'left' : 'right' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Assigned Engineer</div>
                  <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px', justifyContent: mobile ? 'flex-start' : 'flex-end', marginTop: '2px' }}>
                    <HardHat size={16} className="text-amber" />
                    {req.assignedEngineerName}
                  </div>
                </div>
              </div>

              {expandedIds.has(req.id) && (
              <>
              {/* Problem Description */}
              <div style={{ marginTop: '1rem', padding: '10px 14px', backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: '8px', fontSize: '0.875rem' }}>
                <strong>Issue Description:</strong> {req.description}
              </div>

              {/* Progress Tracker Stepper */}
              <div className="progress-stepper">
                <div
                  className="progress-line-active"
                  style={{
                    width: req.status === 'Pending' ? '16%' :
                      req.status === 'Assigned' ? '33%' :
                        req.status === 'En Route' ? '50%' :
                          req.status === 'In Progress' ? '68%' :
                            req.status === 'Completed' ? '84%' : '100%'
                  }}
                />

                <div className={`step-node ${getStepClass(req.status, 1)}`}>
                  <div className="step-circle">1</div>
                  <span className="step-label">Submitted</span>
                </div>

                <div className={`step-node ${getStepClass(req.status, 2)}`}>
                  <div className="step-circle">2</div>
                  <span className="step-label">Assigned</span>
                </div>

                <div className={`step-node ${getStepClass(req.status, 3)}`}>
                  <div className="step-circle">3</div>
                  <span className="step-label">En Route</span>
                </div>

                <div className={`step-node ${getStepClass(req.status, 4)}`}>
                  <div className="step-circle">4</div>
                  <span className="step-label">On Site</span>
                </div>

                <div className={`step-node ${getStepClass(req.status, 5)}`}>
                  <div className="step-circle">5</div>
                  <span className="step-label">Completed</span>
                </div>

                <div className={`step-node ${getStepClass(req.status, 6)}`}>
                  <div className="step-circle">6</div>
                  <span className="step-label">Billed / Paid</span>
                </div>
              </div>

              {/* Live Communication & Remarks Stream */}
              <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <h4 style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <MessageSquare size={14} /> {mobile ? 'Updates' : 'Engineer & Admin Work Log History'} ({req.workLog.length})
                </h4>

                <div className="remarks-timeline">
                  {req.workLog.map((log, idx) => (
                    <div key={idx} className="remark-item">
                      <div className="remark-header">
                        <span className="remark-author">{log.author} ({log.role})</span>
                        <span className="remark-time">{log.timestamp}</span>
                      </div>
                      <div className="remark-text">{log.text}</div>
                    </div>
                  ))}
                </div>

                {/* Add Customer Remark Box */}
                <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                  <input
                    type="text"
                    className="input"
                    placeholder={mobile ? 'Write a message…' : 'Add a message or note for the engineer/admin...'}
                    value={remarkInput[req.id] || ''}
                    onChange={(e) => setRemarkInput({ ...remarkInput, [req.id]: e.target.value })}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddRemark(req.id)}
                  />
                  <button className="btn btn-secondary" onClick={() => handleAddRemark(req.id)}>
                    {mobile ? 'Send' : 'Send Message'}
                  </button>
                </div>
              </div>

              {/* Billing Action Bar */}
              <div style={{ marginTop: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                <div style={{ fontSize: '0.85rem' }}>
                  Billing Status:
                  <span className={`badge ${req.billing?.billingStatus === 'Paid' ? 'status-paid' :
                    req.billing?.billingStatus === 'Invoice Sent' ? 'status-billed' : 'status-pending'
                    }`} style={{ marginLeft: '8px' }}>
                    {req.billing?.billingStatus || 'Unbilled'}
                  </span>
                </div>

                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', width: mobile ? '100%' : 'auto' }}>
                  {(req.status === 'Completed' || req.status === 'Billed' || req.status === 'Paid') && (
                    <button className="btn btn-warning btn-sm" onClick={() => setRatingModalReq(req)}>
                      <Star size={14} /> Rate Service
                    </button>
                  )}

                  <button className="btn btn-secondary btn-sm" onClick={() => setSelectedInvoiceReq(req)}>
                    <FileText size={14} /> {mobile ? 'Invoice' : 'Inspect Invoice Breakdown'} (${(req.billing?.grandTotal || 0).toFixed(2)})
                  </button>
                </div>
              </div>
              </>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* New Service Request Modal */}
      {showNewModal && (
        <div className="modal-overlay" onClick={() => setShowNewModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Submit On-Site Service Request</h3>
              <button className="close-btn" onClick={() => setShowNewModal(false)}>✕</button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Issue Title / Summary</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="e.g. Cleanroom HVAC Chiller #2 Trip Alarm"
                    value={formData.title}
                    onChange={e => setFormData({ ...formData, title: e.target.value })}
                    required
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label">Engineering Specialty Category</label>
                    <select
                      className="select"
                      value={formData.category}
                      onChange={e => setFormData({ ...formData, category: e.target.value })}
                    >
                      <option value="Electrical">Electrical & High Power</option>
                      <option value="HVAC">HVAC & Cleanroom Refrigeration</option>
                      <option value="Automation">Automation & PLC Control</option>
                      <option value="Mechanical">Mechanical, Pumps & Compressors</option>
                      <option value="Software">Software & Network Control</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Problem Urgency / Priority</label>
                    <select
                      className="select"
                      value={formData.priority}
                      onChange={e => setFormData({ ...formData, priority: e.target.value })}
                    >
                      <option value="Low">Low (Scheduled Maintenance)</option>
                      <option value="Medium">Medium (Minor Production Impact)</option>
                      <option value="High">High (Partial Line Shutdown)</option>
                      <option value="Emergency">Emergency (Total Plant Shutdown)</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label">Company Name</label>
                    <input
                      type="text"
                      className="input"
                      value={currentUser?.customerName || formData.customerName}
                      readOnly
                      title="Your company is set by your account"
                      style={{ opacity: 0.7, cursor: 'not-allowed' }}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Contact Person & Phone</label>
                    <input
                      type="text"
                      className="input"
                      value={formData.contactPerson}
                      onChange={e => setFormData({ ...formData, contactPerson: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Site / Facility Location</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="e.g. Building C, Substation Room 102"
                    value={formData.location}
                    onChange={e => setFormData({ ...formData, location: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Detailed Engineering Problem Description</label>
                  <textarea
                    className="textarea"
                    placeholder="Provide details about symptoms, error codes, affected machinery, and safety precautions needed..."
                    value={formData.description}
                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowNewModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Dispatch Request to Admin
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Customer Service Rating Modal */}
      {ratingModalReq && (
        <div className="modal-overlay" onClick={() => setRatingModalReq(null)}>
          <div className="modal-content" style={{ maxWidth: '480px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Rate Service - {ratingModalReq.id}</h3>
              <button className="close-btn" onClick={() => setRatingModalReq(null)}>✕</button>
            </div>

            <form onSubmit={handleRatingSubmit}>
              <div className="modal-body">
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                  Please rate your satisfaction with staff engineer <strong>{ratingModalReq.assignedEngineerName}</strong>.
                </p>

                <div className="form-group" style={{ textAlign: 'center' }}>
                  <label className="form-label">Satisfaction Rating</label>
                  <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '6px' }}>
                    {[1, 2, 3, 4, 5].map(star => (
                      <button
                        type="button"
                        key={star}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          fontSize: '1.8rem',
                          color: star <= starRating ? '#fbbf24' : '#475569',
                          transition: 'transform 0.1s ease'
                        }}
                        onClick={() => setStarRating(star)}
                      >
                        ★
                      </button>
                    ))}
                  </div>
                  <span style={{ fontSize: '0.85rem', color: '#fbbf24', fontWeight: 700, marginTop: '4px', display: 'block' }}>
                    {starRating} / 5 Stars
                  </span>
                </div>

                <div className="form-group">
                  <label className="form-label">Review / Feedback Remarks</label>
                  <textarea
                    className="textarea"
                    placeholder="Share feedback on technical quality, response time, and on-site communication..."
                    value={reviewText}
                    onChange={e => setReviewText(e.target.value)}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setRatingModalReq(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-warning">
                  Submit 5-Star Rating
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Invoice Modal Popup */}
      {selectedInvoiceReq && (
        <InvoiceModal
          request={selectedInvoiceReq}
          onClose={() => setSelectedInvoiceReq(null)}
        />
      )}
    </div>
  );
};
