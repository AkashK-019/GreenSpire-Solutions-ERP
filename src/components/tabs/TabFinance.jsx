import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { formatCurrency } from '../../utils/helpers';
import { ArrowUpRight, ArrowDownLeft, Plus, Loader2, Trash2, AlertTriangle } from 'lucide-react';
import { supabase } from '../../supabase';

const CREDIT_CATS = ['Client Payments', 'Advance Received', 'Extra Work Charges'];
const DEBIT_CATS  = ['Labour Charges', 'Site Expense', 'Material Purchase', 'Transport', 'Vendor Payment', 'Printing', 'Miscellaneous'];
const PAY_METHODS = ['UPI (GPay / PhonePe)', 'NEFT / RTGS', 'Bank Transfer', 'Cheque', 'Cash'];

export default function TabFinance({ project }) {
  const [loading,      setLoading]      = useState(true);
  const [transactions, setTxs]          = useState([]);
  const [showModal,    setShowModal]    = useState(false);
  const [deletingTx,   setDeletingTx]   = useState(null);   // tx object to confirm-delete
  const [deleteLoading, setDeleteLoading] = useState(false);

  const [newTx, setNewTx] = useState({
    type:        'Credit',
    category:    'Client Payments',
    amount:      '',
    description: '',
    method:      'UPI (GPay / PhonePe)',
  });

  useEffect(() => { fetchTxs(); }, [project.id]);

  /* ── Fetch ── */
  const fetchTxs = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('finance_ledger')
        .select('*')
        .eq('project_id', project.id)
        .order('date', { ascending: false });
      if (error) throw error;
      setTxs(data || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  /* ── Totals ── */
  const credits = transactions.filter(t => t.type === 'Credit').reduce((s, t) => s + Number(t.amount), 0);
  const debits  = transactions.filter(t => t.type === 'Debit').reduce((s, t) => s + Number(t.amount), 0);
  const balance = credits - debits;

  /* ── Add ── */
  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const desc = `Method: ${newTx.method} | Note: ${newTx.description}`;
      const { error } = await supabase.from('finance_ledger').insert([{
        project_id:  project.id,
        type:        newTx.type,
        category:    newTx.category,
        amount:      Number(newTx.amount) || 0,
        date:        new Date().toISOString().split('T')[0],
        description: desc,
      }]);
      if (error) throw error;
      setShowModal(false);
      setNewTx({ type: 'Credit', category: 'Client Payments', amount: '', description: '', method: 'UPI (GPay / PhonePe)' });
      fetchTxs();
    } catch (err) { alert(err.message); }
  };

  /* ── Delete ── */
  const handleDeleteConfirm = async () => {
    if (!deletingTx) return;
    setDeleteLoading(true);
    try {
      const { error } = await supabase.from('finance_ledger').delete().eq('id', deletingTx.id);
      if (error) throw error;
      setDeletingTx(null);
      fetchTxs();
    } catch (err) {
      alert(err.message);
    } finally {
      setDeleteLoading(false);
    }
  };

  /* ── Parse description to extract method ── */
  const parseMethod = (desc) => {
    if (!desc) return 'N/A';
    const match = desc.match(/Method:\s*([^|]+)/);
    return match ? match[1].trim() : 'N/A';
  };

  /* ── Type change resets category ── */
  const handleTypeChange = (type) => {
    setNewTx(prev => ({
      ...prev,
      type,
      category: type === 'Credit' ? 'Client Payments' : 'Labour Charges',
    }));
  };

  return (
    <div className="animate-fade">

      {/* ── Page header ── */}
      <div className="tab-page-head">
        <div>
          <h2 className="tab-page-title">Project Ledger</h2>
          <p className="tab-page-sub">Track project cashflows, client payments, and site expenses.</p>
        </div>
        <button className="pj-add-btn" onClick={() => setShowModal(true)}>
          <Plus size={15} /> Record Transaction
        </button>
      </div>

      {/* ── KPI row ── */}
      <div className="tab-kpi-row">
        <div className="tab-kpi">
          <div className="tab-kpi-label">Total Inflow</div>
          <div className="tab-kpi-value" style={{ color: '#10b981' }}>{formatCurrency(credits)}</div>
        </div>
        <div className="tab-kpi">
          <div className="tab-kpi-label">Total Outflow</div>
          <div className="tab-kpi-value" style={{ color: '#ef4444' }}>{formatCurrency(debits)}</div>
        </div>
        <div className="tab-kpi">
          <div className="tab-kpi-label">Net Margin</div>
          <div className="tab-kpi-value" style={{ color: balance >= 0 ? '#0b3d27' : '#ef4444' }}>
            {formatCurrency(balance)}
          </div>
        </div>
      </div>

      {/* ── Table / empty / loading ── */}
      {loading ? (
        <div className="tab-empty">
          <Loader2 size={20} className="db-spin" style={{ color: '#10b981' }} />
        </div>
      ) : transactions.length === 0 ? (
        <div className="tab-empty">No transactions recorded for this project.</div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="tab-table-wrap drawings-table-wrap" style={{ overflowX: 'auto' }}>
            <table className="tab-table" style={{ minWidth: '620px' }}>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Category</th>
                  <th>Payment Method</th>
                  <th>Description</th>
                  <th style={{ textAlign: 'right' }}>Amount</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {transactions.map(tx => {
                  const isCredit = tx.type === 'Credit';
                  const method   = parseMethod(tx.description);
                  return (
                    <tr key={tx.id}>
                      <td style={{ color: '#64748b', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>{tx.date}</td>
                      <td>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: '3px',
                          fontWeight: 700, fontSize: '0.75rem',
                          color: isCredit ? '#10b981' : '#ef4444',
                          background: isCredit ? '#d1fae5' : '#fee2e2',
                          padding: '2px 8px', borderRadius: '20px',
                        }}>
                          {isCredit ? <ArrowUpRight size={11} /> : <ArrowDownLeft size={11} />}
                          {isCredit ? 'Inflow' : 'Outflow'}
                        </span>
                      </td>
                      <td style={{ fontWeight: 600, fontSize: '0.83rem' }}>{tx.category}</td>
                      <td style={{ fontSize: '0.8rem', color: '#64748b' }}>{method}</td>
                      <td style={{ color: '#94a3b8', fontSize: '0.78rem', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {tx.description?.replace(/Method:[^|]+\|\s*/, '').replace('Note: ', '') || '—'}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 700, fontSize: '0.9rem', whiteSpace: 'nowrap',
                        color: isCredit ? '#059669' : '#dc2626' }}>
                        {isCredit ? '+' : '−'}{formatCurrency(tx.amount)}
                      </td>
                      <td>
                        <button
                          className="tab-icon-btn"
                          onClick={() => setDeletingTx(tx)}
                          title="Delete"
                          style={{ color: '#cbd5e1' }}
                          onMouseEnter={e => { e.currentTarget.style.background='#fef2f2'; e.currentTarget.style.borderColor='#fca5a5'; e.currentTarget.style.color='#ef4444'; }}
                          onMouseLeave={e => { e.currentTarget.style.background=''; e.currentTarget.style.borderColor=''; e.currentTarget.style.color='#cbd5e1'; }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="drawings-card-list">
            {transactions.map(tx => {
              const isCredit = tx.type === 'Credit';
              const method   = parseMethod(tx.description);
              const note     = tx.description?.replace(/Method:[^|]+\|\s*/, '').replace('Note: ', '') || '';
              return (
                <div key={tx.id} className="drawing-card">
                  {/* Top: name + amount */}
                  <div className="drawing-card-top">
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontFamily: "'Outfit', sans-serif", fontWeight: 700,
                        fontSize: '0.9rem', color: '#0b3d27',
                      }}>{tx.category}</div>
                      <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '2px' }}>{tx.date}</div>
                    </div>
                    <div style={{
                      fontFamily: "'Outfit', sans-serif",
                      fontWeight: 800, fontSize: '1rem',
                      color: isCredit ? '#059669' : '#dc2626',
                      whiteSpace: 'nowrap',
                    }}>
                      {isCredit ? '+' : '−'}{formatCurrency(tx.amount)}
                    </div>
                  </div>

                  {/* Meta row */}
                  <div className="drawing-card-meta">
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: '3px',
                      fontWeight: 700, fontSize: '0.7rem',
                      color: isCredit ? '#10b981' : '#ef4444',
                      background: isCredit ? '#d1fae5' : '#fee2e2',
                      padding: '2px 7px', borderRadius: '20px',
                    }}>
                      {isCredit ? <ArrowUpRight size={10} /> : <ArrowDownLeft size={10} />}
                      {isCredit ? 'Inflow' : 'Outflow'}
                    </span>
                    <span className="drawing-card-tag">{method}</span>
                  </div>

                  {note && (
                    <div className="drawing-card-desc">{note}</div>
                  )}

                  {/* Actions */}
                  <div className="drawing-card-actions">
                    <button
                      className="tab-icon-btn"
                      onClick={() => setDeletingTx(tx)}
                      title="Delete"
                      style={{ flex: 1, height: '36px', color: '#ef4444', borderColor: '#fca5a5', background: '#fef2f2' }}
                    >
                      <Trash2 size={14} />
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, marginLeft: '4px' }}>Delete</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* ════════════════════════════════
          Delete Confirm Modal
      ════════════════════════════════ */}
      {deletingTx && createPortal(
        <div
          className="tab-modal-overlay"
          onClick={() => !deleteLoading && setDeletingTx(null)}
        >
          <div
            className="tab-modal"
            style={{ maxWidth: '400px' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="tab-modal-head">
              <span className="tab-modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertTriangle size={17} style={{ color: '#ef4444' }} />
                Delete Transaction?
              </span>
              <button className="tab-modal-close" onClick={() => setDeletingTx(null)} disabled={deleteLoading}>&times;</button>
            </div>
            <div className="tab-modal-body" style={{ paddingTop: '1rem' }}>
              <p style={{ fontSize: '0.875rem', color: '#475569', lineHeight: 1.6, margin: 0 }}>
                You're about to permanently delete{' '}
                <strong style={{ color: '#0f172a' }}>{deletingTx.category}</strong>{' '}
                of{' '}
                <strong style={{ color: deletingTx.type === 'Credit' ? '#059669' : '#dc2626' }}>
                  {formatCurrency(deletingTx.amount)}
                </strong>{' '}
                on <strong>{deletingTx.date}</strong>.
                This cannot be undone.
              </p>
            </div>
            <div className="tab-modal-foot">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setDeletingTx(null)}
                disabled={deleteLoading}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={deleteLoading}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '6px',
                  padding: '0.55rem 1.1rem',
                  background: '#ef4444', color: '#fff',
                  border: 'none', borderRadius: '9px',
                  fontSize: '0.85rem', fontWeight: 600,
                  fontFamily: 'Inter, sans-serif',
                  cursor: deleteLoading ? 'not-allowed' : 'pointer',
                  opacity: deleteLoading ? 0.7 : 1,
                }}
              >
                {deleteLoading
                  ? <><Loader2 size={14} className="db-spin" /> Deleting…</>
                  : <><Trash2 size={14} /> Yes, Delete</>
                }
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ════════════════════════════════
          Record Transaction Modal
      ════════════════════════════════ */}
      {showModal && createPortal(
        <div
          className="tab-modal-overlay"
          onClick={e => { if (e.target === e.currentTarget) setShowModal(false); }}
        >
          <div className="tab-modal" onClick={e => e.stopPropagation()}>
            <div className="tab-modal-head">
              <span className="tab-modal-title">Record Transaction</span>
              <button className="tab-modal-close" onClick={() => setShowModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
              <div className="tab-modal-body">

                {/* Type + Amount */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="form-group">
                    <label>Transaction Type</label>
                    <select
                      value={newTx.type}
                      onChange={e => handleTypeChange(e.target.value)}
                      className="input-field"
                    >
                      <option value="Credit">Credit (Inflow)</option>
                      <option value="Debit">Debit (Outflow)</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Amount (₹)</label>
                    <input
                      type="number" required min="1"
                      value={newTx.amount}
                      onChange={e => setNewTx({ ...newTx, amount: e.target.value })}
                      className="input-field"
                      placeholder="e.g. 15000"
                    />
                  </div>
                </div>

                {/* Category */}
                <div className="form-group">
                  <label>Category</label>
                  <select
                    value={newTx.category}
                    onChange={e => setNewTx({ ...newTx, category: e.target.value })}
                    className="input-field"
                  >
                    {(newTx.type === 'Credit' ? CREDIT_CATS : DEBIT_CATS).map(c => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </div>

                {/* Payment Method */}
                <div className="form-group">
                  <label>Payment Method</label>
                  <select
                    value={newTx.method}
                    onChange={e => setNewTx({ ...newTx, method: e.target.value })}
                    className="input-field"
                  >
                    {PAY_METHODS.map(m => <option key={m}>{m}</option>)}
                  </select>
                </div>

                {/* Description */}
                <div className="form-group">
                  <label>Description / Note</label>
                  <input
                    type="text" required
                    value={newTx.description}
                    onChange={e => setNewTx({ ...newTx, description: e.target.value })}
                    className="input-field"
                    placeholder="e.g. Milestone 1 payment received"
                  />
                </div>

              </div>
              <div className="tab-modal-foot">
                <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn-primary">Record</button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}