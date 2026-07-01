import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabase';
import {
  Briefcase, FileText, TrendingUp, TrendingDown,
  Users, Sprout, ArrowRight, Loader2, RefreshCw,
  MapPin, ArrowUpRight, ArrowDownRight
} from 'lucide-react';
import '../styles/dashboard.css';

export default function Dashboard() {
  const { profile } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState({
    activeProjects: 0,
    pendingQuotations: 0,
    totalReceivables: 0,
    monthlyExpenses: 0,
    labourPaidCurrentMonth: 0,
    labourPaidPreviousMonth: 0,
    plantsInStock: 0,
  });
  const [projectStatusCounts, setProjectStatusCounts] = useState({ Active: 0, Completed: 0, Pending: 0, 'On Hold': 0 });
  const [recentProjects, setRecentProjects] = useState([]);
  const [recentTransactions, setRecentTransactions] = useState([]);

  useEffect(() => { fetchDashboardData(); }, []);

  // Build a local YYYY-MM-DD string without going through toISOString(),
  // which converts to UTC and can silently roll the date back a day
  // (e.g. in IST, midnight local on the 1st becomes 18:30 the previous
  // day in UTC). That off-by-one was corrupting the month boundaries
  // used below, which is why "previous month" was pulling in extra data.
  const toDateStr = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const today = new Date();

      // Current month range: [firstDayCurrentMonth, firstDayNextMonth)
      const firstDayCurrentMonth = toDateStr(new Date(today.getFullYear(), today.getMonth(), 1));
      const firstDayNextMonth    = toDateStr(new Date(today.getFullYear(), today.getMonth() + 1, 1));

      // Previous month range: [firstDayPreviousMonth, firstDayCurrentMonth)
      const firstDayPreviousMonth = toDateStr(new Date(today.getFullYear(), today.getMonth() - 1, 1));

      const [
        projectsRes,
        allProjectsRes,
        quotationsRes,
        invoicesRes,
        expensesRes,
        labourCurrentRes,
        labourPreviousRes,
        recentProjectsRes,
        recentTxRes,
      ] = await Promise.all([
        supabase.from('projects').select('id', { count: 'exact', head: true }).eq('status', 'Active'),
        supabase.from('projects').select('status'),
        supabase.from('quotations').select('id', { count: 'exact', head: true }).eq('status', 'Pending'),
        supabase.from('invoices').select('total_amount').in('status', ['Unpaid', 'Overdue']),
        supabase
          .from('finance_ledger')
          .select('amount')
          .eq('type', 'Debit')
          .gte('date', firstDayCurrentMonth)
          .lt('date', firstDayNextMonth),
        // Labour Charges — current month only
        supabase
          .from('finance_ledger')
          .select('amount')
          .eq('type', 'Debit')
          .eq('category', 'Labour Charges')
          .gte('date', firstDayCurrentMonth)
          .lt('date', firstDayNextMonth),
        // Labour Charges — previous month only
        supabase
          .from('finance_ledger')
          .select('amount')
          .eq('type', 'Debit')
          .eq('category', 'Labour Charges')
          .gte('date', firstDayPreviousMonth)
          .lt('date', firstDayCurrentMonth),
        supabase
          .from('projects')
          .select('id, name, client_name, status, type, budget, site_address')
          .order('created_at', { ascending: false })
          .limit(5),
        supabase
          .from('finance_ledger')
          .select('*, projects(name)')
          .order('date', { ascending: false })
          .limit(6),
      ]);

      const totalReceivables = (invoicesRes.data || []).reduce((s, r) => s + (r.total_amount || 0), 0);
      const totalExpenses    = (expensesRes.data || []).reduce((s, r) => s + (r.amount || 0), 0);
      const labourPaidCurrentMonth  = (labourCurrentRes.data  || []).reduce((s, r) => s + Number(r.amount || 0), 0);
      const labourPaidPreviousMonth = (labourPreviousRes.data || []).reduce((s, r) => s + Number(r.amount || 0), 0);

      setKpis({
        activeProjects: projectsRes.count || 0,
        pendingQuotations: quotationsRes.count || 0,
        totalReceivables,
        monthlyExpenses: totalExpenses,
        labourPaidCurrentMonth,
        labourPaidPreviousMonth,
      });

      const counts = { Active: 0, Completed: 0, Pending: 0, 'On Hold': 0 };
      (allProjectsRes.data || []).forEach(p => { if (counts[p.status] !== undefined) counts[p.status]++; });
      setProjectStatusCounts(counts);

      setRecentProjects(recentProjectsRes.data || []);
      setRecentTransactions(recentTxRes.data || []);
    } catch (err) {
      console.error('Dashboard fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const fmt = (n) =>
    n >= 10000000 ? `₹${(n / 10000000).toFixed(2)}Cr`
    : n >= 100000 ? `₹${(n / 100000).toFixed(1)}L`
    : n >= 1000   ? `₹${(n / 1000).toFixed(1)}K`
    : `₹${n}`;

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good Morning';
    if (h < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  const statusConfig = {
    Active:    { color: '#10b981', bg: '#d1fae5' },
    Completed: { color: '#3b82f6', bg: '#dbeafe' },
    Pending:   { color: '#f59e0b', bg: '#fef3c7' },
    'On Hold': { color: '#94a3b8', bg: '#f1f5f9' },
  };

  const totalProjects = Object.values(projectStatusCounts).reduce((a, b) => a + b, 0);

  const donutSegments = () => {
    const colors = ['#10b981', '#3b82f6', '#f59e0b', '#94a3b8'];
    const labels = ['Active', 'Completed', 'Pending', 'On Hold'];
    const r = 54; const cx = 70; const cy = 70;
    const circumference = 2 * Math.PI * r;
    let offset = 0;
    const total = totalProjects || 1;
    return labels.map((label, i) => {
      const count = projectStatusCounts[label] || 0;
      const pct   = count / total;
      const dash  = pct * circumference;
      const gap   = circumference - dash;
      const seg = (
        <circle key={label} cx={cx} cy={cy} r={r} fill="none"
          stroke={colors[i]} strokeWidth="14"
          strokeDasharray={`${dash} ${gap}`}
          strokeDashoffset={-offset * circumference}
          strokeLinecap="butt"
          style={{ transition: 'stroke-dasharray 0.6s ease' }}
        />
      );
      offset += pct;
      return seg;
    });
  };

  // 4 small KPI cards — fills the 2x2 grid
  const smallKpis = [
    { label: 'Pending Quotations',          value: loading ? '—' : kpis.pendingQuotations,               icon: FileText,     color: '#f59e0b', to: '/projects' },
    { label: 'Labour Paid (This Month)',    value: loading ? '—' : fmt(kpis.labourPaidCurrentMonth),      icon: Users,        color: '#8b5cf6', to: '/finance'  },
    { label: 'Labour Paid (Previous Month)', value: loading ? '—' : fmt(kpis.labourPaidPreviousMonth),    icon: Users,        color: '#6366f1', to: '/finance'  },
    { label: 'Monthly Expenses',            value: loading ? '—' : fmt(kpis.monthlyExpenses),             icon: TrendingDown, color: '#ef4444', to: '/finance'  },
  ];

  const typeConfig = {
    Residential: { color: '#8b5cf6', bg: '#ede9fe' },
    Commercial:  { color: '#3b82f6', bg: '#dbeafe' },
    Industrial:  { color: '#f59e0b', bg: '#fef3c7' },
    Maintenance: { color: '#10b981', bg: '#d1fae5' },
    Plantation:  { color: '#059669', bg: '#d1fae5' },
  };

  return (
    <div className="db-layout">
      <Sidebar />
      <div className="db-right">
        <Header title="Dashboard" />
        <main className="db-main animate-fade">

          {/* Greeting */}
          <div className="db-greeting-row">
            <div>
              <h1 className="db-greeting-title">
                {greeting()}, {profile?.full_name?.split(' ')[0] || 'Admin'}
              </h1>
              <p className="db-greeting-sub">Here is what is happening at your sites today.</p>
            </div>
            <button className="db-refresh-btn" onClick={fetchDashboardData} disabled={loading}>
              <RefreshCw size={13} className={loading ? 'db-spin' : ''} />
              Refresh
            </button>
          </div>

          {/* Hero KPI row — Projects first, then Receivables */}
          <div className="db-hero-row">

            {/* Hero 1 — Active Projects */}
            <button className="db-hero-card" onClick={() => navigate('/projects')} style={{ '--hero-accent': '#3b82f6' }}>
              <div className="db-hero-card-top">
                <div className="db-hero-icon" style={{ background: '#dbeafe', color: '#3b82f6' }}>
                  <Briefcase size={20} />
                </div>
                <span className="db-hero-tag" style={{ background: '#dbeafe', color: '#1e40af' }}>Projects</span>
              </div>
              <div className="db-hero-value">{loading ? '—' : kpis.activeProjects}</div>
              <div className="db-hero-label">Active sites currently under execution</div>
              <div className="db-hero-footer">
                <span>View Projects</span>
                <ArrowRight size={13} />
              </div>
            </button>

            {/* Hero 2 — Receivables */}
            <button className="db-hero-card" onClick={() => navigate('/finance')} style={{ '--hero-accent': '#10b981' }}>
              <div className="db-hero-card-top">
                <div className="db-hero-icon" style={{ background: '#d1fae5', color: '#10b981' }}>
                  <TrendingUp size={20} />
                </div>
                <span className="db-hero-tag" style={{ background: '#d1fae5', color: '#065f46' }}>Receivables</span>
              </div>
              <div className="db-hero-value">{loading ? '—' : fmt(kpis.totalReceivables)}</div>
              <div className="db-hero-label">Total unpaid invoices pending collection</div>
              <div className="db-hero-footer">
                <span>View Finance</span>
                <ArrowRight size={13} />
              </div>
            </button>

            {/* 4 small KPIs */}
            <div className="db-small-kpi-grid">
              {smallKpis.map((k, i) => {
                const Icon = k.icon;
                return (
                  <button key={i} className="db-small-kpi" onClick={() => navigate(k.to)} style={{ '--kc': k.color }}>
                    <div className="db-small-kpi-icon" style={{ background: k.color + '18', color: k.color }}>
                      <Icon size={14} />
                    </div>
                    <div className="db-small-kpi-val">{k.value}</div>
                    <div className="db-small-kpi-lbl">{k.label}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Lower section */}
          <div className="db-lower">

            {/* Recent Projects */}
            <section className="db-card">
              <div className="db-card-head">
                <div>
                  <h2 className="db-card-title">Recent Projects</h2>
                  <p className="db-card-desc">Latest active site portfolios</p>
                </div>
                <button className="db-see-all" onClick={() => navigate('/projects')}>
                  View all <ArrowRight size={12} />
                </button>
              </div>

              {loading ? (
                <div className="db-loading-state"><Loader2 size={18} className="db-spin" /></div>
              ) : recentProjects.length === 0 ? (
                <div className="db-empty-state">No projects yet. Create one to get started.</div>
              ) : (
                <div className="db-project-cards">
                  {recentProjects.map(p => {
                    const sc = statusConfig[p.status] || statusConfig['On Hold'];
                    const tc = typeConfig[p.type] || { color: '#64748b', bg: '#f1f5f9' };
                    return (
                      <div key={p.id} className="db-project-card" onClick={() => navigate(`/projects/${p.id}`)}>
                        <div className="db-project-card-left">
                          <div className="db-project-card-accent" style={{ background: sc.color }} />
                          <div className="db-project-card-body">
                            <div className="db-project-card-top">
                              <span className="db-project-card-name">{p.name}</span>
                              <span className="db-project-card-budget">{fmt(p.budget || 0)}</span>
                            </div>
                            <div className="db-project-card-meta">
                              <span className="db-project-card-client">{p.client_name}</span>
                              {p.site_address && (
                                <span className="db-project-card-location">
                                  <MapPin size={10} /> {p.site_address}
                                </span>
                              )}
                            </div>
                            <div className="db-project-card-footer">
                              <span className="db-type-pill" style={{ background: tc.bg, color: tc.color }}>{p.type}</span>
                              <span className="db-status-pill" style={{ background: sc.bg, color: sc.color }}>{p.status}</span>
                            </div>
                          </div>
                        </div>
                        <ArrowRight size={14} className="db-project-card-arrow" />
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Donut — spans 2 rows */}
            <section className="db-card db-donut-card">
              <div className="db-card-head">
                <h2 className="db-card-title">Project Status</h2>
                <span className="db-card-sub">{totalProjects} total</span>
              </div>
              {loading ? (
                <div className="db-loading-state"><Loader2 size={18} className="db-spin" /></div>
              ) : (
                <div className="db-donut-wrap">
                  <div className="db-donut-chart">
                    <svg viewBox="0 0 140 140" width="140" height="140">
                      <circle cx="70" cy="70" r="54" fill="none" stroke="#f1f5f9" strokeWidth="14" />
                      {totalProjects > 0 ? donutSegments() : null}
                      <text x="70" y="65" textAnchor="middle" fontSize="22" fontWeight="700" fill="#0b3d27" fontFamily="Outfit, sans-serif">{totalProjects}</text>
                      <text x="70" y="82" textAnchor="middle" fontSize="10" fill="#94a3b8" fontFamily="Inter, sans-serif">projects</text>
                    </svg>
                  </div>
                  <ul className="db-donut-legend">
                    {Object.entries(statusConfig).map(([key, cfg]) => (
                      <li key={key} className="db-legend-item">
                        <span className="db-legend-dot" style={{ background: cfg.color }} />
                        <span className="db-legend-label">{key}</span>
                        <span className="db-legend-count" style={{ color: cfg.color }}>{projectStatusCounts[key] || 0}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>

            {/* Recent Transactions — rich rows */}
            <section className="db-card db-tx-card">
              <div className="db-card-head">
                <div>
                  <h2 className="db-card-title">Recent Transactions</h2>
                  <p className="db-card-desc">Latest ledger entries</p>
                </div>
                <button className="db-see-all" onClick={() => navigate('/finance')}>
                  View all <ArrowRight size={12} />
                </button>
              </div>

              {loading ? (
                <div className="db-loading-state"><Loader2 size={18} className="db-spin" /></div>
              ) : recentTransactions.length === 0 ? (
                <div className="db-empty-state">No transactions recorded yet.</div>
              ) : (
                <div className="db-tx-list">
                  {recentTransactions.map(tx => {
                    const isCredit = tx.type === 'Credit';
                    return (
                      <div key={tx.id} className="db-tx-row">
                        <div className="db-tx-icon" style={{ background: isCredit ? '#d1fae5' : '#fee2e2', color: isCredit ? '#10b981' : '#ef4444' }}>
                          {isCredit ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                        </div>
                        <div className="db-tx-info">
                          <span className="db-tx-name">{tx.category}</span>
                          <span className="db-tx-meta">
                            {tx.projects?.name || 'General'} · {tx.date}
                          </span>
                        </div>
                        <div className="db-tx-right">
                          <span className="db-tx-amount" style={{ color: isCredit ? '#10b981' : '#ef4444' }}>
                            {isCredit ? '+' : '-'}₹{Number(tx.amount).toLocaleString('en-IN')}
                          </span>
                          <span className="db-tx-badge" style={{
                            background: isCredit ? '#d1fae5' : '#fee2e2',
                            color: isCredit ? '#065f46' : '#991b1b'
                          }}>
                            {isCredit ? 'Inflow' : 'Outflow'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

          </div>
        </main>
      </div>
    </div>
  );
}