import { useState, useEffect, useMemo, useCallback } from 'react';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabase';
import { formatCurrency } from '../utils/helpers';
import '../styles/Labour.css';
import {
  UserPlus, IndianRupee, Search, Trash2, Edit2, Phone, Mail,
  Loader2, AlertCircle, X, Lock, ArrowLeft, Sprout, Download,
  ChevronLeft, ChevronRight, User as UserIcon,
} from 'lucide-react';

/* ─── Constants (nursery / landscaping workforce) ─── */
const ROLES = [
  'Nursery Manager', 'Site Supervisor', 'Gardener', 'Planter',
  'Landscaper', 'Irrigation Technician', 'Pruner', 'Driver',
  'Helper', 'Security',
];

const ATT_OPTS = [
  { db: 'present', label: 'Present', short: 'P' },
  { db: 'absent', label: 'Absent', short: 'A' },
  { db: 'half_day', label: 'Half Day', short: '½' },
];

const ROLE_COLORS = {
  'Nursery Manager':       { color: '#6366f1', bg: '#eef2ff' },
  'Site Supervisor':       { color: '#8b5cf6', bg: '#f5f3ff' },
  'Gardener':              { color: '#10b981', bg: '#ecfdf5' },
  'Planter':               { color: '#22c55e', bg: '#f0fdf4' },
  'Landscaper':            { color: '#0ea5e9', bg: '#f0f9ff' },
  'Irrigation Technician': { color: '#06b6d4', bg: '#ecfeff' },
  'Pruner':                { color: '#84cc16', bg: '#f7fee7' },
  'Driver':                { color: '#f59e0b', bg: '#fffbeb' },
  'Helper':                { color: '#94a3b8', bg: '#f8fafc' },
  'Security':              { color: '#ef4444', bg: '#fef2f2' },
};

const ATT_COLORS = {
  present:  { color: '#10b981', bg: '#ecfdf5', label: 'Present' },
  absent:   { color: '#ef4444', bg: '#fef2f2', label: 'Absent' },
  half_day: { color: '#f59e0b', bg: '#fffbeb', label: 'Half Day' },
  leave:    { color: '#94a3b8', bg: '#f1f5f9', label: 'Leave' },
};

function toLocalISODate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function initials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase();
}

const TODAY = toLocalISODate(new Date());
const TODAY_YM = TODAY.slice(0, 7);
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const emptyMember = {
  full_name: '', role: 'Gardener', phone: '', email: '',
  pay_type: 'daily', rate: '', join_date: TODAY, notes: '',
  aadhaar_number: '', bank_name: '', account_number: '', ifsc_code: '',
};

function monthBounds(yearMonth) {
  const [y, m] = yearMonth.split('-').map(Number);
  const start = `${yearMonth}-01`;
  const lastDay = new Date(y, m, 0).getDate(); // day count only — no UTC conversion
  const end = `${yearMonth}-${String(lastDay).padStart(2, '0')}`;
  return { start, end };
}
function monthLabel(ym) {
  const [y, m] = ym.split('-').map(Number);
  return `${MONTHS[m - 1]} ${y}`;
}
function shiftMonth(ym, delta) {
  let [y, m] = ym.split('-').map(Number);
  m += delta;
  while (m < 1) { m += 12; y--; }
  while (m > 12) { m -= 12; y++; }
  return `${y}-${String(m).padStart(2, '0')}`;
}
function calcMonthStats(attArr, ym) {
  const { start, end } = monthBounds(ym);
  let present = 0, absent = 0, halfDay = 0, leave = 0;
  attArr.forEach(a => {
    if (a.date < start || a.date > end) return;
    if (a.status === 'present') present++;
    else if (a.status === 'absent') absent++;
    else if (a.status === 'half_day') halfDay++;
    else if (a.status === 'leave') leave++;
  });
  return { present, absent, halfDay, leave };
}
function calcEarnedForMonth(member, attArr, ym) {
  if (member.pay_type === 'monthly') return Number(member.rate) || 0;
  const { present, halfDay } = calcMonthStats(attArr, ym);
  return present * member.rate + halfDay * member.rate * 0.5;
}
function buildLedger(member, attArr, payArr) {
  const monthsSet = new Set();
  if (member.pay_type === 'daily') {
    attArr.forEach(a => monthsSet.add(a.date.slice(0, 7)));
    monthsSet.add(TODAY_YM);
  } else {
    let ym = (member.join_date || TODAY).slice(0, 7);
    let count = 0;
    while (ym <= TODAY_YM && count < 24) { // cap at 24 months back
      monthsSet.add(ym);
      ym = shiftMonth(ym, 1);
      count++;
    }
    monthsSet.add(TODAY_YM);
  }
  payArr.forEach(p => { if (p.period_start) monthsSet.add(p.period_start.slice(0, 7)); });
  const months = Array.from(monthsSet).sort();
  let running = 0;
  const ledger = months.map(ym => {
    const earned = calcEarnedForMonth(member, attArr, ym);
    const paid = payArr
      .filter(p => p.period_start && p.period_start.slice(0, 7) === ym)
      .reduce((s, p) => s + (p.net_amount || 0), 0);
    running = running + earned - paid;
    return { month: ym, earned, paid, outstandingAfter: running, status: running <= 0.5 ? 'Settled' : 'Due' };
  });
  return ledger.reverse();
}

