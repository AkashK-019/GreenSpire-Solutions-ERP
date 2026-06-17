import { useState, useEffect } from 'react';
import { calculateGST, formatCurrency } from '../../utils/helpers';
import { Plus, Download, MessageSquare, Printer, Loader2 } from 'lucide-react';
import { supabase } from '../../supabase';

export default function TabInvoices({ project }) {
  const [loading,    setLoading]    = useState(true);
  const [invoices,   setInvoices]   = useState([]);
  const [showModal,  setShowModal]  = useState(false);
  const [newInv, setNewInv] = useState({ type: 'Consultancy Invoice', amount: '', gstPercent: 18, due_date: '' });

  useEffect(() => { fetchInvoices(); }, [project.id]);

  const fetchInvoices = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('invoices')
        .select('*').eq('project_id', project.id).order('created_at', { ascending: false });
      if (error) throw error;
      setInvoices(data || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      const gst = calculateGST(Number(newInv.amount), newInv.gstPercent);
      const invNum = `INV-${project.name.slice(0,3).toUpperCase()}-${Date.now().toString().slice(-4)}`;
      const { error } = await supabase.from('invoices').insert([{
        project_id:  project.id,
        invoice_number: invNum,
        amount:      gst.base,
        gst_percent: newInv.gstPercent,
        gst_amount:  gst.gstAmount,
        total_amount: gst.total,
        due_date:    newInv.due_date || new Date(Date.now() + 15*24*60*60*1000).toISOString().split('T')[0],
        status:      'Unpaid'
      }]);
      if (error) throw error;
      setShowModal(false);
      setNewInv({ type: 'Consultancy Invoice', amount: '', gstPercent: 18, due_date: '' });
      fetchInvoices();
    } catch (err) { alert(err.message); }
  };

  const toggleStatus = async (id, current) => {
    const next = current === 'Paid' ? 'Unpaid' : 'Paid';
    try {
      const { error } = await supabase.from('invoices').update({ status: next }).eq('id', id);
      if (error) throw error;
      fetchInvoices();
    } catch (err) { console.error(err); }
  };

  const waLink = (inv) => {
    const msg = `Hello ${project.client_name}, payment reminder for Invoice ${inv.invoice_number} of ${formatCurrency(inv.total_amount)} due on ${inv.due_date}. Please clear the amount. Thank you.`;
    return `https://wa.me/?text=${encodeURIComponent(msg)}`;
  };

  const totalUnpaid = invoices.filter(i => i.status !== 'Paid').reduce((s, i) => s + Number(i.total_amount), 0);

  const gstPreview = calculateGST(Number(newInv.amount) || 0, newInv.gstPercent);

  return (
    <div className="animate-fade">
      <div className="tab-page-head">
        <div>
          <h2 className="tab-page-title">Invoices & Billing</h2>
          <p className="tab-page-sub">Generate tax invoices, track payments and send reminders.</p>
        </div>
        <button className="pj-add-btn" onClick={() => setShowModal(true)}>
          <Plus size={15} /> Create Invoice
        </button>
      </div>

      {totalUnpaid > 0 && (
        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '9px', padding: '0.75rem 1rem', marginBottom: '1.25rem', fontSize: '0.82rem', color: '#92400e', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontWeight: 700 }}>Pending Receivables:</span> {formatCurrency(totalUnpaid)} unpaid
        </div>
      )}

      {loading ? (
        <div className="tab-empty"><Loader2 size={20} className="db-spin" style={{ color: '#10b981' }} /></div>
      ) : invoices.length === 0 ? (
        <div className="tab-empty">No invoices created yet.</div>
      ) : (
        <div className="tab-table-wrap">
          <table className="tab-table">
            <thead>
              <tr>
                <th>Invoice No.</th>
                <th>Basic Amount</th>
                <th>GST</th>
                <th>Total</th>
                <th>Due Date</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map(inv => (
                <tr key={inv.id}>
                  <td style={{ fontWeight: 700, color: '#0b3d27', fontSize: '0.82rem' }}>{inv.invoice_number}</td>
                  <td>{formatCurrency(inv.amount)}</td>
                  <td style={{ color: '#64748b' }}>{formatCurrency(inv.gst_amount)}</td>
                  <td style={{ fontWeight: 700 }}>{formatCurrency(inv.total_amount)}</td>
                  <td style={{ color: '#64748b', fontSize: '0.82rem' }}>{inv.due_date}</td>
                  <td>
                    <span onClick={() => toggleStatus(inv.id, inv.status)} title="Click to toggle"
                      className={`tab-badge ${inv.status === 'Paid' ? 'tab-badge-green' : 'tab-badge-red'}`}
                      style={{ cursor: 'pointer' }}>
                      {inv.status}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button className="tab-icon-btn" title="Print"><Printer size={13} /></button>
                      <button className="tab-icon-btn" title="Download"><Download size={13} /></button>
                      {inv.status !== 'Paid' && (
                        <a href={waLink(inv)} target="_blank" rel="noopener noreferrer"
                          className="tab-icon-btn" title="WhatsApp reminder" style={{ color: '#25D366', textDecoration: 'none' }}>
                          <MessageSquare size={13} />
                        </a>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="tab-modal-overlay">
          <div className="tab-modal">
            <div className="tab-modal-head">
              <span className="tab-modal-title">Create Tax Invoice</span>
              <button className="tab-modal-close" onClick={() => setShowModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleCreate}>
              <div className="tab-modal-body">
                <div className="form-group">
                  <label>Invoice Type</label>
                  <select value={newInv.type} onChange={e => setNewInv({...newInv, type: e.target.value})} className="input-field">
                    {['Consultancy Invoice','Design Invoice','Site Supervision Invoice','Material Invoice'].map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div className="tab-split-half" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="form-group">
                    <label>Basic Amount (₹)</label>
                    <input type="number" required value={newInv.amount}
                      onChange={e => setNewInv({...newInv, amount: e.target.value})}
                      className="input-field" placeholder="e.g. 50000" />
                  </div>
                  <div className="form-group">
                    <label>GST %</label>
                    <input type="number" value={newInv.gstPercent}
                      onChange={e => setNewInv({...newInv, gstPercent: Number(e.target.value)})}
                      className="input-field" />
                  </div>
                </div>
                <div className="form-group">
                  <label>Due Date</label>
                  <input type="date" required value={newInv.due_date}
                    onChange={e => setNewInv({...newInv, due_date: e.target.value})} className="input-field" />
                </div>
                {/* Preview */}
                <div style={{ background: '#f8fafc', border: '1px solid #e9eef3', borderRadius: '9px', padding: '0.9rem', fontSize: '0.83rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ color: '#64748b' }}>Subtotal</span>
                    <span style={{ fontWeight: 600 }}>{formatCurrency(gstPreview.base)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ color: '#64748b' }}>GST ({newInv.gstPercent}%)</span>
                    <span style={{ fontWeight: 600 }}>{formatCurrency(gstPreview.gstAmount)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #e9eef3', paddingTop: '8px' }}>
                    <span style={{ fontWeight: 700, color: '#0b3d27' }}>Total Billable</span>
                    <span style={{ fontWeight: 800, color: '#0b3d27', fontSize: '0.95rem' }}>{formatCurrency(gstPreview.total)}</span>
                  </div>
                </div>
              </div>
              <div className="tab-modal-foot">
                <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn-primary">Generate Invoice</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}