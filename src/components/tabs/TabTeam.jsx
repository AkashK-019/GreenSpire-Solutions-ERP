import { useState, useEffect } from 'react';
import {
  Users, UserPlus, ClipboardCheck, IndianRupee,
  Trash2, Plus, ChevronDown, Phone, Mail,
  CalendarCheck, Loader2, Edit2, X, Check,
  ShieldAlert, UserCheck
} from 'lucide-react';
import { formatCurrency } from '../../utils/helpers';

/* ─── Storage helpers ─── */
const load = (key, def) => { try { return JSON.parse(localStorage.getItem(key) || 'null') ?? def; } catch { return def; } };
const save = (key, val) => localStorage.setItem(key, JSON.stringify(val));

/* ─── Constants ─── */
const ROLES = ['Site Supervisor', 'Foreman', 'Labour', 'Driver', 'Plumber', 'Electrician', 'Gardener', 'Helper', 'Security'];
const STATUS_OPTS = ['Active', 'Inactive', 'On Leave'];
const ATTENDANCE  = ['Present', 'Absent', 'Half Day', 'Leave'];

const ROLE_COLORS = {
  'Site Supervisor': { color: '#6366f1', bg: '#eef2ff' },
  'Foreman':         { color: '#8b5cf6', bg: '#f5f3ff' },
  'Labour':          { color: '#64748b', bg: '#f1f5f9' },
  'Driver':          { color: '#0ea5e9', bg: '#f0f9ff' },
  'Plumber':         { color: '#06b6d4', bg: '#ecfeff' },
  'Electrician':     { color: '#f59e0b', bg: '#fffbeb' },
  'Gardener':        { color: '#10b981', bg: '#ecfdf5' },
  'Helper':          { color: '#94a3b8', bg: '#f8fafc' },
  'Security':        { color: '#ef4444', bg: '#fef2f2' },
};

const STATUS_COLORS = {
  Active:    { color: '#10b981', bg: '#ecfdf5' },
  Inactive:  { color: '#94a3b8', bg: '#f1f5f9' },
  'On Leave':{ color: '#f59e0b', bg: '#fffbeb' },
};

const ATT_COLORS = {
  Present:  { color: '#10b981', bg: '#ecfdf5' },
  Absent:   { color: '#ef4444', bg: '#fef2f2' },
  'Half Day':{ color: '#f59e0b', bg: '#fffbeb' },
  Leave:    { color: '#94a3b8', bg: '#f1f5f9' },
};

