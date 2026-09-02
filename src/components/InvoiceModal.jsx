import React from 'react';
import { useApp } from '../context/AppContext';
import { X, Printer, CheckCircle2, Send, FileText } from 'lucide-react';

export const InvoiceModal = ({ request, onClose }) => {
  const { currentRole, markInvoiceSent, markInvoicePaid } = useApp();

  if (!request) return null;

  const { billing, fieldReport, workLog } = request;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: '750px' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileText className="text-cyan" size={20} />
            <h3 style={{ margin: 0 }}>Service & Dispatch Billing Invoice</h3>
          </div>
          <button className="close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="modal-body" style={{ padding: 0 }}>
          {/* Printable Invoice Container */}
          <div className="invoice-container">
            <div className="invoice-header">
              <div>
                <h2 className="invoice-title">WELPACK ENGINEERING</h2>
                <p style={{ fontSize: '0.85rem', color: '#64748b' }}>Industrial & Commercial Engineering Solutions</p>
                <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '4px' }}>
                  100 Tech Park Way, Suite 400 &bull; Support: dispatch@welpackengineering.com
                </p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span className={`badge ${
                  billing.billingStatus === 'Paid' ? 'status-paid' :
                  billing.billingStatus === 'Invoice Sent' ? 'status-billed' : 'status-pending'
                }`}>
                  {billing.billingStatus}
                </span>
                <p style={{ fontWeight: '700', marginTop: '8px', fontSize: '0.95rem' }}>
                  {billing.invoiceNumber}
                </p>
                <p style={{ fontSize: '0.8rem', color: '#64748b' }}>
                  Date: {billing.invoiceDate || request.dateSubmitted}
                </p>
              </div>
            </div>

            {/* Bill To & Dispatch Detail */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
              <div>
                <h4 style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#64748b', marginBottom: '4px' }}>
                  CUSTOMER / BILL TO
                </h4>
                <p style={{ fontWeight: '700', color: '#0f172a' }}>{request.customerName}</p>
                <p style={{ fontSize: '0.85rem', color: '#475569' }}>Attn: {request.contactPerson}</p>
                <p style={{ fontSize: '0.85rem', color: '#475569' }}>{request.email} | {request.phone}</p>
              </div>

              <div>
                <h4 style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#64748b', marginBottom: '4px' }}>
                  SERVICE DISPATCH DETAILS
                </h4>
                <p style={{ fontSize: '0.85rem', color: '#0f172a' }}><strong>Job ID:</strong> {request.id}</p>
                <p style={{ fontSize: '0.85rem', color: '#0f172a' }}><strong>Category:</strong> {request.category}</p>
                <p style={{ fontSize: '0.85rem', color: '#0f172a' }}><strong>Assigned Engineer:</strong> {request.assignedEngineerName || 'Unassigned'}</p>
                <p style={{ fontSize: '0.85rem', color: '#0f172a' }}><strong>Location:</strong> {request.location}</p>
              </div>
            </div>

            {/* Job Summary */}
            <div style={{ background: '#f8fafc', padding: '12px 16px', borderRadius: '6px', marginBottom: '1.5rem', borderLeft: '4px solid #3b82f6' }}>
              <h4 style={{ fontSize: '0.85rem', color: '#1e293b', marginBottom: '4px' }}>Problem Description & Diagnosis:</h4>
              <p style={{ fontSize: '0.85rem', color: '#475569', margin: 0 }}>
                {request.description}
              </p>
              {fieldReport?.diagnosis && (
                <p style={{ fontSize: '0.85rem', color: '#059669', marginTop: '6px', fontWeight: '500' }}>
                  <strong>Field Diagnosis:</strong> {fieldReport.diagnosis}
                </p>
              )}
            </div>

            {/* Itemized Table */}
            <table className="invoice-table">
              <thead>
                <tr>
                  <th>Description</th>
                  <th style={{ textAlign: 'center' }}>Qty / Hrs</th>
                  <th style={{ textAlign: 'right' }}>Unit Rate</th>
                  <th style={{ textAlign: 'right' }}>Amount ($)</th>
                </tr>
              </thead>
              <tbody>
                {/* Base Fee */}
                <tr>
                  <td>Emergency Field Service Callout Fee</td>
                  <td style={{ textAlign: 'center' }}>1</td>
                  <td style={{ textAlign: 'right' }}>${billing.baseCalloutFee.toFixed(2)}</td>
                  <td style={{ textAlign: 'right' }}>${billing.baseCalloutFee.toFixed(2)}</td>
                </tr>

                {/* Labor Hours */}
                <tr>
                  <td>
                    On-Site Engineering Labor ({request.assignedEngineerName || 'Engineer'})
                  </td>
                  <td style={{ textAlign: 'center' }}>{billing.totalHours || fieldReport?.hoursSpent || 0} hrs</td>
                  <td style={{ textAlign: 'right' }}>Standard</td>
                  <td style={{ textAlign: 'right' }}>${billing.laborTotal.toFixed(2)}</td>
                </tr>

                {/* Parts */}
                {fieldReport?.partsUsed?.map((part, idx) => (
                  <tr key={idx}>
                    <td>Parts: {part.description}</td>
                    <td style={{ textAlign: 'center' }}>{part.qty}</td>
                    <td style={{ textAlign: 'right' }}>${part.unitPrice.toFixed(2)}</td>
                    <td style={{ textAlign: 'right' }}>${(part.qty * part.unitPrice).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Totals */}
            <div className="invoice-summary">
              <div className="invoice-summary-row">
                <span>Subtotal:</span>
                <span>${billing.subtotal.toFixed(2)}</span>
              </div>
              <div className="invoice-summary-row">
                <span>Tax (8%):</span>
                <span>${billing.tax.toFixed(2)}</span>
              </div>
              <div className="invoice-summary-row total">
                <span>Total Due:</span>
                <span>${billing.grandTotal.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={handlePrint}>
            <Printer size={16} /> Print / Save PDF
          </button>

          {currentRole === 'admin' && billing.billingStatus === 'Unbilled' && (
            <button 
              className="btn btn-primary" 
              onClick={async () => {
                await markInvoiceSent(request.id);
                onClose();
              }}
            >
              <Send size={16} /> Confirm & Send Invoice to Customer
            </button>
          )}

          {currentRole === 'admin' && billing.billingStatus === 'Invoice Sent' && (
            <button 
              className="btn btn-success" 
              onClick={async () => {
                await markInvoicePaid(request.id);
                onClose();
              }}
            >
              <CheckCircle2 size={16} /> Mark Payment Received ($ Paid)
            </button>
          )}

          <button className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
