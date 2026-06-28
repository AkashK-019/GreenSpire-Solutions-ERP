import { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import {
  DollarSign, Plus, Search, ArrowUpRight, ArrowDownRight,
  Landmark, Loader2, Trash2, AlertTriangle
} from 'lucide-react';
import { supabase } from '../supabase';
import '../styles/Finance.css';

export default function Finance() {
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState([]);
  const [projects, setProjects] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('All');
  const [showAddTxModal, setShowAddTxModal] = useState(false);
  const [deletingId, setDeletingId] = useState(null);   // tx to confirm-delete
  const [deleteLoading, setDeleteLoading] = useState(false);

  const [form, setForm] = useState({
    type: 'Income',
    amount: '',
    category: '',
    project_id: '',
    date: new Date().toISOString().split('T')[0],
    method: 'UPI',
    ref: ''
  });

  useEffect(() => { fetchLedgerData(); }, []);

  /* ── Fetch ── */
  const fetchLedgerData = async () => {
    setLoading(true);
    try {
      const { data: ledgerData, error: ledgerError } = await supabase
        .from('finance_ledger')
        .select(`*, projects(id, name)`)
        .order('date', { ascending: false });

      if (ledgerError) throw ledgerError;
      setTransactions(ledgerData || []);

      const { data: projData, error: projError } = await supabase
        .from('projects').select('id, name').order('name');

      if (projError) throw projError;
      setProjects(projData || []);
    } catch (err) {
      console.error('Error fetching finance ledger:', err);
    } finally {
      setLoading(false);
    }
  };

  /* ── Parse description ── */
  const parseDescription = (desc) => {
    if (!desc) return { method: 'N/A', ref: 'N/A', note: '' };
    if (desc.includes(' | ')) {
      const parts = desc.split(' | ');
      let method = 'N/A', ref = 'N/A', note = desc;
      parts.forEach(p => {
        if (p.startsWith('Method: ')) method = p.replace('Method: ', '');
        else if (p.startsWith('Ref: '))  ref    = p.replace('Ref: ', '');
        else if (p.startsWith('Note: ')) note   = p.replace('Note: ', '');
      });
      return { method, ref, note };
    }
    return { method: 'General', ref: 'N/A', note: desc };
  };

  /* ── Add transaction ── */
  const handleAddTx = async (e) => {
    e.preventDefault();
    try {
      const descriptionStr = `Method: ${form.method} | Ref: ${form.ref || 'N/A'} | Note: ${form.category}`;
      const dbType = form.type === 'Income' ? 'Credit' : 'Debit';

      const { error } = await supabase.from('finance_ledger').insert([{
        project_id:  form.project_id || null,
        type:        dbType,
        category:    form.category,
        amount:      Number(form.amount) || 0,
        date:        form.date,
        description: descriptionStr
      }]);

      if (error) throw error;

      setShowAddTxModal(false);
      setForm({
        type: 'Income', amount: '', category: '', project_id: '',
        date: new Date().toISOString().split('T')[0], method: 'UPI', ref: ''
      });
      fetchLedgerData();
    } catch (err) {
      console.error('Error recording transaction:', err);
      alert(err.message || 'Failed to record transaction');
    }
  };

  /* ── Delete transaction ── */
  const handleDeleteConfirm = async () => {
    if (!deletingId) return;
    setDeleteLoading(true);
    try {
      const { error } = await supabase
        .from('finance_ledger')
        .delete()
        .eq('id', deletingId);

      if (error) throw error;
      setDeletingId(null);
      fetchLedgerData();
    } catch (err) {
      console.error('Error deleting transaction:', err);
      alert(err.message || 'Failed to delete transaction');
    } finally {
      setDeleteLoading(false);
    }
  };

  /* ── Totals ── */
  const totalIncome  = transactions.filter(t => t.type === 'Credit').reduce((s, t) => s + Number(t.amount), 0);
  const totalExpense = transactions.filter(t => t.type === 'Debit').reduce((s, t) => s + Number(t.amount), 0);
  const netBalance   = totalIncome - totalExpense;

  /* ── Filter ── */
  const filtered = transactions.filter(t => {
    const parsed      = parseDescription(t.description);
    const projectName = t.projects?.name || 'General Overheads';
    const matchSearch =
      projectName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
      parsed.ref.toLowerCase().includes(searchTerm.toLowerCase()) ||
      parsed.method.toLowerCase().includes(searchTerm.toLowerCase());

    let matchType = typeFilter === 'All'
      || (typeFilter === 'Income'  && t.type === 'Credit')
      || (typeFilter === 'Expense' && t.type === 'Debit');

    return matchSearch && matchType;
  });

  /* ── Helper: short tx id ── */
  const shortId = (id) => `TX-${id.substring(0, 8).toUpperCase()}`;

  /* ── Tx being deleted (for modal text) ── */
  const deletingTx = transactions.find(t => t.id === deletingId);

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <Header title="Finance & Accounts" />

        <main className="main-content animate-fade">

          {/* ── Page Header ── */}
          <div className="projects-header-bar">
            <div>
              <h1>GreenSpire Accounts Ledger</h1>
              <p>Track cashflows, client payments, vendor settlements, and site operation costs.</p>
            </div>
            <button className="btn-primary" onClick={() => setShowAddTxModal(true)}>
              <Plus size={18} /> Record Transaction
            </button>
          </div>

          {/* ── Stat Cards ── */}
          <div className="fn-metrics">
            <div className="stat-card">
              <div className="fn-stat-icon income"><ArrowUpRight size={22} /></div>
              <div className="fn-stat-body">
                <div className="fn-stat-lbl">Total Inflow (Income)</div>
                <div className="fn-stat-val income">₹{totalIncome.toLocaleString('en-IN')}</div>
              </div>
            </div>
            <div className="stat-card">
              <div className="fn-stat-icon expense"><ArrowDownRight size={22} /></div>
              <div className="fn-stat-body">
                <div className="fn-stat-lbl">Total Outflow (Expenses)</div>
                <div className="fn-stat-val expense">₹{totalExpense.toLocaleString('en-IN')}</div>
              </div>
            </div>
            <div className="stat-card">
              <div className="fn-stat-icon balance"><Landmark size={22} /></div>
              <div className="fn-stat-body">
                <div className="fn-stat-lbl">Net Operational Profit</div>
                <div className="fn-stat-val balance">₹{netBalance.toLocaleString('en-IN')}</div>
              </div>
            </div>
          </div>

          {/* ── Toolbar ── */}
          <div className="fn-toolbar">
            <div className="fn-search-wrap">
              <Search size={16} className="fn-search-icon" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search transaction, category or project..."
                className="fn-search-input"
              />
            </div>
            <div className="fn-filters">
              {['All', 'Income', 'Expense'].map(type => (
                <button
                  key={type}
                  onClick={() => setTypeFilter(type)}
                  className={`fn-filter-btn ${typeFilter === type ? 'active' : ''}`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          {/* ── Ledger Table + Mobile Cards ── */}
          <div className="fn-table-wrap">
            {loading ? (
              <div className="fn-loading">
                <Loader2 className="db-spin" size={32} />
              </div>
            ) : (
              <>
                {/* ── Desktop / Tablet table ── */}
                <div className="fn-table-scroll">
                  <table className="fn-table">
                    <thead>
                      <tr>
                        <th>Transaction Details</th>
                        <th>Type</th>
                        <th>Project Reference</th>
                        <th>Amount (₹)</th>
                        <th>Date</th>
                        <th>Payment Details</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((tx) => {
                        const parsed   = parseDescription(tx.description);
                        const isIncome = tx.type === 'Credit';
                        return (
                          <tr key={tx.id}>
                            <td>
                              <div className="fn-tx-name">{tx.category}</div>
                              <div className="fn-tx-id">ID: {shortId(tx.id)}</div>
                            </td>
                            <td>
                              <span className={`fn-badge ${isIncome ? 'income' : 'expense'}`}>
                                {isIncome ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
                                {isIncome ? 'Inflow' : 'Outflow'}
                              </span>
                            </td>
                            <td className="fn-tx-project">
                              {tx.projects?.name || 'General Overheads'}
                            </td>
                            <td className={`fn-tx-amount ${isIncome ? 'income' : 'expense'}`}>
                              {isIncome ? '+' : '−'} ₹{Number(tx.amount).toLocaleString('en-IN')}
                            </td>
                            <td className="fn-tx-date">{tx.date}</td>
                            <td>
                              <div className="fn-tx-method">{parsed.method}</div>
                              <div className="fn-tx-ref">Ref: {parsed.ref}</div>
                            </td>
                            <td>
                              <button
                                className="fn-delete-btn"
                                onClick={() => setDeletingId(tx.id)}
                                title="Delete transaction"
                              >
                                <Trash2 size={14} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* ── Mobile card list ── */}
                <div className="fn-card-list">
                  {filtered.map((tx) => {
                    const parsed   = parseDescription(tx.description);
                    const isIncome = tx.type === 'Credit';
                    return (
                      <div key={tx.id} className="fn-tx-card">
                        <div className="fn-tx-card-left">
                          <div className="fn-tx-name">{tx.category}</div>
                          <div className="fn-tx-id">{shortId(tx.id)}</div>
                        </div>
                        <div className="fn-tx-card-right">
                          <div className={`fn-tx-amount ${isIncome ? 'income' : 'expense'}`}>
                            {isIncome ? '+' : '−'} ₹{Number(tx.amount).toLocaleString('en-IN')}
                          </div>
                          <span className={`fn-badge ${isIncome ? 'income' : 'expense'}`}>
                            {isIncome ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
                            {isIncome ? 'Inflow' : 'Outflow'}
                          </span>
                        </div>
                        <div className="fn-tx-card-meta">
                          <span className="fn-tx-card-label">{tx.projects?.name || 'General Overheads'}</span>
                          <span className="fn-tx-card-dot">·</span>
                          <span className="fn-tx-card-date">{tx.date}</span>
                          <span className="fn-tx-card-dot">·</span>
                          <span className="fn-tx-card-pay">{parsed.method} · Ref: {parsed.ref}</span>
                        </div>
                        <div className="fn-tx-card-actions">
                          <button
                            className="fn-delete-btn"
                            onClick={() => setDeletingId(tx.id)}
                            title="Delete transaction"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {!loading && filtered.length === 0 && (
              <div className="fn-empty">
                <DollarSign size={40} style={{ opacity: 0.4 }} />
                <p>No transactions matched filters.</p>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* ════════════════════════════════════════
          Delete Confirm Modal
      ════════════════════════════════════════ */}
      {deletingId && (
        <div className="modal-overlay" onClick={() => !deleteLoading && setDeletingId(null)}>
          <div className="confirm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="confirm-modal-icon">
              <AlertTriangle size={24} />
            </div>
            <div>
              <h3>Delete Transaction?</h3>
              <p>
                You're about to permanently delete{' '}
                <strong>{deletingTx?.category}</strong>{' '}
                (₹{Number(deletingTx?.amount || 0).toLocaleString('en-IN')}).
                This action cannot be undone.
              </p>
            </div>
            <div className="confirm-modal-actions">
              <button
                className="btn-secondary"
                onClick={() => setDeletingId(null)}
                disabled={deleteLoading}
              >
                Cancel
              </button>
              <button
                className="btn-danger"
                onClick={handleDeleteConfirm}
                disabled={deleteLoading}
              >
                {deleteLoading ? <Loader2 size={15} className="db-spin" /> : <Trash2 size={15} />}
                {deleteLoading ? 'Deleting…' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════
          Record Transaction Modal
      ════════════════════════════════════════ */}
      {showAddTxModal && (
        <div className="modal-overlay">
          <div className="modal-content animate-fade">
            <div className="modal-header">
              <h3>
                <DollarSign size={20} style={{ color: '#10b981' }} />
                Record Ledger Entry
              </h3>
              <button
                className="modal-close-btn"
                onClick={() => setShowAddTxModal(false)}
                aria-label="Close"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleAddTx}>
              <div className="modal-body">
                <div className="modal-form-grid">
                  <div className="form-group">
                    <label>Transaction Type</label>
                    <select
                      value={form.type}
                      onChange={(e) => setForm({ ...form, type: e.target.value })}
                      className="input-field"
                    >
                      <option value="Income">Income (Customer Inflow)</option>
                      <option value="Expense">Expense (Vendor / Materials / Labour)</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Amount (₹)</label>
                    <input
                      type="number"
                      required
                      value={form.amount}
                      onChange={(e) => setForm({ ...form, amount: e.target.value })}
                      className="input-field"
                      placeholder="e.g. 150000"
                    />
                  </div>

                  <div className="form-group">
                    <label>Description / Category</label>
                    <input
                      type="text"
                      required
                      value={form.category}
                      onChange={(e) => setForm({ ...form, category: e.target.value })}
                      className="input-field"
                      placeholder="e.g. Plant Purchases, Milestone payment"
                    />
                  </div>

                  <div className="form-group">
                    <label>Project Association</label>
                    <select
                      value={form.project_id}
                      onChange={(e) => setForm({ ...form, project_id: e.target.value })}
                      className="input-field"
                    >
                      <option value="">General Overheads (None)</option>
                      {projects.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="modal-form-2col">
                    <div className="form-group">
                      <label>Transaction Date</label>
                      <input
                        type="date"
                        required
                        value={form.date}
                        onChange={(e) => setForm({ ...form, date: e.target.value })}
                        className="input-field"
                      />
                    </div>
                    <div className="form-group">
                      <label>Payment Method</label>
                      <select
                        value={form.method}
                        onChange={(e) => setForm({ ...form, method: e.target.value })}
                        className="input-field"
                      >
                        <option value="UPI">UPI (GPay / PhonePe)</option>
                        <option value="NEFT">NEFT / RTGS</option>
                        <option value="Bank Transfer">Bank Transfer</option>
                        <option value="Cheque">Cheque</option>
                        <option value="Cash">Cash</option>
                      </select>
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Reference Code / Transaction ID</label>
                    <input
                      type="text"
                      value={form.ref}
                      onChange={(e) => setForm({ ...form, ref: e.target.value })}
                      className="input-field"
                      placeholder="e.g. UPI882019483 or Check #889"
                    />
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setShowAddTxModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Record Transaction
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}