export default function Labour() {
  const { profile } = useAuth();
  const isAdmin = !profile || profile.role === 'Admin';

  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [todayAttendance, setTodayAttendance] = useState({}); // { memberId: status } for TODAY

  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('All');
  const [payTypeFilter, setPayTypeFilter] = useState('All');

  const [selectedId, setSelectedId] = useState(null);
  const [rightTab, setRightTab] = useState('profile');
  const [allAttendance, setAllAttendance] = useState([]);
  const [allPayments, setAllPayments] = useState([]);
  const [detailLoading, setDetailLoading] = useState(false);

  const [selectedDate, setSelectedDate] = useState(TODAY);
  const [calendarMonth, setCalendarMonth] = useState(TODAY_YM);

  const [payForm, setPayForm] = useState({ amount: '', date: TODAY, mode: 'Cash', remarks: '' });
  const [payBusy, setPayBusy] = useState(false);

  const [showAddMember, setShowAddMember] = useState(false);
  const [editMember, setEditMember] = useState(null);
  const [form, setForm] = useState(emptyMember);
  const [saving, setSaving] = useState(false);

  const selected = useMemo(() => members.find(m => m.id === selectedId) || null, [members, selectedId]);

  const fetchMembers = useCallback(async () => {
    setLoading(true);
    setError('');
    const { data, error: err } = await supabase.from('team_members').select('*').order('created_at', { ascending: false });
    if (err) setError(err.message);
    else setMembers(data || []);
    setLoading(false);
  }, []);

  const fetchTodayAttendance = useCallback(async () => {
    const { data, error: err } = await supabase.from('attendance').select('member_id,status').eq('date', TODAY);
    if (!err && data) {
      const map = {};
      data.forEach(r => { map[r.member_id] = r.status; });
      setTodayAttendance(map);
    }
  }, []);

  const fetchMemberFull = useCallback(async (memberId) => {
    setDetailLoading(true);
    const [attRes, payRes] = await Promise.all([
      supabase.from('attendance').select('*').eq('member_id', memberId).order('date', { ascending: true }),
      supabase.from('payments').select('*').eq('member_id', memberId).order('payment_date', { ascending: false }),
    ]);
    setAllAttendance(attRes.data || []);
    setAllPayments(payRes.data || []);
    setDetailLoading(false);
  }, []);

  useEffect(() => { fetchMembers(); fetchTodayAttendance(); }, [fetchMembers, fetchTodayAttendance]);
  useEffect(() => {
    if (selectedId) {
      setRightTab('profile');
      setSelectedDate(TODAY);
      setCalendarMonth(TODAY_YM);
      setPayForm({ amount: '', date: TODAY, mode: 'Cash', remarks: '' });
      fetchMemberFull(selectedId);
    }
  }, [selectedId, fetchMemberFull]);

  /* ═══════════ ATTENDANCE ═══════════ */
  const markAttendance = async (memberId, status, date) => {
    setError('');
    const { error: err } = await supabase
      .from('attendance')
      .upsert({ member_id: memberId, date, status }, { onConflict: 'member_id,date' });
    if (err) { setError(err.message); return; }
    if (date === TODAY) setTodayAttendance(prev => ({ ...prev, [memberId]: status }));
    if (selectedId === memberId) fetchMemberFull(memberId);
  };

  /* ═══════════ MEMBER CRUD ═══════════ */
  const openAdd = () => { setForm(emptyMember); setShowAddMember(true); };
  const openEdit = (m) => {
    setEditMember(m);
    setForm({
      full_name: m.full_name || '', role: m.role || 'Gardener', phone: m.phone || '',
      email: m.email || '', pay_type: m.pay_type || 'daily', rate: m.rate ?? '',
      join_date: m.join_date || TODAY, notes: m.notes || '',
      aadhaar_number: m.aadhaar_number || '', bank_name: m.bank_name || '',
      account_number: m.account_number || '', ifsc_code: m.ifsc_code || '',
    });
  };
  const closeModal = () => { setShowAddMember(false); setEditMember(null); setForm(emptyMember); };

  const submitMember = async (e) => {
    e.preventDefault();
    setSaving(true);
    const payload = {
      full_name: form.full_name.trim(),
      role: form.role,
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      pay_type: form.pay_type,
      rate: Number(form.rate) || 0,
      join_date: form.join_date,
      notes: form.notes.trim() || null,
      aadhaar_number: form.aadhaar_number.trim() || null,
      bank_name: form.bank_name.trim() || null,
      account_number: form.account_number.trim() || null,
      ifsc_code: form.ifsc_code.trim() || null,
    };
    let err;
    if (editMember) {
      ({ error: err } = await supabase.from('team_members').update(payload).eq('id', editMember.id));
    } else {
      ({ error: err } = await supabase.from('team_members').insert(payload));
    }
    setSaving(false);
    if (err) { setError(err.message); return; }
    closeModal();
    fetchMembers();
  };

  const deleteMember = async (m) => {
    if (!confirm(`Remove ${m.full_name} from the team? This also deletes their attendance and payment history.`)) return;
    setError('');
    const { data, error: err } = await supabase.from('team_members').delete().eq('id', m.id).select();
    if (err) { setError(err.message); return; }
    if (!data || data.length === 0) {
      setError('Delete did not remove anything — Row Level Security is likely still enabled on "team_members" in Supabase.');
      return;
    }
    setMembers(prev => prev.filter(x => x.id !== m.id));
    if (selectedId === m.id) setSelectedId(null);
  };

  /* ═══════════ PAYMENTS ═══════════ */
  const logPayment = async (e) => {
    e.preventDefault();
    if (!selected) return;
    setPayBusy(true);
    const ym = payForm.date.slice(0, 7);
    const { start, end } = monthBounds(ym);
    const amount = Number(payForm.amount) || 0;
    const { error: err } = await supabase.from('payments').insert({
      member_id: selected.id, amount, advance: 0, deduction: 0, net_amount: amount,
      period_start: start, period_end: end, payment_date: payForm.date, method: payForm.mode,
      status: 'paid', notes: payForm.remarks.trim() || null,
    });
    setPayBusy(false);
    if (err) { setError(err.message); return; }
    setPayForm({ amount: '', date: TODAY, mode: 'Cash', remarks: '' });
    fetchMemberFull(selected.id);
  };

  const deletePayment = async (id) => {
    if (!confirm('Delete this payment record?')) return;
    const { error: err } = await supabase.from('payments').delete().eq('id', id);
    if (err) { setError(err.message); return; }
    fetchMemberFull(selected.id);
  };

  const exportCSV = () => {
    if (!selected) return;
    const rows = [
      ['Date', 'Amount', 'Mode', 'Remarks'],
      ...allPayments.map(p => [`="${p.payment_date}"`, p.net_amount, p.method, p.notes || '']),
    ];
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${selected.full_name.replace(/\s+/g, '_')}_payments.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  /* ═══════════ DERIVED ═══════════ */
  const filteredMembers = useMemo(() => {
    return members.filter(m => {
      if (search && !m.full_name?.toLowerCase().includes(search.toLowerCase())) return false;
      if (roleFilter !== 'All' && m.role !== roleFilter) return false;
      if (payTypeFilter !== 'All' && m.pay_type !== payTypeFilter) return false;
      return true;
    });
  }, [members, search, roleFilter, payTypeFilter]);

  const ledger = useMemo(() => selected ? buildLedger(selected, allAttendance, allPayments) : [], [selected, allAttendance, allPayments]);
  const paidThisMonth = useMemo(() => allPayments.filter(p => p.period_start?.slice(0, 7) === TODAY_YM).reduce((s, p) => s + (p.net_amount || 0), 0), [allPayments]);
  const outstanding = ledger.length ? Math.max(0, ledger[0].outstandingAfter) : 0;
  const earnedThisMonth = selected ? calcEarnedForMonth(selected, allAttendance, TODAY_YM) : 0;

  const dailyMembers = useMemo(() => members.filter(m => m.pay_type === 'daily'), [members]);
  const todayStats = useMemo(() => {
    let present = 0, absent = 0, halfDay = 0;
    dailyMembers.forEach(m => {
      const s = todayAttendance[m.id];
      if (s === 'present') present++;
      else if (s === 'absent') absent++;
      else if (s === 'half_day') halfDay++;
    });
    return { present, absent, halfDay, unmarked: dailyMembers.length - present - absent - halfDay };
  }, [dailyMembers, todayAttendance]);

  const calStats = selected ? calcMonthStats(allAttendance, calendarMonth) : null;
  const calWage = selected ? calcEarnedForMonth(selected, allAttendance, calendarMonth) : 0;

  /* Calendar grid cells for calendarMonth — includes attendance status AND payment markers */
  const calendarCells = useMemo(() => {
    if (!selected) return [];
    const [y, m] = calendarMonth.split('-').map(Number);
    const firstDow = new Date(y, m - 1, 1).getDay();
    const daysInMonth = new Date(y, m, 0).getDate();
    const attByDate = {};
    allAttendance.forEach(a => { attByDate[a.date] = a.status; });
    const paidByDate = {};
    allPayments.forEach(p => {
      if (!p.payment_date) return;
      paidByDate[p.payment_date] = (paidByDate[p.payment_date] || 0) + (p.net_amount || 0);
    });
    const cells = [];
    for (let i = 0; i < firstDow; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${calendarMonth}-${String(d).padStart(2, '0')}`;
      cells.push({ day: d, date: dateStr, status: attByDate[dateStr] || null, paid: paidByDate[dateStr] || 0 });
    }
    return cells;
  }, [selected, calendarMonth, allAttendance, allPayments]);

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <Header title="Team" />
        <main className="main-content animate-fade labour-page">

          <div className="tab-page-head">
            <div>
              <h2 className="tab-page-title">Team &amp; Payroll</h2>
              <p className="tab-page-sub">{members.length} team member{members.length === 1 ? '' : 's'} — daily wage and monthly salaried workers, attendance, and payments.</p>
            </div>
          </div>

          {error && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca', borderRadius: '10px', padding: '0.75rem 1rem', marginBottom: '1rem', fontSize: '0.85rem' }}>
              <AlertCircle size={16} /> {error}
              <button onClick={() => setError('')} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#b91c1c' }}><X size={14} /></button>
            </div>
          )}

          {!loading && dailyMembers.length > 0 && (
            <div className="labour-snapshot">
              <div className="labour-snap-card">
                <div className="labour-snap-icon" style={{ background: ATT_COLORS.present.bg }}>
                  <UserIcon size={16} style={{ color: ATT_COLORS.present.color }} />
                </div>
                <div>
                  <div className="labour-snap-num">{todayStats.present}</div>
                  <div className="labour-snap-label">Present today</div>
                </div>
              </div>
              <div className="labour-snap-card">
                <div className="labour-snap-icon" style={{ background: ATT_COLORS.absent.bg }}>
                  <X size={16} style={{ color: ATT_COLORS.absent.color }} />
                </div>
                <div>
                  <div className="labour-snap-num">{todayStats.absent}</div>
                  <div className="labour-snap-label">Absent today</div>
                </div>
              </div>
              <div className="labour-snap-card">
                <div className="labour-snap-icon" style={{ background: ATT_COLORS.half_day.bg }}>
                  <UserIcon size={16} style={{ color: ATT_COLORS.half_day.color }} />
                </div>
                <div>
                  <div className="labour-snap-num">{todayStats.halfDay}</div>
                  <div className="labour-snap-label">Half day</div>
                </div>
              </div>
              <div className="labour-snap-card">
                <div className="labour-snap-icon" style={{ background: '#f1f5f9' }}>
                  <AlertCircle size={16} style={{ color: '#94a3b8' }} />
                </div>
                <div>
                  <div className="labour-snap-num">{todayStats.unmarked}</div>
                  <div className="labour-snap-label">Not marked</div>
                </div>
              </div>
            </div>
          )}

          {loading ? (
            <div className="tab-empty"><Loader2 size={22} className="spin" style={{ marginBottom: '0.5rem' }} /><p>Loading team…</p></div>
          ) : (
            <div className="labour-split">
              {/* ══════════ LEFT: LIST ══════════ */}
              <div className={`labour-list-pane${selected ? ' hide-on-mobile' : ''}`}>
                <div className="labour-search">
                  <Search size={15} />
                  <input placeholder="Search by name, role…" value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                <div className="labour-list-filters">
                  <select className="input-field" value={roleFilter} onChange={e => setRoleFilter(e.target.value)}>
                    <option>All</option>
                    {ROLES.map(r => <option key={r}>{r}</option>)}
                  </select>
                  <select className="input-field" value={payTypeFilter} onChange={e => setPayTypeFilter(e.target.value)}>
                    <option value="All">All Pay Types</option>
                    <option value="daily">Daily</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>
                <button className="pj-add-btn" style={{ width: '100%', justifyContent: 'center', marginBottom: '0.75rem' }} onClick={openAdd}>
                  <UserPlus size={15} /> Add Member
                </button>

                {members.length > 0 && (
                  <div className="labour-list-count">
                    <span>{filteredMembers.length} of {members.length} shown</span>
                  </div>
                )}

                <div className="labour-list-scroll">
                  {filteredMembers.length === 0 ? (
                    <div className="tab-empty">
                      <div className="labour-empty-icon-wrap">
                        <Sprout size={24} style={{ color: '#cbd5e1' }} />
                      </div>
                      <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.85rem' }}>
                        {members.length === 0 ? 'No team members yet.' : 'No matches.'}
                      </p>
                    </div>
                  ) : filteredMembers.map(m => {
                    const rc = ROLE_COLORS[m.role] || ROLE_COLORS['Helper'];
                    const current = todayAttendance[m.id] || null;
                    return (
                      <div key={m.id} className={`labour-row${selectedId === m.id ? ' active' : ''}`} onClick={() => setSelectedId(m.id)}>
                        <div className="labour-avatar" style={{ color: rc.color, background: rc.bg }}>
                          {initials(m.full_name)}
                        </div>
                        <div className="labour-row-body">
                          <div className="labour-row-top">
                            <span className="labour-row-name">{m.full_name}</span>
                            <span className="labour-row-badge" style={{ color: m.pay_type === 'daily' ? '#0ea5e9' : '#8b5cf6', background: m.pay_type === 'daily' ? '#f0f9ff' : '#f5f3ff' }}>
                              {m.pay_type === 'daily' ? 'Daily' : 'Monthly'}
                            </span>
                          </div>
                          <div className="labour-row-sub">
                            <span style={{ color: rc.color }}>{m.role}</span>
                            {isAdmin ? ` · ${formatCurrency(m.rate)}/${m.pay_type === 'daily' ? 'day' : 'mo'}` : ''}
                          </div>
                          {m.pay_type === 'daily' && (
                            <div className="labour-quick-att" onClick={e => e.stopPropagation()}>
                              {ATT_OPTS.map(s => (
                                <button key={s.db}
                                  className={`labour-quick-btn${current === s.db ? ' active' : ''}`}
                                  style={current === s.db ? { borderColor: ATT_COLORS[s.db].color, background: ATT_COLORS[s.db].bg, color: ATT_COLORS[s.db].color } : {}}
                                  onClick={() => markAttendance(m.id, s.db, TODAY)}
                                  title={s.label}>
                                  {s.short}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* ══════════ RIGHT: DETAIL ══════════ */}
              <div className={`labour-detail-pane${!selected ? ' hide-on-mobile' : ''}`}>
                {!selected ? (
                  <div className="tab-empty" style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    <div className="labour-empty-icon-wrap" style={{ width: '64px', height: '64px' }}>
                      <UserIcon size={28} style={{ color: '#cbd5e1' }} />
                    </div>
                    <p style={{ color: '#94a3b8' }}>Select a team member to view their profile, attendance, and payments.</p>
                  </div>
                ) : (
                  <>
                    <div className="labour-detail-head">
                      <button className="tab-icon-btn show-on-mobile" onClick={() => setSelectedId(null)}><ArrowLeft size={14} /></button>
                      {(() => { const rc = ROLE_COLORS[selected.role] || ROLE_COLORS['Helper']; return (
                        <div className="labour-avatar lg" style={{ color: rc.color, background: rc.bg }}>{initials(selected.full_name)}</div>
                      ); })()}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="labour-detail-name">{selected.full_name}</div>
                        <div className="labour-detail-meta">{selected.role}{selected.phone ? ` · ${selected.phone}` : ''}</div>
                      </div>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        {isAdmin && <button className="tab-icon-btn" onClick={exportCSV} title="Export CSV"><Download size={13} /></button>}
                        <button className="tab-icon-btn" onClick={() => openEdit(selected)} title="Edit"><Edit2 size={13} /></button>
                        <button className="tab-icon-btn danger" onClick={() => deleteMember(selected)} title="Delete"><Trash2 size={13} /></button>
                      </div>
                    </div>

                    <div className="labour-detail-tabs">
                      {(selected.pay_type === 'daily' ? ['profile', 'attendance', 'payments'] : ['profile', 'payments']).map(t => (
                        <button key={t} className={`labour-detail-tab${rightTab === t ? ' active' : ''}`} onClick={() => setRightTab(t)}>
                          {t.charAt(0).toUpperCase() + t.slice(1)}
                        </button>
                      ))}
                    </div>

                    <div className="labour-detail-body">
                      {/* ── PROFILE ── */}
                      {rightTab === 'profile' && (
                        <div className="labour-profile-grid">
                          <div className="labour-field"><div className="labour-field-label">Mobile</div><div className="labour-field-value">{selected.phone || '—'}</div></div>
                          <div className="labour-field"><div className="labour-field-label">Skill / Role</div><div className="labour-field-value">{selected.role || '—'}</div></div>
                          <div className="labour-field"><div className="labour-field-label">{selected.pay_type === 'daily' ? 'Daily Wage' : 'Monthly Salary'}</div>
                            <div className="labour-field-value">{isAdmin ? formatCurrency(selected.rate) : <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#cbd5e1' }}><Lock size={11} /> hidden</span>}</div></div>
                          <div className="labour-field"><div className="labour-field-label">Email</div><div className="labour-field-value">{selected.email || '—'}</div></div>
                          <div className="labour-field"><div className="labour-field-label">Join Date</div><div className="labour-field-value">{selected.join_date ? new Date(selected.join_date).toLocaleDateString('en-IN') : '—'}</div></div>
                          <div className="labour-field"><div className="labour-field-label">Pay Type</div><div className="labour-field-value">{selected.pay_type === 'daily' ? 'Daily Wage' : 'Monthly Salary'}</div></div>
                          {isAdmin && <>
                            <div className="labour-section-label">Compliance &amp; Payout</div>
                            <div className="labour-field"><div className="labour-field-label">Aadhaar Number</div><div className="labour-field-value">{selected.aadhaar_number || '—'}</div></div>
                            <div className="labour-field"><div className="labour-field-label">Bank Name</div><div className="labour-field-value">{selected.bank_name || '—'}</div></div>
                            <div className="labour-field"><div className="labour-field-label">Account Number</div><div className="labour-field-value">{selected.account_number || '—'}</div></div>
                            <div className="labour-field"><div className="labour-field-label">IFSC Code</div><div className="labour-field-value">{selected.ifsc_code || '—'}</div></div>
                          </>}
                          {selected.notes && <div className="labour-field" style={{ gridColumn: '1 / -1' }}><div className="labour-field-label">Notes</div><div className="labour-field-value">{selected.notes}</div></div>}
                        </div>
                      )}

                      {/* ── ATTENDANCE (daily workers only) ── */}
                      {rightTab === 'attendance' && selected.pay_type === 'daily' && (
                        detailLoading ? <div className="tab-empty"><Loader2 size={18} className="spin" /></div> : (
                          <div>
                            <div className="labour-att-quickbar">
                              <div className="form-group" style={{ marginBottom: 0 }}>
                                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b' }}>Date</label>
                                <input type="date" value={selectedDate} max={TODAY} onChange={e => setSelectedDate(e.target.value)} className="input-field" />
                              </div>
                              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                                {ATT_OPTS.map(s => {
                                  const current = allAttendance.find(a => a.date === selectedDate)?.status || null;
                                  const active = current === s.db;
                                  return (
                                    <button key={s.db} className="labour-att-chip" onClick={() => markAttendance(selected.id, s.db, selectedDate)}
                                      style={active ? { borderColor: ATT_COLORS[s.db].color, background: ATT_COLORS[s.db].bg, color: ATT_COLORS[s.db].color, fontWeight: 800 } : {}}>
                                      {s.label}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                            {!allAttendance.find(a => a.date === selectedDate) && (
                              <div className="labour-att-empty">
                                <AlertCircle size={13} />
                                No entry yet for {new Date(selectedDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} — tap a status above to mark it.
                              </div>
                            )}

                            <div className="labour-cal-head">
                              <button className="tab-icon-btn" onClick={() => setCalendarMonth(shiftMonth(calendarMonth, -1))}><ChevronLeft size={14} /></button>
                              <span className="labour-cal-month">{monthLabel(calendarMonth)}</span>
                              <button className="tab-icon-btn" onClick={() => setCalendarMonth(shiftMonth(calendarMonth, 1))}><ChevronRight size={14} /></button>
                            </div>
                            <div className="labour-cal-stats">
                              <span><strong>{calStats.present + calStats.absent + calStats.halfDay + calStats.leave}</strong> marked</span>
                              <span style={{ color: '#10b981' }}><strong>{calStats.present}</strong> present</span>
                              <span style={{ color: '#ef4444' }}><strong>{calStats.absent}</strong> absent</span>
                              <span style={{ color: '#f59e0b' }}><strong>{formatCurrency(calWage)}</strong> earned</span>
                            </div>
                            <div className="labour-cal-grid">
                              {['S','M','T','W','T','F','S'].map((d, i) => <div key={i} className="labour-cal-dow">{d}</div>)}
                              {calendarCells.map((c, i) => c === null ? <div key={i} /> : (
                                <div key={i}
                                  className={`labour-cal-cell${c.date === selectedDate ? ' selected' : ''}${c.status ? ' marked' : ''}`}
                                  style={c.status ? { background: ATT_COLORS[c.status].bg } : {}}
                                  onClick={() => setSelectedDate(c.date)}>
                                  <span className="labour-cal-daynum" style={c.status ? { color: ATT_COLORS[c.status].color } : {}}>{c.day}</span>
                                  {c.paid > 0 && <span className="labour-cal-paid">₹{c.paid >= 1000 ? `${Math.round(c.paid / 100) / 10}k` : c.paid}</span>}
                                </div>
                              ))}
                            </div>
                            <div className="labour-cal-legend">
                              <span><i style={{ background: ATT_COLORS.present.color }} />Present</span>
                              <span><i style={{ background: ATT_COLORS.absent.color }} />Absent</span>
                              <span><i style={{ background: ATT_COLORS.half_day.color }} />Half Day</span>
                              <span><i style={{ background: '#0b3d27' }} />₹ = payment given that day</span>
                            </div>
                          </div>
                        )
                      )}

                      {/* ── PAYMENTS ── */}
                      {rightTab === 'payments' && (
                        detailLoading ? <div className="tab-empty"><Loader2 size={18} className="spin" /></div> : (
                          <div>
                            {isAdmin ? (
                              <>
                                <div className="labour-pay-summary">
                                  <div className="labour-pay-card earned">
                                    <div className="labour-field-label">Earned This Month</div>
                                    <div className="labour-pay-value" style={{ color: '#0b3d27' }}>{formatCurrency(earnedThisMonth)}</div>
                                  </div>
                                  <div className="labour-pay-card paid">
                                    <div className="labour-field-label">Paid This Month</div>
                                    <div className="labour-pay-value" style={{ color: '#10b981' }}>{formatCurrency(paidThisMonth)}</div>
                                  </div>
                                  <div className="labour-pay-card outstanding">
                                    <div className="labour-field-label">Total Due</div>
                                    <div className="labour-pay-value" style={{ color: outstanding > 0 ? '#ef4444' : '#10b981' }}>{formatCurrency(outstanding)}</div>
                                  </div>
                                </div>

                                <form onSubmit={logPayment} className="labour-pay-form">
                                  <div className="labour-form-grid">
                                    <div className="form-group">
                                      <label>Amount (₹)</label>
                                      <input type="number" required min="0" value={payForm.amount} onChange={e => setPayForm({ ...payForm, amount: e.target.value })} className="input-field" />
                                    </div>
                                    <div className="form-group">
                                      <label>Date</label>
                                      <input type="date" value={payForm.date} onChange={e => setPayForm({ ...payForm, date: e.target.value })} className="input-field" />
                                    </div>
                                    <div className="form-group">
                                      <label>Mode</label>
                                      <select value={payForm.mode} onChange={e => setPayForm({ ...payForm, mode: e.target.value })} className="input-field">
                                        <option>Cash</option><option>Bank</option><option>UPI</option>
                                      </select>
                                    </div>
                                    <div className="form-group">
                                      <label>Remarks</label>
                                      <input type="text" value={payForm.remarks} onChange={e => setPayForm({ ...payForm, remarks: e.target.value })} className="input-field" placeholder="Optional note" />
                                    </div>
                                  </div>
                                  <button type="submit" className="btn-primary" disabled={payBusy} style={{ marginTop: '0.75rem' }}>
                                    {payBusy ? <Loader2 size={14} className="spin" /> : <><IndianRupee size={13} /> Log Payment</>}
                                  </button>
                                </form>
                              </>
                            ) : (
                              <div className="tab-empty">Payment details are visible to Admin only.</div>
                            )}

                            <div className="labour-history-label">Payment History</div>
                            {allPayments.length === 0 ? (
                              <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>No payments logged yet.</div>
                            ) : (
                              <div className="tab-table-wrap">
                                <table className="tab-table">
                                  <thead><tr><th>Date</th><th>Amount</th><th>Mode</th><th>Remarks</th>{isAdmin && <th></th>}</tr></thead>
                                  <tbody>
                                    {allPayments.map(p => (
                                      <tr key={p.id}>
                                        <td>{new Date(p.payment_date).toLocaleDateString('en-IN')}</td>
                                        <td style={{ fontWeight: 700 }}>{formatCurrency(p.net_amount)}</td>
                                        <td>{p.method}</td>
                                        <td style={{ color: '#94a3b8' }}>{p.notes || '—'}</td>
                                        {isAdmin && <td><button className="tab-icon-btn danger" onClick={() => deletePayment(p.id)}><Trash2 size={12} /></button></td>}
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        )
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </main>
      </div>

      {/* ══════════ ADD / EDIT MEMBER MODAL ══════════ */}
      {(showAddMember || editMember) && (
        <div className="tab-modal-overlay">
          <div className="tab-modal" style={{ maxWidth: '520px' }}>
            <div className="tab-modal-head">
              <span className="tab-modal-title">{editMember ? 'Edit Member' : 'Add Team Member'}</span>
              <button className="tab-modal-close" onClick={closeModal}>&times;</button>
            </div>
            <form onSubmit={submitMember}>
              <div className="tab-modal-body">
                <div className="labour-form-grid">
                  <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                    <label>Full Name</label>
                    <input type="text" required value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} className="input-field" placeholder="e.g. Ramesh Kumar" />
                  </div>
                  <div className="form-group">
                    <label>Role</label>
                    <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} className="input-field">
                      {ROLES.map(r => <option key={r}>{r}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Phone</label>
                    <input type="tel" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className="input-field" placeholder="e.g. 9876543210" />
                  </div>
                  <div className="form-group">
                    <label>Email (optional)</label>
                    <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="input-field" placeholder="e.g. ramesh@mail.com" />
                  </div>
                  <div className="form-group">
                    <label>Pay Type</label>
                    <select value={form.pay_type} onChange={e => setForm({ ...form, pay_type: e.target.value })} className="input-field">
                      <option value="daily">Daily Wage</option>
                      <option value="monthly">Monthly Salary</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>{form.pay_type === 'daily' ? 'Daily Wage (₹)' : 'Monthly Salary (₹)'}</label>
                    <input type="number" required min="0" value={form.rate} onChange={e => setForm({ ...form, rate: e.target.value })} className="input-field" placeholder={form.pay_type === 'daily' ? 'e.g. 700' : 'e.g. 18000'} />
                  </div>
                  <div className="form-group">
                    <label>Join Date</label>
                    <input type="date" value={form.join_date} onChange={e => setForm({ ...form, join_date: e.target.value })} className="input-field" />
                  </div>
                  <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                    <label>Skills / Notes</label>
                    <input type="text" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} className="input-field" placeholder="e.g. Tree pruning, irrigation laying, driving" />
                  </div>

                  <div className="form-group" style={{ gridColumn: '1 / -1', borderTop: '1px solid #f1f5f9', paddingTop: '0.9rem', marginTop: '0.2rem' }}>
                    <label style={{ fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', fontSize: '0.68rem', letterSpacing: '0.05em' }}>Compliance &amp; Payout Details (optional)</label>
                  </div>
                  <div className="form-group">
                    <label>Aadhaar Number</label>
                    <input type="text" value={form.aadhaar_number} onChange={e => setForm({ ...form, aadhaar_number: e.target.value })} className="input-field" placeholder="e.g. XXXX XXXX XXXX" />
                  </div>
                  <div className="form-group">
                    <label>Bank Name</label>
                    <input type="text" value={form.bank_name} onChange={e => setForm({ ...form, bank_name: e.target.value })} className="input-field" placeholder="e.g. State Bank of India" />
                  </div>
                  <div className="form-group">
                    <label>Account Number</label>
                    <input type="text" value={form.account_number} onChange={e => setForm({ ...form, account_number: e.target.value })} className="input-field" placeholder="e.g. 000123456789" />
                  </div>
                  <div className="form-group">
                    <label>IFSC Code</label>
                    <input type="text" value={form.ifsc_code} onChange={e => setForm({ ...form, ifsc_code: e.target.value.toUpperCase() })} className="input-field" placeholder="e.g. SBIN0001234" />
                  </div>
                </div>
              </div>
              <div className="tab-modal-foot">
                <button type="button" className="btn-secondary" onClick={closeModal}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? <Loader2 size={14} className="spin" /> : (editMember ? 'Save Changes' : 'Add Member')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}