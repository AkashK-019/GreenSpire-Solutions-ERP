import { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import { Users, Plus, Search, IndianRupee, Calendar, Phone, Loader2, ShieldCheck, Landmark } from 'lucide-react';
import { supabase } from '../supabase';
import '../index.css';

const ROLES = ['All', 'Supervisor', 'Gardener', 'Labour', 'Irrigator', 'Plantation Expert', 'Helper'];

export default function Labour() {
  const [loading, setLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showPayModal, setShowPayModal] = useState(false);
  const [activeTab, setActiveTab] = useState('workers');

  const [workers, setWorkers] = useState([]);
  const [payments, setPayments] = useState([]);
  const [projects, setProjects] = useState([]);
  const [rawWorkers, setRawWorkers] = useState([]);

  // Form states
  const [form, setForm] = useState({ 
    name: '', 
    role: 'Labour', 
    phone: '', 
    daily_wage: '', 
    aadhaar_number: '', 
    bank_details: '' 
  });
  const [payForm, setPayForm] = useState({ 
    labour_id: '', 
    amount: '', 
    date: new Date().toISOString().split('T')[0], 
    mode: 'Cash', 
    project_id: '', 
    note: '' 
  });

  useEffect(() => {
    fetchLabourData();
  }, []);

  const fetchLabourData = async () => {
    setLoading(true);
    try {
      const { data: workersData, error: workersError } = await supabase
        .from('labour_master')
        .select('*');

      if (workersError) throw workersError;
      setRawWorkers(workersData || []);

      const { data: attendanceData, error: attendanceError } = await supabase
        .from('labour_attendance')
        .select(`
          *,
          projects (
            id,
            name
          )
        `);

      if (attendanceError) throw attendanceError;

      const { data: paymentsData, error: paymentsError } = await supabase
        .from('labour_payments')
        .select(`
          *,
          projects (
            id,
            name
          ),
          labour_master (
            id,
            name
          )
        `)
        .order('payment_date', { ascending: false });

      if (paymentsError) throw paymentsError;

      const { data: projectsData, error: projectsError } = await supabase
        .from('projects')
        .select('id, name')
        .order('name');

      if (projectsError) throw projectsError;

      setProjects(projectsData || []);

      // Calculate days worked and pending wages for each worker
      const compiled = (workersData || []).map(w => {
        // Attendance days where status is 'Present'
        const wAtt = (attendanceData || []).filter(a => a.labour_id === w.id);
        const daysPresent = wAtt.filter(a => a.status === 'Present').length;

        // Find latest project name they worked on
        let lastProject = 'Not Assigned';
        if (wAtt.length > 0) {
          const sortedAtt = [...wAtt].sort((a, b) => new Date(b.attendance_date) - new Date(a.attendance_date));
          lastProject = sortedAtt[0].projects?.name || 'General';
        }

        // Payments made
        const wPayments = (paymentsData || []).filter(p => p.labour_id === w.id);
        const totalPaid = wPayments.reduce((acc, curr) => acc + Number(curr.amount_paid), 0);

        // Earnings: present days * daily wage
        const totalEarned = daysPresent * Number(w.daily_wage);
        const pending = Math.max(0, totalEarned - totalPaid);

        // Status check: active if attended in the last 14 days
        let status = 'Inactive';
        if (wAtt.length > 0) {
          const sortedAtt = [...wAtt].sort((a, b) => new Date(b.attendance_date) - new Date(a.attendance_date));
          const lastDate = new Date(sortedAtt[0].attendance_date);
          const diffDays = (new Date() - lastDate) / (1000 * 60 * 60 * 24);
          if (diffDays <= 14) {
            status = 'Active';
          }
        } else {
          status = 'Active'; // Treat newly created as Active
        }

        return {
          id: w.id,
          name: w.name,
          role: w.skill_type || 'Labour',
          phone: w.mobile || 'N/A',
          daily_wage: Number(w.daily_wage) || 0,
          days_worked: daysPresent,
          pending: pending,
          project: lastProject,
          status: status
        };
      });

      setWorkers(compiled);

      const formattedPayments = (paymentsData || []).map(p => ({
        id: p.id,
        worker: p.labour_master?.name || 'General Labor',
        amount: Number(p.amount_paid) || 0,
        date: p.payment_date,
        mode: p.payment_mode || 'Cash',
        project: p.projects?.name || 'General Overheads',
        note: p.remarks || ''
      }));
      setPayments(formattedPayments);

    } catch (err) {
      console.error('Error loading labour analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddWorker = async (e) => {
    e.preventDefault();
    try {
      const { error } = await supabase
        .from('labour_master')
        .insert([{
          name: form.name,
          mobile: form.phone || null,
          skill_type: form.role,
          daily_wage: Number(form.daily_wage) || 0,
          aadhaar_number: form.aadhaar_number || null,
          bank_details: form.bank_details || null
        }]);

      if (error) throw error;

      setShowAddModal(false);
      setForm({ name: '', role: 'Labour', phone: '', daily_wage: '', aadhaar_number: '', bank_details: '' });
      fetchLabourData();
    } catch (err) {
      console.error('Error adding worker:', err);
      alert(err.message || 'Failed to add worker');
    }
  };

  const handleAddPayment = async (e) => {
    e.preventDefault();
    try {
      const { error } = await supabase
        .from('labour_payments')
        .insert([{
          labour_id: payForm.labour_id,
          project_id: payForm.project_id || null,
          payment_date: payForm.date,
          amount_paid: Number(payForm.amount) || 0,
          payment_mode: payForm.mode,
          remarks: payForm.note || ''
        }]);

      if (error) throw error;

      setShowPayModal(false);
      setPayForm({ labour_id: '', amount: '', date: new Date().toISOString().split('T')[0], mode: 'Cash', project_id: '', note: '' });
      fetchLabourData();
    } catch (err) {
      console.error('Error recording labor payment:', err);
      alert(err.message || 'Failed to record payment');
    }
  };

  const filteredWorkers = workers.filter(w => {
    const matchSearch = w.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      w.project.toLowerCase().includes(searchTerm.toLowerCase());
    const matchRole = roleFilter === 'All' || w.role === roleFilter;
    return matchSearch && matchRole;
  });

  const totalPending = workers.reduce((s, w) => s + w.pending, 0);
  const activeWorkersCount = workers.filter(w => w.status === 'Active').length;
  const totalPaid = payments.reduce((s, p) => s + p.amount, 0);

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Header title="Labour" />
        <main className="main-content animate-fade">
          {/* Page Header */}
          <div className="projects-header-bar" style={{ marginBottom: '1.5rem' }}>
            <div>
              <h1 style={{ fontSize: '1.75rem', fontWeight: 800 }}>Labour Management</h1>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Track workers, attendance, wages, and payment records.</p>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button className="btn-secondary" onClick={() => setShowPayModal(true)}>
                <IndianRupee size={16} /> Add Payment
              </button>
              <button className="btn-primary" onClick={() => setShowAddModal(true)}>
                <Plus size={18} /> Add Worker
              </button>
            </div>
          </div>

          {/* Summary Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
            {[
              { label: 'Active Workers', val: activeWorkersCount, icon: <Users size={20} />, color: '#10b981' },
              { label: 'Total Pending Wages', val: `₹${totalPending.toLocaleString()}`, icon: <IndianRupee size={20} />, color: '#dc2626' },
              { label: 'Total Paid History', val: `₹${totalPaid.toLocaleString()}`, icon: <IndianRupee size={20} />, color: '#0284c7' }
            ].map(s => (
              <div key={s.label} className="stat-card" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: `${s.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: s.color }}>{s.icon}</div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{s.label}</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: s.color }}>{s.val}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Tab Toggle */}
          <div style={{ display: 'flex', gap: '0', background: '#f1f5f9', borderRadius: '10px', padding: '4px', marginBottom: '1.5rem', width: 'fit-content' }}>
            {['workers', 'payments'].map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)} style={{ padding: '0.5rem 1.2rem', borderRadius: '8px', border: 'none', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer', background: activeTab === tab ? 'white' : 'transparent', color: activeTab === tab ? 'var(--primary)' : 'var(--text-muted)', boxShadow: activeTab === tab ? '0 1px 4px rgba(0,0,0,0.1)' : 'none', transition: 'all 0.2s' }}>
                {tab === 'workers' ? '👷 Workers' : '💳 Payment Log'}
              </button>
            ))}
          </div>

          {activeTab === 'workers' && (
            <>
              {/* Search + Filter */}
              <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <div style={{ position: 'relative', flex: 1, maxWidth: '360px' }}>
                  <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search worker or project..." className="input-field" style={{ paddingLeft: '2.5rem' }} />
                </div>
                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                  {ROLES.map(r => (
                    <button key={r} onClick={() => setRoleFilter(r)} style={{ padding: '0.35rem 0.8rem', borderRadius: '20px', border: '1px solid var(--border)', backgroundColor: roleFilter === r ? 'var(--primary)' : 'white', color: roleFilter === r ? 'white' : 'var(--text)', fontSize: '0.82rem', fontWeight: 500, cursor: 'pointer' }}>{r}</button>
                  ))}
                </div>
              </div>

              {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
                  <Loader2 className="db-spin" size={32} />
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
                  {filteredWorkers.map(w => (
                    <div key={w.id} className="stat-card animate-fade" style={{ padding: '1.25rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '1rem' }}>{w.name}</div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--primary)', fontWeight: 600 }}>{w.role}</div>
                        </div>
                        <span style={{ padding: '0.2rem 0.6rem', borderRadius: '20px', fontSize: '0.72rem', fontWeight: 700, backgroundColor: w.status === 'Active' ? '#d1fae5' : '#fee2e2', color: w.status === 'Active' ? '#059669' : '#dc2626' }}>{w.status}</span>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                        <span><Phone size={12} style={{ verticalAlign: 'middle', marginRight: '4px' }} />{w.phone}</span>
                        <span><Calendar size={12} style={{ verticalAlign: 'middle', marginRight: '4px' }} />{w.days_worked} present</span>
                        <span>Wage: ₹{w.daily_wage.toLocaleString()} / day</span>
                        <span style={{ color: w.pending > 0 ? '#dc2626' : '#10b981', fontWeight: 600 }}>Pending: ₹{w.pending.toLocaleString()}</span>
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', padding: '0.5rem', background: '#f8fafc', borderRadius: '8px' }}>
                        📍 Last Seen: {w.project}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {activeTab === 'payments' && (
            <div style={{ background: 'white', borderRadius: '14px', border: '1px solid var(--border)', overflow: 'hidden' }}>
              {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
                  <Loader2 className="db-spin" size={32} />
                </div>
              ) : (
                <div className="table-responsive">
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f8fafc' }}>
                        {['Worker', 'Amount', 'Date', 'Mode', 'Project', 'Note'].map(h => (
                          <th key={h} style={{ padding: '0.875rem 1rem', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {payments.map((p, idx) => (
                        <tr key={p.id} style={{ borderBottom: '1px solid #f1f5f9', background: idx % 2 === 0 ? 'white' : '#fafbfc' }}>
                          <td style={{ padding: '0.875rem 1rem', fontWeight: 600 }}>{p.worker}</td>
                          <td style={{ padding: '0.875rem 1rem', color: '#10b981', fontWeight: 700 }}>₹{p.amount.toLocaleString()}</td>
                          <td style={{ padding: '0.875rem 1rem', color: 'var(--text-muted)' }}>{p.date}</td>
                          <td style={{ padding: '0.875rem 1rem' }}>
                            <span style={{ padding: '0.2rem 0.6rem', borderRadius: '20px', fontSize: '0.72rem', fontWeight: 700, background: '#eff6ff', color: '#0284c7' }}>{p.mode}</span>
                          </td>
                          <td style={{ padding: '0.875rem 1rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>{p.project}</td>
                          <td style={{ padding: '0.875rem 1rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>{p.note}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* Add Worker Modal */}
      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal-content animate-fade" style={{ maxWidth: '540px' }}>
            <div className="modal-header">
              <h3 style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Plus size={20} style={{ color: 'var(--primary)' }} /> Add Roster Worker
              </h3>
              <button onClick={() => setShowAddModal(false)} style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: 'var(--text-muted)' }}>&times;</button>
            </div>
            <form onSubmit={handleAddWorker}>
              <div className="modal-body modal-form-grid">
                <div className="form-group">
                  <label>Full Name</label>
                  <input type="text" required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="input-field" placeholder="e.g. Ramesh Patel" />
                </div>
                <div className="form-group">
                  <label>Role</label>
                  <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} className="input-field">
                    {ROLES.slice(1).map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Phone Number</label>
                  <input type="tel" required value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className="input-field" placeholder="e.g. 9876543210" />
                </div>
                <div className="form-group">
                  <label>Daily Wage Rate (₹)</label>
                  <input type="number" required value={form.daily_wage} onChange={e => setForm({ ...form, daily_wage: e.target.value })} className="input-field" placeholder="e.g. 500" />
                </div>
                <div className="form-group" style={{ gridColumn: '1/-1' }}>
                  <label>Aadhaar Card Number (Optional)</label>
                  <input type="text" value={form.aadhaar_number} onChange={e => setForm({ ...form, aadhaar_number: e.target.value })} className="input-field" placeholder="e.g. 1234 5678 9012" />
                </div>
                <div className="form-group" style={{ gridColumn: '1/-1' }}>
                  <label>Bank Account & IFSC Details (Optional)</label>
                  <textarea value={form.bank_details} onChange={e => setForm({ ...form, bank_details: e.target.value })} className="input-field" style={{ minHeight: '60px' }} placeholder="e.g. HDFC SB A/c 501234567, IFSC HDFC0000123" />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setShowAddModal(false)}>Cancel</button>
                <button type="submit" className="btn-primary">Add Worker</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Payment Modal */}
      {showPayModal && (
        <div className="modal-overlay">
          <div className="modal-content animate-fade" style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h3 style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <IndianRupee size={20} style={{ color: 'var(--primary)' }} /> Record Worker Payment
              </h3>
              <button onClick={() => setShowPayModal(false)} style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: 'var(--text-muted)' }}>&times;</button>
            </div>
            <form onSubmit={handleAddPayment}>
              <div className="modal-body modal-form-grid" style={{ gridTemplateColumns: '1fr' }}>
                <div className="form-group">
                  <label>Select Worker</label>
                  <select 
                    required 
                    value={payForm.labour_id} 
                    onChange={e => setPayForm({ ...payForm, labour_id: e.target.value })} 
                    className="input-field"
                  >
                    <option value="">-- Choose Worker --</option>
                    {rawWorkers.map(w => (
                      <option key={w.id} value={w.id}>{w.name} ({w.skill_type || 'Laborer'})</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Amount Paid (₹)</label>
                  <input type="number" required value={payForm.amount} onChange={e => setPayForm({ ...payForm, amount: e.target.value })} className="input-field" placeholder="e.g. 3500" />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="form-group">
                    <label>Payment Date</label>
                    <input type="date" required value={payForm.date} onChange={e => setPayForm({ ...payForm, date: e.target.value })} className="input-field" />
                  </div>
                  <div className="form-group">
                    <label>Payment Mode</label>
                    <select value={payForm.mode} onChange={e => setPayForm({ ...payForm, mode: e.target.value })} className="input-field">
                      <option value="Cash">Cash</option>
                      <option value="UPI">UPI</option>
                      <option value="Bank Transfer">Bank Transfer</option>
                      <option value="Cheque">Cheque</option>
                    </select>
                  </div>
                </div>
                <div className="form-group">
                  <label>Project Association</label>
                  <select 
                    value={payForm.project_id} 
                    onChange={e => setPayForm({ ...payForm, project_id: e.target.value })} 
                    className="input-field"
                  >
                    <option value="">General Overheads (None)</option>
                    {projects.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Remarks / Note</label>
                  <input type="text" value={payForm.note} onChange={e => setPayForm({ ...payForm, note: e.target.value })} className="input-field" placeholder="e.g. Weekly settlement or advance" />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setShowPayModal(false)}>Cancel</button>
                <button type="submit" className="btn-primary">Save Payment</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
