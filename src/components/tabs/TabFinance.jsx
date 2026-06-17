import { useState, useEffect } from 'react';
import { formatCurrency } from '../../utils/helpers';
import { ArrowUpRight, ArrowDownLeft, Plus, Loader2 } from 'lucide-react';
import { supabase } from '../../supabase';

export default function TabFinance({ project }) {
  const [loading, setLoading]     = useState(true);
  const [transactions, setTxs]    = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [newTx, setNewTx] = useState({ type: 'Credit', category: 'Client Payments', amount: '', description: '' });

  useEffect(() => { fetchTxs(); }, [project.id]);

  const fetchTxs = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('finance_ledger')
        .select('*').eq('project_id', project.id).order('date', { ascending: false });
      if (error) throw error;
      setTxs(data || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const credits  = transactions.filter(t => t.type === 'Credit').reduce((s, t) => s + Number(t.amount), 0);
  const debits   = transactions.filter(t => t.type === 'Debit').reduce((s, t) => s + Number(t.amount), 0);
  const balance  = credits - debits;

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const { error } = await supabase.from('finance_ledger').insert([{
        project_id:  project.id,
        type:        newTx.type,
        category:    newTx.category,
        amount:      Number(newTx.amount) || 0,
        date:        new Date().toISOString().split('T')[0],
        description: newTx.description
      }]);
      if (error) throw error;
      setShowModal(false);
      setNewTx({ type: 'Credit', category: 'Client Payments', amount: '', description: '' });
      fetchTxs();
    } catch (err) { alert(err.message); }
  };

  const creditCategories = ['Client Payments', 'Advance Received', 'Extra Work Charges'];
  const debitCategories  = ['Staff Salary', 'Site Expense', 'Material Purchase', 'Transport', 'Vendor Payment', 'Printing', 'Miscellaneous'];

  return (
    <div className="animate-fade">
      <div className="tab-page-head">
        <div>
          <h2 className="tab-page-title">Project Ledger</h2>
          <p className="tab-page-sub">Track project cashflows, client payments, and site expenses.</p>
        </div>
        <button className="pj-add-btn" onClick={() => setShowModal(true)}>
          <Plus size={15} /> Record Transaction
        </button>
      </div>

      {/* KPI row */}
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
          <div className="tab-kpi-value" style={{ color: balance >= 0 ? '#0b3d27' : '#ef4444' }}>{formatCurrency(balance)}</div>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="tab-empty"><Loader2 size={20} className="db-spin" style={{ color: '#10b981' }} /></div>
      ) : transactions.length === 0 ? (
        <div className="tab-empty">No transactions recorded for this project.</div>
      ) : (
        <div className="tab-table-wrap">
          <table className="tab-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Category</th>
                <th>Description</th>
                <th style={{ textAlign: 'right' }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map(tx => (
                <tr key={tx.id}>
                  <td style={{ color: '#64748b', fontSize: '0.8rem' }}>{tx.date}</td>
                  <td>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: 700, fontSize: '0.78rem',
                      color: tx.type === 'Credit' ? '#10b981' : '#ef4444' }}>
                      {tx.type === 'Credit' ? <ArrowUpRight size={13} /> : <ArrowDownLeft size={13} />}
                      {tx.type === 'Credit' ? 'Credit' : 'Debit'}
                    </span>
                  </td>
                  <td style={{ fontWeight: 600 }}>{tx.category}</td>
                  <td style={{ color: '#64748b', fontSize: '0.82rem' }}>{tx.description}</td>
                  <td style={{ textAlign: 'right', fontWeight: 700, color: tx.type === 'Credit' ? '#10b981' : '#ef4444' }}>
                    {tx.type === 'Credit' ? '+' : '-'}{formatCurrency(tx.amount)}
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
              <span className="tab-modal-title">Record Transaction</span>
              <button className="tab-modal-close" onClick={() => setShowModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="tab-modal-body">
                <div className="tab-split-half" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="form-group">
                    <label>Transaction Type</label>
                    <select value={newTx.type}
                      onChange={e => setNewTx({ ...newTx, type: e.target.value, category: e.target.value === 'Credit' ? 'Client Payments' : 'Staff Salary' })}
                      className="input-field">
                      <option value="Credit">Credit (Inflow)</option>
                      <option value="Debit">Debit (Outflow)</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Amount (₹)</label>
                    <input type="number" required value={newTx.amount}
                      onChange={e => setNewTx({...newTx, amount: e.target.value})}
                      className="input-field" placeholder="e.g. 15000" />
                  </div>
                </div>
                <div className="form-group">
                  <label>Category</label>
                  <select value={newTx.category} onChange={e => setNewTx({...newTx, category: e.target.value})} className="input-field">
                    {(newTx.type === 'Credit' ? creditCategories : debitCategories).map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Description</label>
                  <input type="text" required value={newTx.description}
                    onChange={e => setNewTx({...newTx, description: e.target.value})}
                    className="input-field" placeholder="e.g. Milestone 1 payment received" />
                </div>
              </div>
              <div className="tab-modal-foot">
                <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn-primary">Record</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}