import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LogOut, Check, X, Download, Loader2 } from 'lucide-react';
import { formatCurrency } from '../utils/helpers';
import { supabase } from '../supabase';
import '../styles/clientPortal.css';

export default function ClientPortal() {
  const { signOut, user } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState(null);
  const [drawings, setDrawings] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (user?.email) {
      fetchClientData();
    }
  }, [user]);

  const fetchClientData = async () => {
    setLoading(true);
    try {
      let { data: clientProjects, error: pError } = await supabase
        .from('projects')
        .select('*')
        .eq('client_email', user.email);

      if (pError) throw pError;

      if (!clientProjects || clientProjects.length === 0) {
        const { data: teamAssigns } = await supabase
          .from('project_team')
          .select('project_id, projects(*)')
          .eq('profile_id', user.id);
        
        if (teamAssigns && teamAssigns.length > 0) {
          clientProjects = teamAssigns.map(ta => ta.projects);
        }
      }

      if (clientProjects && clientProjects.length > 0) {
        const activeProj = clientProjects[0];
        setProject(activeProj);

        const { data: dwgData, error: dwgError } = await supabase
          .from('site_drawings')
          .select('*')
          .eq('project_id', activeProj.id)
          .order('submission_date', { ascending: false });

        if (dwgError) throw dwgError;
        setDrawings(dwgData || []);

        const { data: invData, error: invError } = await supabase
          .from('invoices')
          .select('*')
          .eq('project_id', activeProj.id)
          .order('due_date', { ascending: false });

        if (invError) throw invError;
        setInvoices(invData || []);

        const { data: stages } = await supabase
          .from('schedule_stages')
          .select('status')
          .eq('project_id', activeProj.id);

        if (stages && stages.length > 0) {
          const completed = stages.filter(s => s.status === 'Completed').length;
          setProgress(Math.round((completed / stages.length) * 100));
        } else {
          setProgress(30); 
        }
      }
    } catch (err) {
      console.error('Error loading client portal:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (dwgId, approvalStatus) => {
    try {
      const dbStatus = approvalStatus === 'Approved' ? 'Approved' : 'Revision Required';
      const commentStr = approvalStatus === 'Approved' 
        ? 'Approved by client via Client Hub' 
        : 'Revision requested by client';
      
      const { error } = await supabase
        .from('site_drawings')
        .update({ 
          status: dbStatus,
          client_comments: commentStr
        })
        .eq('id', dwgId);

      if (error) throw error;
      fetchClientData();
    } catch (err) {
      console.error('Error updating drawing status:', err);
      alert(err.message || 'Failed to update approval status');
    }
  };

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg)' }}>
        <Loader2 className="db-spin" size={36} />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="client-portal-container" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <header className="client-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <h1 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--primary)' }}>GreenSpire Client Hub</h1>
          </div>
          <button onClick={handleLogout} className="btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}>
            <LogOut size={14} /> Sign Out
          </button>
        </header>
        <main className="client-content-body" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
          <div className="glass-card" style={{ padding: '2rem', textAlign: 'center', maxWidth: '480px' }}>
            <h2 style={{ color: 'var(--primary)', marginBottom: '0.5rem' }}>No Active Project</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              Your account ({user?.email}) is not currently associated with any active landscaping project in the system.
            </p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="client-portal-container">
      {/* Top Header */}
      <header className="client-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ backgroundColor: 'var(--primary)', color: 'white', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px', fontWeight: 'bold' }}>
            GS
          </div>
          <div>
            <h1 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--primary)' }}>GreenSpire Client Hub</h1>
            <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Real-time coordination space</p>
          </div>
        </div>

        <button onClick={handleLogout} className="btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}>
          <LogOut size={14} /> Sign Out
        </button>
      </header>

      {/* Main Body */}
      <main className="client-content-body animate-fade">
        <div className="client-project-summary-card">
          <div>
            <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>Active Project Workspace</span>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--primary)' }}>{project.name}</h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Location: {project.site_address || 'TBD'} | Completion: {project.completion_date || 'TBD'}</p>
          </div>

          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Staging Phase Progress</span>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--primary)' }}>{progress}% Completed</div>
          </div>
        </div>

        <div className="client-grid-sections">
          {/* Drawings Review */}
          <div className="glass-card" style={{ padding: '1.5rem', border: '1px solid var(--border)' }}>
            <h3 className="client-card-title">
              <span>Drawings Approval Register</span>
            </h3>

            <div className="client-drawings-grid">
              {drawings.map(dwg => (
                <div key={dwg.id} className="client-drawing-card">
                  <div>
                    <span 
                      className="client-drawing-status-pill"
                      style={{
                        backgroundColor: dwg.status === 'Approved' ? 'var(--accent-light)' : dwg.status === 'Revision Required' ? '#fee2e2' : '#fef3c7',
                        color: dwg.status === 'Approved' ? 'var(--primary)' : dwg.status === 'Revision Required' ? '#b91c1c' : '#b45309'
                      }}
                    >
                      {dwg.status === 'Revision Required' ? 'Revision Needed' : dwg.status}
                    </span>
                    <h4 style={{ fontSize: '1rem', fontWeight: 700, margin: '0.25rem 0' }}>{dwg.drawing_number}</h4>
                    <p style={{ fontSize: '0.85rem', fontWeight: 600 }}>{dwg.name}</p>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Submitted: {dwg.submission_date} | Rev R{dwg.revision_number}</p>
                  </div>

                  <div className="client-action-row">
                    {dwg.status === 'Draft' || dwg.status === 'Under Review' ? (
                      <>
                        <button 
                          onClick={() => handleApprove(dwg.id, 'Approved')}
                          className="btn-primary" 
                          style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem', flex: 1, justifyContent: 'center' }}
                        >
                          <Check size={14} /> Approve
                        </button>
                        <button 
                          onClick={() => handleApprove(dwg.id, 'Revision Required')}
                          className="btn-secondary" 
                          style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem', flex: 1, justifyContent: 'center', borderColor: '#f87171', color: '#dc2626' }}
                        >
                          <X size={14} /> Reject
                        </button>
                      </>
                    ) : (
                      <button className="btn-secondary" style={{ width: '100%', padding: '0.4rem', fontSize: '0.75rem', justifyContent: 'center' }} disabled>
                        Review Registered ({dwg.status === 'Approved' ? 'Approved' : 'Revision Needed'})
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {drawings.length === 0 && (
                <div style={{ color: 'var(--text-muted)', gridColumn: '1/-1', textAlign: 'center', padding: '2rem' }}>
                  No landscape drawings are available for your review yet.
                </div>
              )}
            </div>
          </div>

          {/* Invoices List */}
          <div className="glass-card" style={{ padding: '1.5rem', border: '1px solid var(--border)' }}>
            <h3 className="client-card-title">
              <span>Billing & Payments Registry</span>
            </h3>

            <div className="table-responsive">
              <table className="app-table">
                <thead>
                  <tr>
                    <th>Invoice No.</th>
                    <th>Issued Date</th>
                    <th>Due Amount</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map(inv => (
                    <tr key={inv.id}>
                      <td style={{ fontWeight: 700 }}>{inv.invoice_number}</td>
                      <td>{inv.created_at ? new Date(inv.created_at).toLocaleDateString('en-IN') : 'N/A'}</td>
                      <td style={{ fontWeight: 700 }}>{formatCurrency(inv.total_amount)}</td>
                      <td>
                        <span className={`badge ${inv.status === 'Paid' ? 'badge-approved' : 'badge-alert'}`}>
                          {inv.status}
                        </span>
                      </td>
                      <td>
                        {inv.file_url ? (
                          <a href={inv.file_url} target="_blank" rel="noreferrer" style={{ color: 'var(--primary)' }} title="Download invoice copy">
                            <Download size={16} />
                          </a>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>No File</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {invoices.length === 0 && (
                    <tr>
                      <td colSpan="5" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
                        No invoices generated for this project yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
