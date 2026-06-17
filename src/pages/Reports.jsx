import { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import { BarChart2, TrendingUp, IndianRupee, FileText, Download, Users, Package, Loader2 } from 'lucide-react';
import { supabase } from '../supabase';
import '../index.css';

// Simple in-browser bar chart using divs
function BarChart({ data, max, color = 'var(--primary)', label }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
      {data.map((item) => (
        <div key={item.name} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ width: '100px', fontSize: '0.78rem', color: 'var(--text-muted)', textAlign: 'right', flexShrink: 0 }}>{item.name}</div>
          <div style={{ flex: 1, background: '#f1f5f9', borderRadius: '6px', height: '22px', overflow: 'hidden' }}>
            <div style={{ height: '100%', borderRadius: '6px', background: color, width: `${max > 0 ? Math.min((item.value / max) * 100, 100) : 0}%`, transition: 'width 0.6s ease', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: '6px' }}>
              <span style={{ fontSize: '0.7rem', color: 'white', fontWeight: 700, whiteSpace: 'nowrap' }}>{label === '₹' ? `₹${(item.value / 1000).toFixed(0)}K` : item.value}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

const REPORT_TYPES = ['Financial Summary', 'Project Wise P&L', 'Labour Payments', 'Inventory Report'];

export default function Reports() {
  const [loading, setLoading] = useState(true);
  const [activeReport, setActiveReport] = useState('Financial Summary');
  const [dateRange, setDateRange] = useState({ 
    from: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0], 
    to: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().split('T')[0] 
  });

  const [financialData, setFinancialData] = useState({
    totalRevenue: 0,
    totalExpenses: 0,
    labourCost: 0,
    materialCost: 0,
    overhead: 0,
    netProfit: 0,
    receivables: 0
  });

  const [projectPL, setProjectPL] = useState([]);
  const [monthlyRevenue, setMonthlyRevenue] = useState([]);

  useEffect(() => {
    fetchReportData();
  }, [dateRange]);

  const fetchReportData = async () => {
    setLoading(true);
    try {
      // 1. Fetch finance ledger entries in date range
      const { data: ledger, error: ledgerError } = await supabase
        .from('finance_ledger')
        .select('*')
        .gte('date', dateRange.from)
        .lte('date', dateRange.to);

      if (ledgerError) throw ledgerError;

      // 2. Fetch all project details
      const { data: projects, error: projectsError } = await supabase
        .from('projects')
        .select('*');

      if (projectsError) throw projectsError;

      // 3. Fetch invoices for receivables
      const { data: invoices, error: invoicesError } = await supabase
        .from('invoices')
        .select('total_amount, status');

      if (invoicesError) throw invoicesError;

      // 4. Fetch all time ledger entries to construct monthly revenue (for current calendar year)
      const startOfYear = new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0];
      const endOfYear = new Date(new Date().getFullYear(), 11, 31).toISOString().split('T')[0];
      const { data: yearlyLedger } = await supabase
        .from('finance_ledger')
        .select('*')
        .eq('type', 'Credit')
        .gte('date', startOfYear)
        .lte('date', endOfYear);

      // --- CALCULATIONS ---

      // Total Receivables from unpaid invoices
      const unpaidInvoicesTotal = (invoices || [])
        .filter(inv => inv.status === 'Unpaid' || inv.status === 'Overdue')
        .reduce((sum, inv) => sum + Number(inv.total_amount || 0), 0);

      // Financial metrics inside date range
      let revenue = 0;
      let expenses = 0;
      let labour = 0;
      let material = 0;
      let overheadsSum = 0;

      (ledger || []).forEach(tx => {
        const amt = Number(tx.amount || 0);
        if (tx.type === 'Credit') {
          revenue += amt;
        } else {
          expenses += amt;
          const catLower = (tx.category || '').toLowerCase();
          if (catLower.includes('labour') || catLower.includes('salary') || catLower.includes('wage')) {
            labour += amt;
          } else if (catLower.includes('plant') || catLower.includes('material') || catLower.includes('pipe') || catLower.includes('fertilizer')) {
            material += amt;
          } else {
            overheadsSum += amt;
          }
        }
      });

      setFinancialData({
        totalRevenue: revenue,
        totalExpenses: expenses,
        labourCost: labour,
        materialCost: material,
        overhead: overheadsSum,
        netProfit: revenue - expenses,
        receivables: unpaidInvoicesTotal
      });

      // Project-wise Profit & Loss
      // We calculate across all ledger history for project life P&L
      const { data: allLedger } = await supabase
        .from('finance_ledger')
        .select('*');

      const projectPLList = (projects || []).map(p => {
        const pLedger = (allLedger || []).filter(tx => tx.project_id === p.id);
        const pCost = pLedger
          .filter(tx => tx.type === 'Debit')
          .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
        const pRevenue = pLedger
          .filter(tx => tx.type === 'Credit')
          .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
        
        // Let's use budget as Contract Value, and pCost as actual cost
        const budgetVal = Number(p.budget || 0);
        const profit = budgetVal - pCost;

        return {
          name: p.name,
          revenue: budgetVal,
          cost: pCost,
          profit: profit
        };
      });
      setProjectPL(projectPLList);

      // Monthly Revenue Chart
      const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
      const monthlySums = Array(12).fill(0);

      (yearlyLedger || []).forEach(tx => {
        if (tx.date) {
          const monthIndex = new Date(tx.date).getMonth();
          if (monthIndex >= 0 && monthIndex < 12) {
            monthlySums[monthIndex] += Number(tx.amount || 0);
          }
        }
      });

      // Filter to show months up to the current month
      const currentMonthIndex = new Date().getMonth();
      const monthlyData = months.slice(0, currentMonthIndex + 1).map((m, idx) => ({
        name: m,
        value: monthlySums[idx]
      }));
      setMonthlyRevenue(monthlyData);

    } catch (err) {
      console.error('Error compiling reports metrics:', err);
    } finally {
      setLoading(false);
    }
  };

  const maxRevenue = monthlyRevenue.length > 0 ? Math.max(...monthlyRevenue.map(m => m.value)) : 0;

  const handleExport = () => {
    const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
      JSON.stringify({ financialData, projectPL, monthlyRevenue }, null, 2)
    )}`;
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', jsonString);
    downloadAnchor.setAttribute('download', `greenspire_report_${activeReport.toLowerCase().replace(/\s+/g, '_')}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Header title="Reports" />
        <main className="main-content animate-fade">
          {/* Page Header */}
          <div className="projects-header-bar" style={{ marginBottom: '1.5rem' }}>
            <div>
              <h1 style={{ fontSize: '1.75rem', fontWeight: 800 }}>Reports & Analytics</h1>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Business performance across projects, finances, and operations.</p>
            </div>
            <button className="btn-secondary" onClick={handleExport} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Download size={16} /> Export Report
            </button>
          </div>

          {/* Report Type Selector + Date Range */}
          <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
              {REPORT_TYPES.map(type => (
                <button key={type} onClick={() => setActiveReport(type)} style={{ padding: '0.45rem 1rem', borderRadius: '20px', border: '1px solid var(--border)', backgroundColor: activeReport === type ? 'var(--primary)' : 'white', color: activeReport === type ? 'white' : 'var(--text)', fontSize: '0.83rem', fontWeight: 600, cursor: 'pointer' }}>{type}</button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <input type="date" value={dateRange.from} onChange={e => setDateRange({ ...dateRange, from: e.target.value })} className="input-field" style={{ width: 'auto', fontSize: '0.85rem', padding: '0.4rem 0.75rem' }} />
              <span style={{ color: 'var(--text-muted)' }}>→</span>
              <input type="date" value={dateRange.to} onChange={e => setDateRange({ ...dateRange, to: e.target.value })} className="input-field" style={{ width: 'auto', fontSize: '0.85rem', padding: '0.4rem 0.75rem' }} />
            </div>
          </div>

          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
              <Loader2 className="db-spin" size={36} />
            </div>
          ) : (
            <>
              {/* Financial Summary */}
              {activeReport === 'Financial Summary' && (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
                    {[
                      { label: 'Total Inflow (Range)', val: financialData.totalRevenue, icon: <TrendingUp size={20} />, color: '#10b981' },
                      { label: 'Total Expenses (Range)', val: financialData.totalExpenses, icon: <IndianRupee size={20} />, color: '#dc2626' },
                      { label: 'Net Profit (Range)', val: financialData.netProfit, icon: <BarChart2 size={20} />, color: '#0284c7' },
                      { label: 'Outstanding Receivables', val: financialData.receivables, icon: <IndianRupee size={20} />, color: '#d97706' }
                    ].map(s => (
                      <div key={s.label} className="stat-card" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: `${s.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: s.color, flexShrink: 0 }}>{s.icon}</div>
                        <div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{s.label}</div>
                          <div style={{ fontSize: '1.3rem', fontWeight: 800, color: s.color }}>₹{s.val.toLocaleString('en-IN')}</div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', flexWrap: 'wrap' }}>
                    {/* Monthly Revenue Chart */}
                    <div className="stat-card" style={{ padding: '1.5rem' }}>
                      <h3 style={{ fontWeight: 700, marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <BarChart2 size={18} style={{ color: 'var(--primary)' }} /> Monthly Revenue ({new Date().getFullYear()})
                      </h3>
                      {monthlyRevenue.length === 0 ? (
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: '2rem' }}>No yearly revenue logged.</div>
                      ) : (
                        <BarChart data={monthlyRevenue} max={maxRevenue} color="var(--primary)" label="₹" />
                      )}
                    </div>

                    {/* Expense Breakdown */}
                    <div className="stat-card" style={{ padding: '1.5rem' }}>
                      <h3 style={{ fontWeight: 700, marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <IndianRupee size={18} style={{ color: '#dc2626' }} /> Expense Breakdown (Range)
                      </h3>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {[
                          { label: 'Labour Cost', amount: financialData.labourCost, color: '#6d28d9', pct: financialData.totalExpenses > 0 ? Math.round((financialData.labourCost / financialData.totalExpenses) * 100) : 0 },
                          { label: 'Material Cost', amount: financialData.materialCost, color: '#0284c7', pct: financialData.totalExpenses > 0 ? Math.round((financialData.materialCost / financialData.totalExpenses) * 100) : 0 },
                          { label: 'Overhead / Admin', amount: financialData.overhead, color: '#d97706', pct: financialData.totalExpenses > 0 ? Math.round((financialData.overhead / financialData.totalExpenses) * 100) : 0 }
                        ].map(e => (
                          <div key={e.label}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '0.82rem' }}>
                              <span style={{ color: 'var(--text)', fontWeight: 600 }}>{e.label}</span>
                              <span style={{ color: e.color, fontWeight: 700 }}>₹{e.amount.toLocaleString('en-IN')} ({e.pct}%)</span>
                            </div>
                            <div style={{ height: '8px', background: '#f1f5f9', borderRadius: '4px', overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${e.pct}%`, background: e.color, borderRadius: '4px' }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* Project Wise P&L */}
              {activeReport === 'Project Wise P&L' && (
                <div style={{ background: 'white', borderRadius: '14px', border: '1px solid var(--border)', overflow: 'hidden' }}>
                  <div style={{ padding: '1.25rem 1.5rem', fontWeight: 700, borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <FileText size={18} style={{ color: 'var(--primary)' }} /> Project-wise Profit & Loss (All Time Ledger)
                  </div>
                  <div className="table-responsive">
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                      <thead>
                        <tr style={{ background: '#f8fafc' }}>
                          {['Project', 'Contract Value (Budget)', 'Total Cost (Expenses)', 'Gross Profit', 'Margin %', 'Status'].map(h => (
                            <th key={h} style={{ padding: '0.875rem 1.25rem', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {projectPL.map((p, idx) => {
                          const margin = p.revenue > 0 ? Math.round((p.profit / p.revenue) * 100) : 0;
                          return (
                            <tr key={p.name} style={{ borderBottom: '1px solid #f1f5f9', background: idx % 2 === 0 ? 'white' : '#fafbfc' }}>
                              <td style={{ padding: '0.875rem 1.25rem', fontWeight: 600 }}>{p.name}</td>
                              <td style={{ padding: '0.875rem 1.25rem' }}>₹{p.revenue.toLocaleString('en-IN')}</td>
                              <td style={{ padding: '0.875rem 1.25rem', color: '#dc2626' }}>₹{p.cost.toLocaleString('en-IN')}</td>
                              <td style={{ padding: '0.875rem 1.25rem', color: p.profit >= 0 ? '#10b981' : '#dc2626', fontWeight: 700 }}>₹{p.profit.toLocaleString('en-IN')}</td>
                              <td style={{ padding: '0.875rem 1.25rem' }}>
                                <span style={{ padding: '0.2rem 0.6rem', borderRadius: '20px', fontSize: '0.72rem', fontWeight: 700, background: margin > 30 ? '#d1fae5' : margin > 15 ? '#fef3c7' : '#fee2e2', color: margin > 30 ? '#059669' : margin > 15 ? '#d97706' : '#dc2626' }}>{margin}%</span>
                              </td>
                              <td style={{ padding: '0.875rem 1.25rem' }}>
                                <span style={{ padding: '0.2rem 0.6rem', borderRadius: '20px', fontSize: '0.72rem', fontWeight: 700, background: p.cost === 0 ? '#f1f5f9' : '#d1fae5', color: p.cost === 0 ? '#94a3b8' : '#059669' }}>{p.cost === 0 ? 'Not Started' : 'Active'}</span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Labour Payments Report */}
              {activeReport === 'Labour Payments' && (
                <div className="stat-card" style={{ padding: '2rem', textAlign: 'center' }}>
                  <Users size={48} style={{ color: 'var(--primary)', marginBottom: '1rem', opacity: 0.8 }} />
                  <h3 style={{ fontWeight: 700, marginBottom: '0.5rem' }}>Labour Payment Summary</h3>
                  <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>Detailed wage, roster, and payment reports are available under the Labour section.</p>
                  <button className="btn-primary" onClick={() => window.location.href = '/labour'}>Go to Labour Management →</button>
                </div>
              )}

              {/* Inventory Report */}
              {activeReport === 'Inventory Report' && (
                <div className="stat-card" style={{ padding: '2rem', textAlign: 'center' }}>
                  <Package size={48} style={{ color: 'var(--primary)', marginBottom: '1rem', opacity: 0.8 }} />
                  <h3 style={{ fontWeight: 700, marginBottom: '0.5rem' }}>Inventory Valuation Report</h3>
                  <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>Live stock levels, low-stock alerts, and supplier-wise reports are in the Inventory section.</p>
                  <button className="btn-primary" onClick={() => window.location.href = '/inventory'}>Go to Inventory →</button>
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
