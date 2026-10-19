import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { 
  HardHat, 
  MapPin, 
  Clock, 
  CheckCircle, 
  AlertTriangle, 
  Wrench, 
  Plus, 
  Trash2, 
  Save, 
  FileText, 
  MessageSquare,
  Navigation,
  ChevronRight,
  ChevronDown
} from 'lucide-react';
import { InvoiceModal } from './InvoiceModal';
import { PART_CATEGORIES } from '../data/partCategories';

export const EngineerPortal = () => {
  const { 
    requests, 
    engineers, 
    currentUser,
    selectedEngineerId, 
    updateJobStatus, 
    saveEngineerFieldReport,
    addRemark,
    fetchParts
  } = useApp();

  const [activeTab, setActiveTab] = useState('active'); // 'active' | 'completed'
  const [editingJob, setEditingJob] = useState(null);
  const [selectedInvoiceReq, setSelectedInvoiceReq] = useState(null);
  const [remarkText, setRemarkText] = useState({});

  // Per-card expand/collapse. Default: active dispatches expanded, completed
  // history collapsed so a long job history stays easy to scan.
  const [cardOverrides, setCardOverrides] = useState({});
  const isCardExpanded = (job) => cardOverrides[job.id] ?? (activeTab === 'active');
  const toggleCard = (id) =>
    setCardOverrides(prev => ({ ...prev, [id]: !(prev[id] ?? (activeTab === 'active')) }));

  // Field Report Edit Modal State
  const [reportState, setReportState] = useState({
    hoursSpent: 0,
    diagnosis: '',
    partsUsed: [],
    isCompleted: false
  });

  // Parts picker: the engineer searches the catalog (by name or item code), picks an item and
  // types only a quantity. The unit price always comes from the catalog.
  const [partQuery, setPartQuery] = useState('');
  const [pickedPart, setPickedPart] = useState(null);
  const [partQty, setPartQty] = useState(1);
  const [showPartMenu, setShowPartMenu] = useState(false);

  const resetPartPicker = () => {
    setPartQuery('');
    setPickedPart(null);
    setPartQty(1);
    setShowPartMenu(false);
  };

  // The catalog can be big, so it is searched on the server as the engineer types (top matches only)
  // instead of being downloaded in full.
  const [partCategory, setPartCategory] = useState('ALL');
  const [partResults, setPartResults] = useState({ parts: [], total: 0, loading: false, error: '' });
  const partSearchSeq = useRef(0);
  const partMatches = partResults.parts;

  useEffect(() => {
    if (!editingJob || !showPartMenu || pickedPart) return undefined;
    const seq = ++partSearchSeq.current;
    setPartResults(prev => ({ ...prev, loading: true }));
    const timer = setTimeout(async () => {
      const data = await fetchParts({ q: partQuery.trim(), category: partCategory, limit: 8, sort: 'code' });
      if (seq !== partSearchSeq.current) return; // a newer search has started; ignore this answer
      setPartResults(data?.success
        ? { parts: data.parts, total: data.total, loading: false, error: '' }
        : { parts: [], total: 0, loading: false, error: data?.error || 'Could not search the catalog.' });
    }, 250);
    return () => clearTimeout(timer);
  }, [partQuery, partCategory, showPartMenu, pickedPart, editingJob, fetchParts]);

  const pickPart = (p) => {
    setPickedPart(p);
    setPartQuery(`${p.code} — ${p.name}`);
    setShowPartMenu(false);
  };

  const activeEngineer = (engineers || []).find(e => e?.id === selectedEngineerId) || engineers[0] || { id: 'ENG-101', name: 'Alex Wong', specialty: 'High Voltage & Power', hourlyRate: 120 };

  // Filter requests assigned to this engineer
  const engineerJobs = (requests || []).filter(r => r?.assignedEngineerId === activeEngineer?.id);
  const activeJobs = engineerJobs.filter(r => r?.status !== 'Completed' && r?.status !== 'Billed' && r?.status !== 'Paid');
  const completedJobs = engineerJobs.filter(r => r?.status === 'Completed' || r?.status === 'Billed' || r?.status === 'Paid');

  const openReportModal = (job) => {
    resetPartPicker();
    setEditingJob(job);
    setReportState({
      hoursSpent: job.fieldReport?.hoursSpent || 1.5,
      diagnosis: job.fieldReport?.diagnosis || 'Inspected high voltage distribution panel and replaced blown 400A main fuses. Verified system voltage stability.',
      partsUsed: job.fieldReport?.partsUsed ? [...job.fieldReport.partsUsed] : [],
      isCompleted: true
    });
  };

  const clampQty = (v) => Math.min(1000, Math.max(1, parseInt(v, 10) || 1));

  const handleAddPart = () => {
    if (!pickedPart) {
      alert('Choose an item from the list first: type its name or item code, then click it.');
      return;
    }
    const qty = clampQty(partQty);
    setReportState(prev => {
      const i = prev.partsUsed.findIndex(p => p.code === pickedPart.code);
      if (i >= 0) {
        // Same item again: just add to the quantity instead of listing it twice.
        const next = [...prev.partsUsed];
        next[i] = { ...next[i], qty: clampQty(next[i].qty + qty) };
        return { ...prev, partsUsed: next };
      }
      return {
        ...prev,
        partsUsed: [...prev.partsUsed, {
          code: pickedPart.code,
          description: pickedPart.name,
          qty,
          unitPrice: pickedPart.unitPrice
        }]
      };
    });
    resetPartPicker();
  };

  const handlePartQtyChange = (index, value) => {
    setReportState(prev => ({
      ...prev,
      partsUsed: prev.partsUsed.map((p, idx) => (idx === index ? { ...p, qty: clampQty(value) } : p))
    }));
  };

  const handleRemovePart = (index) => {
    setReportState(prev => ({
      ...prev,
      partsUsed: prev.partsUsed.filter((_, idx) => idx !== index)
    }));
  };

  const handleSaveReport = async (e) => {
    e.preventDefault();
    if (!editingJob) return;
    // Send only the item code and quantity - the server looks up name and price from the catalog.
    const payload = {
      ...reportState,
      partsUsed: reportState.partsUsed.map(p =>
        p.code ? { code: p.code, qty: p.qty } : { description: p.description, qty: p.qty } // older free-text line
      )
    };
    const ok = await saveEngineerFieldReport(editingJob.id, payload);
    if (ok) {
      setEditingJob(null);
    }
  };

  const partsSubtotal = reportState.partsUsed.reduce((s, p) => s + p.qty * p.unitPrice, 0);

  const handleAddRemark = async (jobId) => {
    const text = remarkText[jobId];
    if (text && text.trim()) {
      const author = currentUser?.name || activeEngineer.name;
      const ok = await addRemark(jobId, text, author, 'Staff Engineer');
      if (ok) {
        setRemarkText(prev => ({ ...prev, [jobId]: '' }));
      }
    }
  };

  return (
    <div className="engineer-portal">
      {/* Top Banner */}
      <div className="portal-banner" style={{
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
            background: 'linear-gradient(135deg, #f59e0b, #d97706)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white'
          }}>
            <HardHat size={28} />
          </div>
          <div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800 }}>Field Dispatch Workbench</h2>
            <p className="text-muted" style={{ fontSize: '0.875rem' }}>
              Engineer: <strong style={{ color: '#f8fafc' }}>{activeEngineer.name}</strong> &bull; {activeEngineer.specialty}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '1rem' }}>
          <div className="stat-card" style={{ padding: '0.75rem 1.25rem', marginBottom: 0 }}>
            <div style={{ fontSize: '1.4rem', fontWeight: 800 }} className="text-cyan">{activeJobs.length}</div>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase' }}>Active Jobs</div>
          </div>
          <div className="stat-card" style={{ padding: '0.75rem 1.25rem', marginBottom: 0 }}>
            <div style={{ fontSize: '1.4rem', fontWeight: 800 }} className="text-emerald">{completedJobs.length}</div>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase' }}>Done</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '1.5rem' }}>
        <button 
          className={`btn ${activeTab === 'active' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('active')}
        >
          Active Dispatches ({activeJobs.length})
        </button>
        <button 
          className={`btn ${activeTab === 'completed' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('completed')}
        >
          Completed History ({completedJobs.length})
        </button>

        {activeTab === 'completed' && completedJobs.length > 0 && (
          <div style={{ display: 'flex', gap: '8px', marginLeft: 'auto' }}>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setCardOverrides(Object.fromEntries(completedJobs.map(j => [j.id, true])))}
            >
              Expand all
            </button>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setCardOverrides(Object.fromEntries(completedJobs.map(j => [j.id, false])))}
            >
              Collapse all
            </button>
          </div>
        )}
      </div>

      {/* Job Cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {(activeTab === 'active' ? activeJobs : completedJobs).map(job => (
          <div 
            key={job.id}
            className="card"
            style={{
              borderColor: job.priority === 'Emergency' ? 'rgba(239, 68, 68, 0.4)' : 'var(--border-color)',
              boxShadow: job.priority === 'Emergency' ? '0 0 20px rgba(239, 68, 68, 0.15)' : 'var(--shadow-card)'
            }}
          >
            {/* Job Header */}
            <div className="card-header" style={{ marginBottom: isCardExpanded(job) ? '1rem' : 0 }}>
              <div onClick={() => toggleCard(job.id)} style={{ cursor: 'pointer' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px', flexWrap: 'wrap' }}>
                  <span style={{ color: 'var(--text-muted)', display: 'flex' }}>
                    {isCardExpanded(job) ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </span>
                  <span className="font-mono text-cyan" style={{ fontSize: '0.85rem', fontWeight: 700 }}>{job.id}</span>
                  <span className={`badge priority-${job.priority.toLowerCase()}`}>{job.priority}</span>
                  <span className="badge" style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}>{job.category}</span>
                  <span className={`badge status-${job.status.toLowerCase().replace(' ', '-')}`}>
                    Status: {job.status}
                  </span>
                </div>
                <h3 className="card-title" style={{ fontSize: '1.2rem' }}>{job.title}</h3>
              </div>

              {/* Status Action Buttons */}
              <div style={{ display: 'flex', gap: '8px' }}>
                {job.status === 'Assigned' && (
                  <button 
                    className="btn btn-warning btn-sm"
                    onClick={() => updateJobStatus(job.id, 'En Route', 'Accepted job assignment. En route to customer site.')}
                  >
                    <Navigation size={14} /> Start Drive (En Route)
                  </button>
                )}

                {job.status === 'En Route' && (
                  <button 
                    className="btn btn-primary btn-sm"
                    onClick={() => updateJobStatus(job.id, 'In Progress', 'Arrived at customer facility. Commenced diagnostic work.')}
                  >
                    <Wrench size={14} /> Arrived On Site (In Progress)
                  </button>
                )}

                {(job.status === 'In Progress' || job.status === 'En Route' || job.status === 'Assigned') && (
                  <button 
                    className="btn btn-success btn-sm"
                    onClick={() => openReportModal(job)}
                  >
                    <CheckCircle size={14} /> Log Work & Complete Job
                  </button>
                )}
              </div>
            </div>

            {isCardExpanded(job) && (
            <>
            {/* Customer & Location */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', backgroundColor: 'var(--bg-input)', padding: '12px 16px', borderRadius: '8px', marginBottom: '1rem' }}>
              <div>
                <span className="text-muted" style={{ fontSize: '0.8rem', display: 'block' }}>CUSTOMER FACILITY</span>
                <strong style={{ fontSize: '0.95rem' }}>{job.customerName}</strong>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Contact: {job.contactPerson} ({job.phone})</p>
              </div>

              <div>
                <span className="text-muted" style={{ fontSize: '0.8rem', display: 'block' }}>LOCATION / SITE</span>
                <strong style={{ fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <MapPin size={14} className="text-rose" /> {job.location}
                </strong>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Submitted: {job.dateSubmitted}</p>
              </div>
            </div>

            {/* Issue Description */}
            <div style={{ marginBottom: '1rem', fontSize: '0.9rem' }}>
              <span className="text-muted" style={{ fontWeight: 600 }}>Problem Statement:</span>
              <p style={{ color: 'var(--text-main)', marginTop: '2px' }}>{job.description}</p>
            </div>

            {/* Existing Work Log & Remarks */}
            <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <h4 style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <MessageSquare size={14} /> On-Site Log & Field Remarks
                </h4>
                {job.fieldReport?.hoursSpent > 0 && (
                  <span style={{ fontSize: '0.8rem', color: 'var(--accent-emerald)', fontWeight: 600 }}>
                    Logged: {job.fieldReport.hoursSpent} hrs labor &bull; {job.fieldReport.partsUsed?.length || 0} parts used
                  </span>
                )}
              </div>

              <div className="remarks-timeline">
                {job.workLog.map((log, idx) => (
                  <div key={idx} className="remark-item">
                    <div className="remark-header">
                      <span className="remark-author">{log.author} ({log.role})</span>
                      <span className="remark-time">{log.timestamp}</span>
                    </div>
                    <div className="remark-text">{log.text}</div>
                  </div>
                ))}
              </div>

              {/* Add Quick Field Remark */}
              <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                <input 
                  type="text" 
                  className="input" 
                  placeholder="Type real-time field update (e.g. 'Inspected relay, replacing solenoid valve now')..."
                  value={remarkText[job.id] || ''}
                  onChange={e => setRemarkText({ ...remarkText, [job.id]: e.target.value })}
                  onKeyDown={e => e.key === 'Enter' && handleAddRemark(job.id)}
                />
                <button className="btn btn-secondary" onClick={() => handleAddRemark(job.id)}>
                  Post Remark
                </button>
                {/* Once the invoice is sent the work log is locked so the invoice never changes */}
                {job.status === 'Billed' || job.status === 'Paid' ? (
                  <span
                    className="badge"
                    title="This job has been invoiced, so the work log can no longer be changed"
                    style={{ alignSelf: 'center', whiteSpace: 'nowrap', backgroundColor: 'rgba(255,255,255,0.06)' }}
                  >
                    🔒 Invoiced - locked
                  </span>
                ) : (
                  <button className="btn btn-primary" onClick={() => openReportModal(job)}>
                    <Save size={14} /> Work Log Form
                  </button>
                )}
              </div>
            </div>
            </>
            )}
          </div>
        ))}

        {(activeTab === 'active' ? activeJobs : completedJobs).length === 0 && (
          <div className="card" style={{ textAlign: 'center', padding: '3rem 1.5rem' }}>
            <HardHat size={48} className="text-muted" style={{ marginBottom: '1rem' }} />
            <h3>No {activeTab} dispatches for {activeEngineer.name}</h3>
            <p className="text-muted">You are all caught up on field requests.</p>
          </div>
        )}
      </div>

      {/* Engineer Work Log & Parts Billing Modal */}
      {editingJob && (
        <div className="modal-overlay" onClick={() => setEditingJob(null)}>
          <div className="modal-content" style={{ maxWidth: '700px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Field Service Report & Billing Log - {editingJob.id}</h3>
              <button className="close-btn" onClick={() => setEditingJob(null)}>✕</button>
            </div>

            <form onSubmit={handleSaveReport}>
              <div className="modal-body">
                <div style={{ backgroundColor: 'var(--bg-input)', padding: '12px', borderRadius: '8px', marginBottom: '1.25rem' }}>
                  <strong>Customer:</strong> {editingJob.customerName} &bull; <strong>Title:</strong> {editingJob.title}
                </div>

                <div className="form-group">
                  <label className="form-label">On-Site Labor Hours Spent</label>
                  <input 
                    type="number" 
                    step="0.5" 
                    min="0.5" 
                    max="48"
                    className="input" 
                    value={reportState.hoursSpent}
                    onChange={e => setReportState({ ...reportState, hoursSpent: parseFloat(e.target.value) || 0 })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Technical Diagnosis & Work Performed</label>
                  <textarea 
                    className="textarea"
                    placeholder="Describe technical actions taken, component testing performed, safety verifications..."
                    value={reportState.diagnosis}
                    onChange={e => setReportState({ ...reportState, diagnosis: e.target.value })}
                    required
                  />
                </div>

                {/* Replacement Parts Billing Table */}
                <div className="form-group">
                  <label className="form-label">Replacement Parts & Materials Used</label>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
                    Search the parts catalog by item name or code, pick the item, then enter the quantity. The price is filled in automatically.
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', fontSize: '0.8rem' }}>
                    <span className="text-muted">Category</span>
                    <select
                      className="select"
                      style={{ width: 'auto', padding: '4px 8px' }}
                      value={partCategory}
                      onChange={e => setPartCategory(e.target.value)}
                      title="Narrow the search to one category"
                    >
                      <option value="ALL">All categories</option>
                      {PART_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '2.4fr 0.8fr 1fr 1fr auto', gap: '8px', marginBottom: '8px', alignItems: 'start' }}>
                    {/* Item search (name or code) with suggestions */}
                    <div style={{ position: 'relative' }}>
                      <input
                        type="text"
                        className="input"
                        placeholder="Item name or code (e.g. FUSE or relay)"
                        value={partQuery}
                        autoComplete="off"
                        onChange={e => { setPartQuery(e.target.value); setPickedPart(null); setShowPartMenu(true); }}
                        onFocus={() => { if (!pickedPart) setShowPartMenu(true); }}
                        onBlur={() => setTimeout(() => setShowPartMenu(false), 150)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            if (pickedPart) { handleAddPart(); return; }
                            const q = partQuery.trim().toLowerCase();
                            const exact = partMatches.find(p => p.code.toLowerCase() === q);
                            const choice = exact || (partMatches.length === 1 ? partMatches[0] : null);
                            if (choice) pickPart(choice);
                          } else if (e.key === 'Escape') {
                            setShowPartMenu(false);
                          }
                        }}
                      />
                      {showPartMenu && !pickedPart && (
                        <div style={{
                          position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '4px', zIndex: 30,
                          backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)',
                          borderRadius: '8px', maxHeight: '240px', overflowY: 'auto',
                          boxShadow: '0 12px 24px rgba(0,0,0,0.45)'
                        }}>
                          {partMatches.length > 0 && partMatches.map(p => (
                            <div
                              key={p.code}
                              onMouseDown={e => { e.preventDefault(); pickPart(p); }}
                              style={{ padding: '8px 12px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', gap: '12px', fontSize: '0.85rem', borderBottom: '1px solid rgba(255,255,255,0.05)' }}
                              onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(59,130,246,0.15)'; }}
                              onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                            >
                              <span>
                                <span className="font-mono text-cyan" style={{ fontWeight: 700 }}>{p.code}</span>
                                <span style={{ marginLeft: '8px' }}>{p.name}</span>
                              </span>
                              <span style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>${p.unitPrice.toFixed(2)}</span>
                            </div>
                          ))}
                          {partMatches.length === 0 && (
                            <div style={{ padding: '10px 12px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                              {partResults.loading
                                ? 'Searching…'
                                : partResults.error
                                  ? partResults.error
                                  : (partQuery.trim() || partCategory !== 'ALL')
                                    ? 'No matching item. Ask your admin to add it to the catalog.'
                                    : 'The parts catalog is empty. Ask your admin to add items.'}
                            </div>
                          )}
                          {partMatches.length > 0 && partResults.total > partMatches.length && (
                            <div style={{ padding: '6px 12px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              Showing {partMatches.length} of {partResults.total} matches — keep typing to narrow it down
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <input
                      type="number"
                      min="1"
                      max="1000"
                      className="input"
                      placeholder="Qty"
                      title="Quantity"
                      value={partQty}
                      onChange={e => setPartQty(e.target.value)}
                    />

                    {/* Price and amount are read-only: they come from the catalog */}
                    <div className="input" style={{ opacity: 0.8, display: 'flex', alignItems: 'center' }} title="Unit price from the catalog">
                      {pickedPart ? `$${pickedPart.unitPrice.toFixed(2)}` : <span style={{ color: 'var(--text-muted)' }}>Unit price</span>}
                    </div>
                    <div className="input" style={{ opacity: 0.8, display: 'flex', alignItems: 'center', fontWeight: 700 }} title="Quantity × unit price">
                      {pickedPart ? `$${(clampQty(partQty) * pickedPart.unitPrice).toFixed(2)}` : <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>Amount</span>}
                    </div>

                    <button type="button" className="btn btn-secondary" onClick={handleAddPart} title="Add this item to the report">
                      <Plus size={16} />
                    </button>
                  </div>

                  {/* Parts List */}
                  {reportState.partsUsed.length > 0 ? (
                    <>
                      <table className="data-table parts-table" style={{ marginTop: '8px' }}>
                        <thead>
                          <tr>
                            <th>Code</th>
                            <th>Item</th>
                            <th>Qty</th>
                            <th>Unit ($)</th>
                            <th>Total ($)</th>
                            <th>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {reportState.partsUsed.map((part, idx) => (
                            <tr key={part.code || `${part.description}-${idx}`}>
                              <td className="font-mono" style={{ whiteSpace: 'nowrap' }}>
                                {part.code
                                  ? <span className="text-cyan" style={{ fontWeight: 700 }}>{part.code}</span>
                                  : <span style={{ color: 'var(--text-muted)' }} title="Entered before the parts catalog existed">—</span>}
                              </td>
                              <td>
                                {part.description}
                                {part.code && <div className="part-code-inline font-mono">{part.code}</div>}
                              </td>
                              <td>
                                <input
                                  type="number"
                                  min="1"
                                  max="1000"
                                  className="input"
                                  style={{ width: '70px', padding: '4px 8px' }}
                                  value={part.qty}
                                  onChange={e => handlePartQtyChange(idx, e.target.value)}
                                />
                              </td>
                              <td>${part.unitPrice.toFixed(2)}</td>
                              <td>${(part.qty * part.unitPrice).toFixed(2)}</td>
                              <td>
                                <button
                                  type="button"
                                  className="close-btn"
                                  style={{ color: '#ef4444' }}
                                  onClick={() => handleRemovePart(idx)}
                                >
                                  <Trash2 size={14} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <div style={{ textAlign: 'right', marginTop: '8px', fontSize: '0.9rem' }}>
                        Parts subtotal: <strong>${partsSubtotal.toFixed(2)}</strong>
                      </div>
                    </>
                  ) : (
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                      No extra replacement parts logged yet.
                    </div>
                  )}
                </div>

                <div className="form-group" style={{ marginTop: '1.5rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <input 
                    type="checkbox" 
                    id="markDoneCheck" 
                    checked={reportState.isCompleted}
                    onChange={e => setReportState({ ...reportState, isCompleted: e.target.checked })}
                    style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                  />
                  <label htmlFor="markDoneCheck" style={{ fontWeight: 600, cursor: 'pointer' }}>
                    Mark Service Request as COMPLETED & Ready for Admin Billing Review
                  </label>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setEditingJob(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-success">
                  <Save size={16} /> Save Work Log & Report
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Invoice Modal Preview */}
      {selectedInvoiceReq && (
        <InvoiceModal 
          request={selectedInvoiceReq} 
          onClose={() => setSelectedInvoiceReq(null)} 
        />
      )}
    </div>
  );
};