const TODAY = new Date().toISOString().split('T')[0];
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export default function TabTeam({ project }) {
  const pid = project?.id;

  /* ── Main view: Members | Attendance | Payroll ── */
  const [view, setView] = useState('members');

  /* ── Members ── */
  const [members, setMembers] = useState(() => load(`team_members_${pid}`, []));
  const [showAddMember, setShowAddMember] = useState(false);
  const [editMember,    setEditMember]    = useState(null);
  const [newMember, setNewMember] = useState({
    name: '', role: 'Labour', phone: '', email: '', wage: '', wageType: 'Daily',
    joinDate: TODAY, skills: '', status: 'Active'
  });

  /* ── Attendance ── */
  const [attDate,  setAttDate]  = useState(TODAY);
  const [attendance, setAttendance] = useState(() => load(`attendance_${pid}`, {}));

  /* ── Payroll ── */
  const [payMonth, setPayMonth] = useState(() => {
    const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
  });
  const [payments,  setPayments]  = useState(() => load(`payments_${pid}`, {}));
  const [payModal,  setPayModal]  = useState(null); // member object
  const [payForm,   setPayForm]   = useState({ amount: '', advance: 0, deduction: 0, note: '' });

  /* ── Persist ── */
  useEffect(() => { save(`team_members_${pid}`, members); },    [members, pid]);
  useEffect(() => { save(`attendance_${pid}`, attendance); },   [attendance, pid]);
  useEffect(() => { save(`payments_${pid}`, payments); },       [payments, pid]);

  /* ════ MEMBERS handlers ════ */
  const handleAddMember = (e) => {
    e.preventDefault();
    const id = Date.now();
    setMembers(prev => [...prev, { ...newMember, id, wage: Number(newMember.wage) || 0 }]);
    setShowAddMember(false);
    setNewMember({ name: '', role: 'Labour', phone: '', email: '', wage: '', wageType: 'Daily', joinDate: TODAY, skills: '', status: 'Active' });
  };

  const handleUpdateMember = (e) => {
    e.preventDefault();
    setMembers(prev => prev.map(m => m.id === editMember.id ? { ...editMember, wage: Number(editMember.wage) || 0 } : m));
    setEditMember(null);
  };

  const deleteMember = (id) => {
    if (!confirm('Remove this team member?')) return;
    setMembers(prev => prev.filter(m => m.id !== id));
  };

  /* ════ ATTENDANCE handlers ════ */
  const setAttStatus = (memberId, status) => {
    setAttendance(prev => ({
      ...prev,
      [attDate]: { ...(prev[attDate] || {}), [memberId]: status }
    }));
  };

  const getAttStatus = (memberId) => attendance[attDate]?.[memberId] || null;

  const getMonthStats = (memberId) => {
    const [yr, mo] = payMonth.split('-');
    let present = 0, absent = 0, halfDay = 0;
    Object.entries(attendance).forEach(([date, dayMap]) => {
      if (!date.startsWith(`${yr}-${mo}`)) return;
      const s = dayMap[memberId];
      if (s === 'Present') present++;
      else if (s === 'Absent') absent++;
      else if (s === 'Half Day') halfDay++;
    });
    return { present, absent, halfDay };
  };

  /* ════ PAYROLL handlers ════ */
  const getPaymentKey = (memberId) => `${payMonth}-${memberId}`;

  const submitPayment = (e) => {
    e.preventDefault();
    const key = getPaymentKey(payModal.id);
    const entry = {
      amount: Number(payForm.amount),
      advance: Number(payForm.advance || 0),
      deduction: Number(payForm.deduction || 0),
      net: Number(payForm.amount) - Number(payForm.advance || 0) - Number(payForm.deduction || 0),
      note: payForm.note,
      paid: true,
      date: TODAY,
    };
    setPayments(prev => ({ ...prev, [key]: entry }));
    setPayModal(null);
    setPayForm({ amount: '', advance: 0, deduction: 0, note: '' });
  };

  const calcEarned = (member) => {
    const { present, halfDay } = getMonthStats(member.id);
    if (member.wageType === 'Daily') return (present * member.wage) + (halfDay * member.wage * 0.5);
    if (member.wageType === 'Monthly') return member.wage;
    return 0;
  };

  /* ═══════════════════ RENDER ═══════════════════ */
  const activeCount  = members.filter(m => m.status === 'Active').length;
  const totalPayroll = members.reduce((s, m) => s + (payments[getPaymentKey(m.id)]?.net || 0), 0);

  const viewTabs = [
    { key: 'members',    label: 'Team Members',  icon: Users },
    { key: 'attendance', label: 'Attendance',     icon: CalendarCheck },
    { key: 'payroll',    label: 'Payroll',        icon: IndianRupee },
  ];

  return (
    <div className="animate-fade">

      {/* Header */}
      <div className="tab-page-head">
        <div>
          <h2 className="tab-page-title">Team Management</h2>
          <p className="tab-page-sub">Manage workforce, track attendance, and run payroll for this project.</p>
        </div>
        {view === 'members' && (
          <button className="pj-add-btn" onClick={() => setShowAddMember(true)}>
            <UserPlus size={15} /> Add Member
          </button>
        )}
      </div>

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.9rem', marginBottom: '1.5rem' }}>
        {[
          { label: 'Total Members', value: members.length, color: '#6366f1', bg: '#eef2ff' },
          { label: 'Active Today',  value: activeCount, color: '#10b981', bg: '#ecfdf5' },
          { label: 'Present Today', value: Object.values(attendance[TODAY] || {}).filter(v => v === 'Present').length, color: '#3b82f6', bg: '#eff6ff' },
          { label: `Payroll (${MONTHS[Number(payMonth.split('-')[1])-1]})`, value: formatCurrency(totalPayroll), color: '#f59e0b', bg: '#fffbeb', small: true },
        ].map(card => (
          <div key={card.label} style={{ background: card.bg, border: `1px solid ${card.color}22`, borderRadius: '12px', padding: '1rem' }}>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: card.color, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>{card.label}</div>
            <div style={{ fontWeight: 800, fontSize: card.small ? '1rem' : '1.5rem', color: card.color }}>{card.value}</div>
          </div>
        ))}
      </div>

      {/* View switcher */}
      <div style={{ display: 'flex', gap: '4px', background: '#f1f5f9', borderRadius: '10px', padding: '4px', marginBottom: '1.5rem', width: 'fit-content' }}>
        {viewTabs.map(tab => {
          const Icon = tab.icon;
          const isActive = view === tab.key;
          return (
            <button key={tab.key} onClick={() => setView(tab.key)}
              style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '0.45rem 1rem', borderRadius: '7px', border: 'none', background: isActive ? '#fff' : 'transparent', color: isActive ? '#0b3d27' : '#64748b', fontWeight: isActive ? 700 : 500, fontSize: '0.82rem', cursor: 'pointer', boxShadow: isActive ? '0 1px 4px rgba(0,0,0,0.08)' : 'none', fontFamily: 'Inter, sans-serif', transition: 'all 0.15s' }}>
              <Icon size={14} /> {tab.label}
            </button>
          );
        })}
      </div>

      {/* ══════════ MEMBERS VIEW ══════════ */}
      {view === 'members' && (
        <div>
          {members.length === 0 ? (
            <div className="tab-empty">
              <Users size={32} style={{ color: '#cbd5e1', marginBottom: '0.75rem' }} />
              <p style={{ margin: 0, color: '#94a3b8' }}>No team members yet. Click "Add Member" to get started.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
              {members.map(m => {
                const rc = ROLE_COLORS[m.role] || ROLE_COLORS['Labour'];
                const sc = STATUS_COLORS[m.status] || STATUS_COLORS['Active'];
                return (
                  <div key={m.id} className="tab-card" style={{ position: 'relative' }}>
                    <div className="tab-card-body">
                      {/* Role badge + actions */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                        <span style={{ fontSize: '0.7rem', fontWeight: 700, color: rc.color, background: rc.bg, padding: '3px 9px', borderRadius: '6px' }}>{m.role}</span>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <button className="tab-icon-btn" onClick={() => setEditMember({ ...m })} title="Edit"><Edit2 size={12} /></button>
                          <button className="tab-icon-btn danger" onClick={() => deleteMember(m.id)} title="Remove"><Trash2 size={12} /></button>
                        </div>
                      </div>

                      {/* Name & status */}
                      <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#0b3d27', marginBottom: '2px' }}>{m.name}</div>
                      <span style={{ fontSize: '0.7rem', fontWeight: 600, color: sc.color, background: sc.bg, padding: '2px 8px', borderRadius: '5px' }}>{m.status}</span>

                      {/* Contact */}
                      <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                        {m.phone && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '0.78rem', color: '#64748b' }}>
                            <Phone size={11} style={{ flexShrink: 0 }} /> {m.phone}
                          </div>
                        )}
                        {m.email && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '0.78rem', color: '#64748b' }}>
                            <Mail size={11} style={{ flexShrink: 0 }} /> {m.email}
                          </div>
                        )}
                      </div>

                      {/* Skills */}
                      {m.skills && (
                        <div style={{ marginTop: '0.6rem', fontSize: '0.72rem', color: '#94a3b8', fontStyle: 'italic' }}>
                          {m.skills}
                        </div>
                      )}

                      {/* Wage */}
                      <div style={{ marginTop: '0.85rem', paddingTop: '0.6rem', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                        <span style={{ color: '#64748b' }}>Wage</span>
                        <span style={{ fontWeight: 700, color: '#0b3d27' }}>{formatCurrency(m.wage)} / {m.wageType === 'Daily' ? 'day' : 'month'}</span>
                      </div>
                      <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '4px', textAlign: 'right' }}>
                        Joined: {new Date(m.joinDate).toLocaleDateString('en-IN')}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ══════════ ATTENDANCE VIEW ══════════ */}
      {view === 'attendance' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#64748b', marginBottom: '4px', display: 'block' }}>Date</label>
              <input type="date" value={attDate} max={TODAY}
                onChange={e => setAttDate(e.target.value)} className="input-field" style={{ width: 'auto' }} />
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {Object.entries(ATT_COLORS).map(([s, c]) => (
                <span key={s} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.73rem', color: c.color, background: c.bg, padding: '3px 10px', borderRadius: '6px', fontWeight: 600 }}>
                  <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: c.color, display: 'inline-block' }} />{s}
                </span>
              ))}
            </div>
          </div>

          {members.filter(m => m.status !== 'Inactive').length === 0 ? (
            <div className="tab-empty">No active members to mark attendance for.</div>
          ) : (
            <div className="tab-card">
              <div className="tab-card-head">
                <span className="tab-card-title"><ClipboardCheck size={14} /> Attendance — {new Date(attDate).toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
              </div>
              <div className="tab-card-body" style={{ padding: 0 }}>
                <table className="tab-table">
                  <thead>
                    <tr>
                      <th>Member</th>
                      <th>Role</th>
                      <th>Present</th>
                      <th>Absent</th>
                      <th>Half Day</th>
                      <th>Leave</th>
                    </tr>
                  </thead>
                  <tbody>
                    {members.filter(m => m.status !== 'Inactive').map(m => {
                      const current = getAttStatus(m.id);
                      return (
                        <tr key={m.id}>
                          <td style={{ fontWeight: 600 }}>{m.name}</td>
                          <td>
                            <span style={{ fontSize: '0.72rem', fontWeight: 600, color: ROLE_COLORS[m.role]?.color || '#64748b', background: ROLE_COLORS[m.role]?.bg || '#f1f5f9', padding: '2px 8px', borderRadius: '5px' }}>
                              {m.role}
                            </span>
                          </td>
                          {ATTENDANCE.map(s => (
                            <td key={s} style={{ textAlign: 'center' }}>
                              <button
                                onClick={() => setAttStatus(m.id, current === s ? null : s)}
                                style={{
                                  width: '28px', height: '28px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                                  background: current === s ? ATT_COLORS[s].bg : '#f8fafc',
                                  color: current === s ? ATT_COLORS[s].color : '#cbd5e1',
                                  fontWeight: current === s ? 700 : 400,
                                  transition: 'all 0.15s',
                                  boxShadow: current === s ? `0 0 0 1.5px ${ATT_COLORS[s].color}44` : 'none',
                                }}
                                title={`Mark ${s}`}
                              >
                                {current === s ? <Check size={13} /> : <span style={{ fontSize: '0.6rem' }}>—</span>}
                              </button>
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══════════ PAYROLL VIEW ══════════ */}
      {view === 'payroll' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#64748b', marginBottom: '4px', display: 'block' }}>Month</label>
              <input type="month" value={payMonth}
                onChange={e => setPayMonth(e.target.value)} className="input-field" style={{ width: 'auto' }} />
            </div>
          </div>

          {members.length === 0 ? (
            <div className="tab-empty">Add team members first to manage payroll.</div>
          ) : (
            <div className="tab-table-wrap">
              <table className="tab-table">
                <thead>
                  <tr>
                    <th>Member</th>
                    <th>Role</th>
                    <th>Wage</th>
                    <th>Present</th>
                    <th>Earned (Est.)</th>
                    <th>Advance</th>
                    <th>Deduction</th>
                    <th>Net Pay</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {members.map(m => {
                    const key     = getPaymentKey(m.id);
                    const pay     = payments[key];
                    const stats   = getMonthStats(m.id);
                    const earned  = calcEarned(m);
                    return (
                      <tr key={m.id}>
                        <td style={{ fontWeight: 600 }}>{m.name}</td>
                        <td>
                          <span style={{ fontSize: '0.7rem', fontWeight: 600, color: ROLE_COLORS[m.role]?.color, background: ROLE_COLORS[m.role]?.bg, padding: '2px 7px', borderRadius: '5px' }}>{m.role}</span>
                        </td>
                        <td style={{ color: '#64748b', fontSize: '0.8rem' }}>{formatCurrency(m.wage)}/{m.wageType === 'Daily' ? 'd' : 'mo'}</td>
                        <td>
                          <div style={{ fontSize: '0.78rem', color: '#10b981', fontWeight: 600 }}>{stats.present}P</div>
                          {stats.halfDay > 0 && <div style={{ fontSize: '0.7rem', color: '#f59e0b' }}>{stats.halfDay} HD</div>}
                          {stats.absent  > 0 && <div style={{ fontSize: '0.7rem', color: '#ef4444' }}>{stats.absent}A</div>}
                        </td>
                        <td style={{ fontWeight: 700, color: '#0b3d27' }}>{formatCurrency(earned)}</td>
                        <td style={{ color: pay ? '#ef4444' : '#cbd5e1', fontSize: '0.82rem' }}>
                          {pay ? formatCurrency(pay.advance) : '—'}
                        </td>
                        <td style={{ color: pay ? '#f59e0b' : '#cbd5e1', fontSize: '0.82rem' }}>
                          {pay ? formatCurrency(pay.deduction) : '—'}
                        </td>
                        <td style={{ fontWeight: 800, fontSize: '0.9rem', color: pay ? '#0b3d27' : '#94a3b8' }}>
                          {pay ? formatCurrency(pay.net) : '—'}
                        </td>
                        <td>
                          {pay ? (
                            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#10b981', background: '#ecfdf5', padding: '3px 9px', borderRadius: '6px' }}>Paid</span>
                          ) : (
                            <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#f59e0b', background: '#fffbeb', padding: '3px 9px', borderRadius: '6px' }}>Pending</span>
                          )}
                        </td>
                        <td>
                          <button className="tab-icon-btn" onClick={() => { setPayModal(m); setPayForm({ amount: String(Math.round(earned)), advance: 0, deduction: 0, note: '' }); }} title="Process Payment">
                            <IndianRupee size={13} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ══════════ ADD MEMBER MODAL ══════════ */}
      {showAddMember && (
        <div className="tab-modal-overlay">
          <div className="tab-modal" style={{ maxWidth: '520px' }}>
            <div className="tab-modal-head">
              <span className="tab-modal-title">Add Team Member</span>
              <button className="tab-modal-close" onClick={() => setShowAddMember(false)}>&times;</button>
            </div>
            <form onSubmit={handleAddMember}>
              <div className="tab-modal-body">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                    <label>Full Name</label>
                    <input type="text" required value={newMember.name}
                      onChange={e => setNewMember({ ...newMember, name: e.target.value })}
                      className="input-field" placeholder="e.g. Ramesh Kumar" />
                  </div>
                  <div className="form-group">
                    <label>Role</label>
                    <select value={newMember.role} onChange={e => setNewMember({ ...newMember, role: e.target.value })} className="input-field">
                      {ROLES.map(r => <option key={r}>{r}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Status</label>
                    <select value={newMember.status} onChange={e => setNewMember({ ...newMember, status: e.target.value })} className="input-field">
                      {STATUS_OPTS.map(s => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Phone</label>
                    <input type="tel" value={newMember.phone}
                      onChange={e => setNewMember({ ...newMember, phone: e.target.value })}
                      className="input-field" placeholder="e.g. 9876543210" />
                  </div>
                  <div className="form-group">
                    <label>Email (optional)</label>
                    <input type="email" value={newMember.email}
                      onChange={e => setNewMember({ ...newMember, email: e.target.value })}
                      className="input-field" placeholder="e.g. ramesh@mail.com" />
                  </div>
                  <div className="form-group">
                    <label>Wage (₹)</label>
                    <input type="number" required min="0" value={newMember.wage}
                      onChange={e => setNewMember({ ...newMember, wage: e.target.value })}
                      className="input-field" placeholder="e.g. 700" />
                  </div>
                  <div className="form-group">
                    <label>Wage Type</label>
                    <select value={newMember.wageType} onChange={e => setNewMember({ ...newMember, wageType: e.target.value })} className="input-field">
                      <option>Daily</option>
                      <option>Monthly</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Join Date</label>
                    <input type="date" value={newMember.joinDate}
                      onChange={e => setNewMember({ ...newMember, joinDate: e.target.value })} className="input-field" />
                  </div>
                  <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                    <label>Skills / Notes</label>
                    <input type="text" value={newMember.skills}
                      onChange={e => setNewMember({ ...newMember, skills: e.target.value })}
                      className="input-field" placeholder="e.g. Tree pruning, irrigation laying, driving" />
                  </div>
                </div>
              </div>
              <div className="tab-modal-foot">
                <button type="button" className="btn-secondary" onClick={() => setShowAddMember(false)}>Cancel</button>
                <button type="submit" className="btn-primary">Add Member</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════ EDIT MEMBER MODAL ══════════ */}
      {editMember && (
        <div className="tab-modal-overlay">
          <div className="tab-modal" style={{ maxWidth: '520px' }}>
            <div className="tab-modal-head">
              <span className="tab-modal-title">Edit Member</span>
              <button className="tab-modal-close" onClick={() => setEditMember(null)}>&times;</button>
            </div>
            <form onSubmit={handleUpdateMember}>
              <div className="tab-modal-body">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                    <label>Full Name</label>
                    <input type="text" required value={editMember.name}
                      onChange={e => setEditMember({ ...editMember, name: e.target.value })} className="input-field" />
                  </div>
                  <div className="form-group">
                    <label>Role</label>
                    <select value={editMember.role} onChange={e => setEditMember({ ...editMember, role: e.target.value })} className="input-field">
                      {ROLES.map(r => <option key={r}>{r}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Status</label>
                    <select value={editMember.status} onChange={e => setEditMember({ ...editMember, status: e.target.value })} className="input-field">
                      {STATUS_OPTS.map(s => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Phone</label>
                    <input type="tel" value={editMember.phone}
                      onChange={e => setEditMember({ ...editMember, phone: e.target.value })} className="input-field" />
                  </div>
                  <div className="form-group">
                    <label>Email</label>
                    <input type="email" value={editMember.email}
                      onChange={e => setEditMember({ ...editMember, email: e.target.value })} className="input-field" />
                  </div>
                  <div className="form-group">
                    <label>Wage (₹)</label>
                    <input type="number" min="0" value={editMember.wage}
                      onChange={e => setEditMember({ ...editMember, wage: e.target.value })} className="input-field" />
                  </div>
                  <div className="form-group">
                    <label>Wage Type</label>
                    <select value={editMember.wageType} onChange={e => setEditMember({ ...editMember, wageType: e.target.value })} className="input-field">
                      <option>Daily</option><option>Monthly</option>
                    </select>
                  </div>
                  <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                    <label>Skills / Notes</label>
                    <input type="text" value={editMember.skills}
                      onChange={e => setEditMember({ ...editMember, skills: e.target.value })} className="input-field" />
                  </div>
                </div>
              </div>
              <div className="tab-modal-foot">
                <button type="button" className="btn-secondary" onClick={() => setEditMember(null)}>Cancel</button>
                <button type="submit" className="btn-primary">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════ PAYMENT MODAL ══════════ */}
      {payModal && (
        <div className="tab-modal-overlay">
          <div className="tab-modal">
            <div className="tab-modal-head">
              <span className="tab-modal-title">Process Payment — {payModal.name}</span>
              <button className="tab-modal-close" onClick={() => setPayModal(null)}>&times;</button>
            </div>
            <form onSubmit={submitPayment}>
              <div className="tab-modal-body">
                {/* Summary */}
                <div style={{ background: '#f8fafc', borderRadius: '10px', padding: '0.9rem', marginBottom: '1rem', fontSize: '0.82rem' }}>
                  {(() => { const s = getMonthStats(payModal.id); return (
                    <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
                      <div><span style={{ color: '#94a3b8' }}>Present:</span> <strong>{s.present}</strong></div>
                      <div><span style={{ color: '#94a3b8' }}>Half Day:</span> <strong>{s.halfDay}</strong></div>
                      <div><span style={{ color: '#94a3b8' }}>Absent:</span> <strong>{s.absent}</strong></div>
                      <div><span style={{ color: '#94a3b8' }}>Est. Earned:</span> <strong style={{ color: '#0b3d27' }}>{formatCurrency(calcEarned(payModal))}</strong></div>
                    </div>
                  ); })()}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                    <label>Amount to Pay (₹)</label>
                    <input type="number" required min="0" value={payForm.amount}
                      onChange={e => setPayForm({ ...payForm, amount: e.target.value })}
                      className="input-field" placeholder="Enter gross amount" />
                  </div>
                  <div className="form-group">
                    <label>Advance (₹)</label>
                    <input type="number" min="0" value={payForm.advance}
                      onChange={e => setPayForm({ ...payForm, advance: e.target.value })} className="input-field" />
                  </div>
                  <div className="form-group">
                    <label>Deduction (₹)</label>
                    <input type="number" min="0" value={payForm.deduction}
                      onChange={e => setPayForm({ ...payForm, deduction: e.target.value })} className="input-field" />
                  </div>
                </div>
                <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '9px', padding: '0.9rem', fontSize: '0.85rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#065f46', fontWeight: 600 }}>Net Payable</span>
                  <strong style={{ color: '#0b3d27', fontSize: '1.05rem' }}>
                    {formatCurrency(Number(payForm.amount || 0) - Number(payForm.advance || 0) - Number(payForm.deduction || 0))}
                  </strong>
                </div>
                <div className="form-group" style={{ marginTop: '0.9rem' }}>
                  <label>Notes</label>
                  <input type="text" value={payForm.note}
                    onChange={e => setPayForm({ ...payForm, note: e.target.value })}
                    className="input-field" placeholder="e.g. Partial advance already given" />
                </div>
              </div>
              <div className="tab-modal-foot">
                <button type="button" className="btn-secondary" onClick={() => setPayModal(null)}>Cancel</button>
                <button type="submit" className="btn-primary">Mark as Paid</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}