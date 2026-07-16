import { useState, useEffect } from 'react';
import { useLocation, useParams, useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import {
  ChevronLeft, Loader2,
  LayoutDashboard, ClipboardList, Compass, Users,
  Calendar, MapPin, Files, FileSignature, Handshake,
  Receipt, Boxes, Coins, Edit2, X, Check
} from 'lucide-react';
import { supabase } from '../supabase';

import TabOverview        from '../components/tabs/TabOverview';
import TabExecutionScope  from '../components/tabs/TabExecutionScope';
import TabDesignLayouts   from '../components/tabs/TabDesignLayouts';
import TabTeam            from '../components/tabs/TabTeam';
import TabSchedule        from '../components/tabs/TabSchedule';
import TabSiteVisits      from '../components/tabs/TabSiteVisits';
import TabDocuments       from '../components/tabs/TabDocuments';
import TabQuotations      from '../components/tabs/TabQuotations';
import TabContracts       from '../components/tabs/TabContracts';
import TabInvoices        from '../components/tabs/TabInvoices';
import TabResources       from '../components/tabs/TabResources';
import TabFinance         from '../components/tabs/TabFinance';

import '../styles/projectDetail.css';

const STATUS_OPTIONS = ['Active', 'Completed', 'Pending', 'On Hold'];

const TABS = [
  { name: 'Overview',            icon: LayoutDashboard, component: TabOverview },
  { name: 'Quotations',          icon: FileSignature,   component: TabQuotations },
  { name: 'Invoices',            icon: Receipt,         component: TabInvoices },
  { name: 'Documents',           icon: Files,           component: TabDocuments },
  { name: 'Finance',             icon: Coins,           component: TabFinance },
  { name: 'Execution Scope',     icon: ClipboardList,   component: TabExecutionScope },
  { name: 'Design Layouts',      icon: Compass,         component: TabDesignLayouts },
  { name: 'Schedule',            icon: Calendar,        component: TabSchedule },
  { name: 'Site Visits',         icon: MapPin,          component: TabSiteVisits },
  { name: 'Contracts',           icon: Handshake,       component: TabContracts },
  { name: 'Resources',           icon: Boxes,           component: TabResources },
  { name: 'Team',                icon: Users,           component: TabTeam },
];

const STATUS_CONFIG = {
  Active:     { color: '#10b981', bg: '#ecfdf5' },
  Completed:  { color: '#3b82f6', bg: '#eff6ff' },
  Pending:    { color: '#f59e0b', bg: '#fffbeb' },
  'On Hold':  { color: '#94a3b8', bg: '#f8fafc' },
};

export default function ProjectDetail() {
  const { id }       = useParams();
  const location     = useLocation();
  const navigate     = useNavigate();

  const [project, setProject]     = useState(location.state?.project || null);
  const [loading, setLoading]     = useState(!project);
  const [activeTab, setActiveTab] = useState('Overview');
  const [editStatus, setEditStatus] = useState(false);
  const [savingStatus, setSavingStatus] = useState(false);
  const [tempStatus, setTempStatus] = useState('');

  useEffect(() => {
    if (!project) fetchProject();
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [id]);

  // Scroll to top whenever the active tab changes
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [activeTab]);

  const fetchProject = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('projects').select('*').eq('id', id).single();
      if (error) throw error;
      setProject(data);
    } catch (err) {
      console.error('Error fetching project:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusSave = async () => {
    setSavingStatus(true);
    try {
      const { error } = await supabase.from('projects').update({ status: tempStatus }).eq('id', id);
      if (error) throw error;
      setProject(prev => ({ ...prev, status: tempStatus }));
      setEditStatus(false);
    } catch (err) {
      alert('Failed to update status');
    } finally {
      setSavingStatus(false);
    }
  };

  const ActiveComponent = TABS.find(t => t.name === activeTab)?.component || TabOverview;
  const sc = STATUS_CONFIG[project?.status] || STATUS_CONFIG['On Hold'];

  if (loading) return (
    <div className="pd-layout">
      <Sidebar />
      <div className="pd-right">
        <Header title="Loading..." />
        <div className="pd-loader"><Loader2 size={28} className="db-spin" style={{ color: '#10b981' }} /></div>
      </div>
    </div>
  );

  if (!project) return (
    <div className="pd-layout">
      <Sidebar />
      <div className="pd-right">
        <Header title="Not Found" />
        <div className="pd-loader">
          <p style={{ color: '#64748b', marginBottom: '1rem' }}>Project not found.</p>
          <button className="pj-add-btn" onClick={() => navigate('/projects')}>Back to Projects</button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="pd-layout">
      <Sidebar />
      <div className="pd-right">
        <Header title={project.name} />

        <div className="pd-main animate-fade">

          {/* Back + project meta bar */}
          <div className="pd-topbar">
            <button className="pd-back-btn" onClick={() => navigate('/projects')}>
              <ChevronLeft size={15} /> Projects
            </button>
            <div className="pd-meta">
              <span className="pd-meta-name">{project.name}</span>
              <span className="pd-meta-sep">·</span>
              <span className="pd-meta-client">{project.client_name}</span>
              <span className="pd-meta-sep">·</span>
              <span className="pd-meta-type">{project.type}</span>
              <span className="pd-meta-sep">·</span>
              {editStatus ? (
                <div className="pd-status-edit">
                  <select
                    value={tempStatus}
                    onChange={e => setTempStatus(e.target.value)}
                    className="pd-status-select"
                  >
                    {STATUS_OPTIONS.map(s => <option key={s}>{s}</option>)}
                  </select>
                  <button className="pd-status-save" onClick={handleStatusSave} disabled={savingStatus}>
                    <Check size={13} />
                  </button>
                  <button className="pd-status-cancel" onClick={() => setEditStatus(false)}>
                    <X size={13} />
                  </button>
                </div>
              ) : (
                <div className="pd-status-wrap">
                  <span className="pd-status-badge" style={{ color: sc.color, background: sc.bg }}>
                    {project.status}
                  </span>
                  <button
                    className="pd-status-edit-btn"
                    onClick={() => { setTempStatus(project.status); setEditStatus(true); }}
                    title="Edit status"
                  >
                    <Edit2 size={11} />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Main layout */}
          <div className="pd-body">

            {/* Left tab menu */}
            <aside className="pd-tab-menu">
              {TABS.map(tab => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.name;
                return (
                  <button
                    key={tab.name}
                    onClick={() => setActiveTab(tab.name)}
                    className={`pd-tab-btn ${isActive ? 'active' : ''}`}
                  >
                    <Icon size={14} className="pd-tab-icon" />
                    <span>{tab.name}</span>
                  </button>
                );
              })}
            </aside>

            {/* Tab content */}
            <main className="pd-tab-content">
              <ActiveComponent project={project} key={`${activeTab}-${project.id}`} />
            </main>
          </div>
        </div>
      </div>
    </div>
  );
}