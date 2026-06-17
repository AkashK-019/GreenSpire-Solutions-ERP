import { useState, useEffect } from 'react';
import { formatDate } from '../../utils/helpers';
import { Camera, Clipboard, FileText, Loader2, ExternalLink } from 'lucide-react';
import { supabase } from '../../supabase';

export default function TabOverview({ project }) {
  const [loading, setLoading]   = useState(true);
  const [reports, setReports]   = useState([]);
  const [lightbox, setLightbox] = useState(null);
  const [spent, setSpent]       = useState(0);
  const [stages, setStages]     = useState([]);

  useEffect(() => { fetchData(); }, [project.id]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [{ data: reportData, error }, { data: ledger }, { data: stageData }] = await Promise.all([
        supabase.from('daily_site_reports').select('*').eq('project_id', project.id).order('report_date', { ascending: false }),
        supabase.from('finance_ledger').select('amount, type').eq('project_id', project.id),
        supabase.from('schedule_stages').select('status').eq('project_id', project.id),
      ]);
      if (error) throw error;
      setReports(reportData || []);

      const totalSpent = (ledger || []).filter(l => l.type === 'Debit').reduce((s, l) => s + Number(l.amount), 0);
      setSpent(totalSpent);
      setStages(stageData || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const allPhotos = [];
  reports.forEach(r => {
    (r.photo_urls || []).forEach(url => allPhotos.push({ url, date: r.report_date }));
  });

  const latestReport = reports[0];

  const statusConfig = {
    Active:    { color: '#10b981', bg: '#ecfdf5' },
    Completed: { color: '#3b82f6', bg: '#eff6ff' },
    Pending:   { color: '#f59e0b', bg: '#fffbeb' },
    'On Hold': { color: '#94a3b8', bg: '#f8fafc' },
  };
  const sc = statusConfig[project?.status] || statusConfig['On Hold'];

  return (
    <div className="animate-fade">

      {lightbox && (
        <div className="tab-lightbox-overlay" onClick={() => setLightbox(null)}>
          <button className="tab-lightbox-close" onClick={() => setLightbox(null)}>&times;</button>
          <img src={lightbox} alt="Site" className="tab-lightbox-img" onClick={e => e.stopPropagation()} />
        </div>
      )}

      <div className="tab-page-head" style={{ marginBottom: '1.25rem' }}>
        <div>
          <h2 className="tab-page-title">Project Overview</h2>
          <p className="tab-page-sub">Client details, current phase, and latest site activity.</p>
        </div>
      </div>

      <div className="tab-grid-2" style={{ marginBottom: '1.25rem' }}>

        {/* Client & Properties */}
        <div className="tab-card">
          <div className="tab-card-head">
            <span className="tab-card-title"><FileText size={14} /> Client & Properties</span>
          </div>
          <div className="tab-card-body">
            <table style={{ width: '100%', fontSize: '0.84rem', borderCollapse: 'collapse' }}>
              <tbody>
                {[
                  ['Client Name',  project?.client_name || '—'],
                  ['Client Email', project?.client_email || '—'],
                  ['Site Address', project?.site_address || '—'],
                  ['Plot Area',    project?.plot_area ? `${Number(project.plot_area).toLocaleString()} Sq.Ft.` : '—'],
                ].map(([label, value]) => (
                  <tr key={label} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '0.55rem 0', color: '#64748b', width: '40%' }}>{label}</td>
                    <td style={{ padding: '0.55rem 0', fontWeight: 600, color: '#1e293b', textAlign: 'right' }}>{value}</td>
                  </tr>
                ))}
                <tr>
                  <td style={{ padding: '0.55rem 0', color: '#64748b' }}>Map Location</td>
                  <td style={{ padding: '0.55rem 0', textAlign: 'right' }}>
                    {project?.map_location ? (
                      <a href={project.map_location} target="_blank" rel="noopener noreferrer"
                        style={{ color: '#10b981', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.82rem' }}>
                        Open Map <ExternalLink size={11} />
                      </a>
                    ) : <span style={{ color: '#94a3b8' }}>Not set</span>}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Current Phase */}
        <div className="tab-card">
          <div className="tab-card-head">
            <span className="tab-card-title"><Clipboard size={14} /> Current Phase</span>
          </div>
          <div className="tab-card-body">
            <table style={{ width: '100%', fontSize: '0.84rem', borderCollapse: 'collapse' }}>
              <tbody>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '0.55rem 0', color: '#64748b' }}>Status</td>
                  <td style={{ padding: '0.55rem 0', textAlign: 'right' }}>
                    <span className="tab-badge" style={{ background: sc.bg, color: sc.color }}>{project?.status}</span>
                  </td>
                </tr>
                {[
                  ['Type',       project?.type || '—'],
                  ['Budget',     project?.budget ? `₹${Number(project.budget).toLocaleString('en-IN')}` : '—'],
                  ['Start Date', project?.start_date ? formatDate(project.start_date) : '—'],
                  ['End Date',   project?.completion_date ? formatDate(project.completion_date) : '—'],
                ].map(([label, value]) => (
                  <tr key={label} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '0.55rem 0', color: '#64748b' }}>{label}</td>
                    <td style={{ padding: '0.55rem 0', fontWeight: 600, color: '#1e293b', textAlign: 'right' }}>{value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Project Health */}
      <div className="tab-card" style={{ marginBottom: '1.25rem' }}>
        <div className="tab-card-head">
          <span className="tab-card-title">Project Health</span>
        </div>
        <div className="tab-card-body">
          <div className="tab-kpi-row" style={{ marginBottom: 0 }}>

            {/* Days remaining */}
            <div className="tab-kpi">
              <div className="tab-kpi-label">Days Remaining</div>
              <div className="tab-kpi-value">
                {project?.completion_date
                  ? (() => {
                      const diff = Math.ceil((new Date(project.completion_date) - new Date()) / (1000 * 60 * 60 * 24));
                      if (diff > 0) return `${diff}d`;
                      if (diff === 0) return 'Today';
                      return `${Math.abs(diff)}d overdue`;
                    })()
                  : '—'}
              </div>
            </div>

            {/* Budget utilization */}
            <div className="tab-kpi">
              <div className="tab-kpi-label">Budget Used</div>
              <div className="tab-kpi-value">
                {project?.budget ? `${Math.min(100, Math.round((spent / Number(project.budget)) * 100))}%` : '—'}
              </div>
              <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '2px' }}>
                ₹{spent.toLocaleString('en-IN')} of ₹{Number(project?.budget || 0).toLocaleString('en-IN')}
              </div>
            </div>

            {/* Stage progress */}
            <div className="tab-kpi">
              <div className="tab-kpi-label">Stages Completed</div>
              <div className="tab-kpi-value">
                {stages.length > 0
                  ? `${stages.filter(s => s.status === 'Completed').length}/${stages.length}`
                  : '—'}
              </div>
            </div>
          </div>

          {/* Progress bars */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', marginTop: '1rem' }}>
            {project?.budget > 0 && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#64748b', marginBottom: '4px' }}>
                  <span>Budget Utilization</span>
                  <span>{Math.min(100, Math.round((spent / Number(project.budget)) * 100))}%</span>
                </div>
                <div className="pj-progress-track">
                  <div className="pj-progress-fill"
                    style={{
                      width: `${Math.min(100, Math.round((spent / Number(project.budget)) * 100))}%`,
                      background: (spent / Number(project.budget)) > 0.9 ? '#ef4444' : (spent / Number(project.budget)) > 0.7 ? '#f59e0b' : '#10b981'
                    }} />
                </div>
              </div>
            )}

            {stages.length > 0 && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#64748b', marginBottom: '4px' }}>
                  <span>Schedule Progress</span>
                  <span>{Math.round((stages.filter(s => s.status === 'Completed').length / stages.length) * 100)}%</span>
                </div>
                <div className="pj-progress-track">
                  <div className="pj-progress-fill"
                    style={{
                      width: `${Math.round((stages.filter(s => s.status === 'Completed').length / stages.length) * 100)}%`,
                      background: '#10b981'
                    }} />
                </div>
              </div>
            )}

            {!project?.budget && stages.length === 0 && (
              <div className="tab-empty" style={{ padding: '0.75rem' }}>
                Add a budget and schedule stages to see project health metrics.
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="tab-grid-2">

        {/* Recent Site Photos */}
        <div className="tab-card">
          <div className="tab-card-head">
            <span className="tab-card-title"><Camera size={14} /> Recent Site Photos</span>
            <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>{allPhotos.length} total</span>
          </div>
          <div className="tab-card-body">
            {loading ? (
              <div className="tab-empty" style={{ padding: '1.5rem' }}>
                <Loader2 size={16} className="db-spin" style={{ color: '#10b981' }} />
              </div>
            ) : allPhotos.length === 0 ? (
              <div className="tab-empty" style={{ padding: '1.5rem' }}>
                <Camera size={24} style={{ color: '#e2e8f0' }} />
                No photos uploaded yet.
              </div>
            ) : (
              <div className="tab-photo-grid">
                {allPhotos.slice(0, 6).map((p, i) => (
                  <img key={i} src={p.url} alt={`Site ${i+1}`}
                    className="tab-photo-thumb"
                    onClick={() => setLightbox(p.url)}
                    title={`${p.date} — click to enlarge`}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Latest Work Log */}
        <div className="tab-card">
          <div className="tab-card-head">
            <span className="tab-card-title"><Clipboard size={14} /> Latest Site Log</span>
            {latestReport && (
              <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>{latestReport.report_date}</span>
            )}
          </div>
          <div className="tab-card-body">
            {loading ? (
              <div className="tab-empty" style={{ padding: '1.5rem' }}>
                <Loader2 size={16} className="db-spin" style={{ color: '#10b981' }} />
              </div>
            ) : !latestReport ? (
              <div className="tab-empty" style={{ padding: '1.5rem', fontSize: '0.8rem' }}>
                No reports yet. Visit the Site Visits tab to log one.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.84rem' }}>
                <div>
                  <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Work Done</div>
                  <p style={{ color: '#1e293b', lineHeight: 1.5 }}>{latestReport.work_done}</p>
                </div>
                {latestReport.issues_on_site && (
                  <div>
                    <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Issues</div>
                    <p style={{ color: '#1e293b', lineHeight: 1.5 }}>{latestReport.issues_on_site}</p>
                  </div>
                )}
                <div style={{ display: 'flex', gap: '1.5rem', paddingTop: '4px' }}>
                  <div>
                    <div style={{ fontSize: '0.68rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Supervisor</div>
                    <div style={{ fontWeight: 600, color: '#1e293b', fontSize: '0.82rem' }}>{latestReport.weather_condition || '—'}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.68rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Labour</div>
                    <div style={{ fontWeight: 600, color: '#1e293b', fontSize: '0.82rem' }}>{latestReport.labour_count || 0}</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}