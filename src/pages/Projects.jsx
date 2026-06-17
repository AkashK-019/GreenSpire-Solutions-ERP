import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import {
  Plus, Search, MapPin, Sprout, Loader2,
  Activity, IndianRupee, CheckCircle, Trash2,
  Users, Calendar, TrendingUp, Pencil, Crosshair, Calculator
} from 'lucide-react';
import { supabase } from '../supabase';
import '../styles/projects.css';

const PROJECT_TYPES = ['All', 'Residential', 'Commercial', 'Industrial', 'Maintenance', 'Plantation'];
const STATUS_OPTIONS = ['Active', 'Completed', 'Pending', 'On Hold'];

const STATUS_CONFIG = {
  Active:     { color: '#10b981', bg: '#ecfdf5', label: 'Active' },
  Completed:  { color: '#3b82f6', bg: '#eff6ff', label: 'Completed' },
  Pending:    { color: '#f59e0b', bg: '#fffbeb', label: 'Pending' },
  'On Hold':  { color: '#94a3b8', bg: '#f8fafc', label: 'On Hold' },
};

const TYPE_CONFIG = {
  Residential: { color: '#8b5cf6' },
  Commercial:  { color: '#3b82f6' },
  Industrial:  { color: '#f59e0b' },
  Maintenance: { color: '#10b981' },
  Plantation:  { color: '#059669' },
};

export default function Projects() {
  const navigate = useNavigate();
  const [loading, setLoading]         = useState(true);
  const [searchTerm, setSearchTerm]   = useState('');
  const [typeFilter, setTypeFilter]   = useState('All');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingId, setEditingId]     = useState(null);
  const [projects, setProjects]       = useState([]);
  const [supervisors, setSupervisors] = useState([]);
  const [locating, setLocating]       = useState(false);
  const [showAreaCalc, setShowAreaCalc] = useState(false);
  const [calcValue, setCalcValue]     = useState('');
  const [calcFrom, setCalcFrom]       = useState('sqft');

  const [form, setForm] = useState({
    name: '', client_name: '', client_email: '', client_phone: '', type: 'Residential',
    site_address: '', map_location: '', plot_area: '',
    budget: '', start_date: '', completion_date: '',
    status: 'Active', supervisor_id: ''
  });

  useEffect(() => { fetchProjects(); fetchSupervisors(); }, []);

  const fetchProjects = async () => {
    setLoading(true);
    try {
      const { data: projData, error } = await supabase
        .from('projects').select('*').order('created_at', { ascending: false });
      if (error) throw error;

      const enriched = await Promise.all((projData || []).map(async (p) => {
        const { data: stages } = await supabase
          .from('schedule_stages').select('status').eq('project_id', p.id);
        const total     = stages?.length || 0;
        const completed = stages?.filter(s => s.status === 'Completed').length || 0;
        const progress  = total > 0 ? Math.round((completed / total) * 100) : 0;

        const { data: team } = await supabase
          .from('project_team').select('profiles(full_name)')
          .eq('project_id', p.id).eq('assigned_role', 'Supervisor').maybeSingle();

        return { ...p, progress, site_engineer: team?.profiles?.full_name || 'TBD' };
      }));

      setProjects(enriched);
    } catch (err) {
      console.error('Error fetching projects:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchSupervisors = async () => {
    try {
      const { data } = await supabase.from('profiles').select('id, full_name').in('role', ['Supervisor', 'Admin']);
      setSupervisors(data || []);
    } catch (err) {
      console.error('Error fetching supervisors:', err);
    }
  };

  const handleCreateProject = async (e) => {
    e.preventDefault();
    if (form.start_date && form.completion_date && new Date(form.completion_date) < new Date(form.start_date)) {
      alert('Completion date cannot be before start date.');
      return;
    }
    try {
      const payload = {
        name: form.name, client_name: form.client_name,
        client_email: form.client_email || null,
        client_phone: form.client_phone || null,
        type: form.type,
        site_address: form.site_address || null, map_location: form.map_location || null,
        plot_area: form.plot_area ? Number(form.plot_area) : null,
        budget: form.budget ? Number(form.budget) : 0,
        start_date: form.start_date || null,
        completion_date: form.completion_date || null, status: form.status
      };

      if (editingId) {
        // UPDATE existing project
        const { error } = await supabase.from('projects').update(payload).eq('id', editingId);
        if (error) throw error;

        // Update supervisor assignment
        await supabase.from('project_team').delete().eq('project_id', editingId).eq('assigned_role', 'Supervisor');
        if (form.supervisor_id) {
          await supabase.from('project_team').insert([{
            project_id: editingId, profile_id: form.supervisor_id, assigned_role: 'Supervisor'
          }]);
        }
      } else {
        // CREATE new project
        const { data, error } = await supabase.from('projects').insert([payload]).select().single();
        if (error) throw error;

        if (form.supervisor_id && data) {
          await supabase.from('project_team').insert([{
            project_id: data.id, profile_id: form.supervisor_id, assigned_role: 'Supervisor'
          }]);
        }
      }

      setShowAddModal(false);
      setEditingId(null);
      setForm({ name: '', client_name: '', client_email: '', client_phone: '', type: 'Residential',
        site_address: '', map_location: '', plot_area: '',
        budget: '', start_date: '', completion_date: '', status: 'Active', supervisor_id: '' });
      fetchProjects();
    } catch (err) {
      alert(err.message || 'Failed to save project');
    }
  };

  const openEditModal = async (p, e) => {
    e.stopPropagation();
    // Find current supervisor for this project
    let supervisorId = '';
    try {
      const { data } = await supabase
        .from('project_team')
        .select('profile_id')
        .eq('project_id', p.id)
        .eq('assigned_role', 'Supervisor')
        .maybeSingle();
      supervisorId = data?.profile_id || '';
    } catch (err) {
      console.error(err);
    }

    setForm({
      name: p.name || '',
      client_name: p.client_name || '',
      client_email: p.client_email || '',
      client_phone: p.client_phone || '',
      type: p.type || 'Residential',
      site_address: p.site_address || '',
      map_location: p.map_location || '',
      plot_area: p.plot_area || '',
      budget: p.budget || '',
      start_date: p.start_date || '',
      completion_date: p.completion_date || '',
      status: p.status || 'Active',
      supervisor_id: supervisorId
    });
    setEditingId(p.id);
    setShowAddModal(true);
  };

  const closeModal = () => {
    setShowAddModal(false);
    setEditingId(null);
    setForm({ name: '', client_name: '', client_email: '', client_phone: '', type: 'Residential',
      site_address: '', map_location: '', plot_area: '',
      budget: '', start_date: '', completion_date: '', status: 'Active', supervisor_id: '' });
  };

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        const url = `https://www.google.com/maps?q=${latitude},${longitude}`;
        setForm(prev => ({ ...prev, map_location: url }));
        setLocating(false);
      },
      (err) => {
        alert('Unable to get location: ' + err.message);
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Area conversion — base unit: square feet
  const AREA_UNITS = {
    sqft:   { label: 'Square Feet',  toSqft: 1 },
    sqm:    { label: 'Square Meter', toSqft: 10.7639 },
    acre:   { label: 'Acre',         toSqft: 43560 },
    guntha: { label: 'Guntha',       toSqft: 1089 },
  };

  const getConvertedAreas = () => {
    const val = Number(calcValue) || 0;
    const sqft = val * AREA_UNITS[calcFrom].toSqft;
    return {
      sqft:   sqft,
      sqm:    sqft / AREA_UNITS.sqm.toSqft,
      acre:   sqft / AREA_UNITS.acre.toSqft,
      guntha: sqft / AREA_UNITS.guntha.toSqft,
    };
  };

  const applyCalculatedArea = () => {
    const sqft = getConvertedAreas().sqft;
    setForm(prev => ({ ...prev, plot_area: Math.round(sqft) }));
    setShowAreaCalc(false);
    setCalcValue('');
  };

  const handleDeleteProject = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm('Delete this project and all associated data?')) return;
    try {
      const { error } = await supabase.from('projects').delete().eq('id', id);
      if (error) throw error;
      fetchProjects();
    } catch (err) {
      alert('Failed to delete: ' + err.message);
    }
  };

  const filtered = projects.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.client_name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchType = typeFilter === 'All' || p.type === typeFilter;
    return matchSearch && matchType;
  });

  const totalBudget = projects.reduce((acc, p) => acc + (Number(p.budget) || 0), 0);

  const fmt = (n) =>
    n >= 10000000 ? `₹${(n / 10000000).toFixed(2)}Cr`
    : n >= 100000 ? `₹${(n / 100000).toFixed(1)}L`
    : n >= 1000   ? `₹${(n / 1000).toFixed(1)}K`
    : `₹${n}`;

  const fmtBudget = fmt(totalBudget);

  return (
    <div className="pj-layout">
      <Sidebar />
      <div className="pj-right">
        <Header title="Projects" />

        <main className="pj-main animate-fade">

          {/* Page header */}
          <div className="pj-page-head">
            <div>
              <h1 className="pj-page-title">Project Portfolios</h1>
              <p className="pj-page-sub">Landscaping, plantation, irrigation and maintenance projects across all sites.</p>
            </div>
            <button className="pj-add-btn" onClick={() => setShowAddModal(true)}>
              <Plus size={16} /> New Project
            </button>
          </div>

          {/* Metrics row */}
          <div className="pj-metrics">
            <div className="pj-metric">
              <div className="pj-metric-icon" style={{ background: '#ecfdf5', color: '#10b981' }}>
                <Sprout size={18} />
              </div>
              <div className="pj-metric-body">
                <span className="pj-metric-val">{projects.length}</span>
                <span className="pj-metric-lbl">Total Projects</span>
              </div>
            </div>
            <div className="pj-metric">
              <div className="pj-metric-icon" style={{ background: '#ecfdf5', color: '#10b981' }}>
                <Activity size={18} />
              </div>
              <div className="pj-metric-body">
                <span className="pj-metric-val">{projects.filter(p => p.status === 'Active').length}</span>
                <span className="pj-metric-lbl">Active Sites</span>
              </div>
            </div>
            <div className="pj-metric">
              <div className="pj-metric-icon" style={{ background: '#fffbeb', color: '#f59e0b' }}>
                <TrendingUp size={18} />
              </div>
              <div className="pj-metric-body">
                <span className="pj-metric-val">{fmtBudget}</span>
                <span className="pj-metric-lbl">Total Value</span>
              </div>
            </div>
            <div className="pj-metric">
              <div className="pj-metric-icon" style={{ background: '#eff6ff', color: '#3b82f6' }}>
                <CheckCircle size={18} />
              </div>
              <div className="pj-metric-body">
                <span className="pj-metric-val">{projects.filter(p => p.status === 'Completed').length}</span>
                <span className="pj-metric-lbl">Completed</span>
              </div>
            </div>
            <div className="pj-metric">
              <div className="pj-metric-icon" style={{ background: '#f8fafc', color: '#64748b' }}>
                <Users size={18} />
              </div>
              <div className="pj-metric-body">
                <span className="pj-metric-val">{projects.filter(p => p.status === 'Pending').length}</span>
                <span className="pj-metric-lbl">Pending</span>
              </div>
            </div>
          </div>

          {/* Search + filter */}
          <div className="pj-toolbar">
            <div className="pj-search-wrap">
              <Search size={15} className="pj-search-icon" />
              <input
                type="text" value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Search project or client..."
                className="pj-search-input"
              />
            </div>
            <div className="pj-filters">
              {PROJECT_TYPES.map(type => (
                <button
                  key={type}
                  onClick={() => setTypeFilter(type)}
                  className={`pj-filter-btn ${typeFilter === type ? 'active' : ''}`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          {/* Project grid */}
          {loading ? (
            <div className="pj-loading">
              <Loader2 size={28} className="db-spin" style={{ color: '#10b981' }} />
            </div>
          ) : filtered.length === 0 ? (
            <div className="pj-empty">
              <Sprout size={40} style={{ color: '#cbd5e1', marginBottom: '0.75rem' }} />
              <p>No projects found. Create a new one to get started.</p>
              <button className="pj-add-btn" onClick={() => setShowAddModal(true)} style={{ marginTop: '1rem' }}>
                <Plus size={15} /> New Project
              </button>
            </div>
          ) : (
            <div className="pj-grid">
              {filtered.map(p => {
                const sc = STATUS_CONFIG[p.status] || STATUS_CONFIG['On Hold'];
                const tc = TYPE_CONFIG[p.type]     || { color: '#64748b' };
                return (
                  <div
                    key={p.id}
                    className="pj-card"
                    onClick={() => navigate(`/projects/${p.id}`, { state: { project: p } })}
                    style={{ '--sc': sc.color }}
                  >
                    {/* Card header */}
                    <div className="pj-card-head">
                      <div className="pj-card-type" style={{ color: tc.color }}>
                        <span className="pj-card-status-dot" style={{ background: sc.color }} />
                        {p.type}
                      </div>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          className="pj-card-edit"
                          onClick={e => openEditModal(p, e)}
                          title="Edit project"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          className="pj-card-delete"
                          onClick={e => handleDeleteProject(p.id, e)}
                          title="Delete project"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>


                    {/* Name + client */}
                    <div className="pj-card-name-wrap">
                      <h2 className="pj-card-name">{p.name}</h2>
                      <p className="pj-card-client">{p.client_name}</p>
                    </div>

                    {/* Stats grid */}
                    <div className="pj-card-stats">
                      <div className="pj-stat">
                        <span className="pj-stat-lbl">Total Value</span>
                        <span className="pj-stat-val">
                          {fmt(Number(p.budget) || 0)}
                        </span>
                      </div>
                      <div className="pj-stat">
                        <span className="pj-stat-lbl">Start Date</span>
                        <span className="pj-stat-val">
                          {p.start_date
                            ? new Date(p.start_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })
                            : '—'}
                        </span>
                      </div>
                      <div className="pj-stat">
                        <span className="pj-stat-lbl">Area (sqft)</span>
                        <span className="pj-stat-val">
                          {p.plot_area ? Number(p.plot_area).toLocaleString() : '—'}
                        </span>
                      </div>
                      <div className="pj-stat">
                        <span className="pj-stat-lbl">Supervisor</span>
                        <span className="pj-stat-val">{p.site_engineer}</span>
                      </div>
                    </div>

                    {/* Progress */}
                    <div className="pj-card-progress-wrap">
                      <div className="pj-card-progress-top">
                        <span className="pj-card-progress-lbl">Task Progress</span>
                        <span className="pj-card-progress-pct" style={{ color: sc.color }}>{p.progress}%</span>
                      </div>
                      <div className="pj-progress-track">
                        <div className="pj-progress-fill" style={{ width: `${p.progress}%`, background: sc.color }} />
                      </div>
                    </div>

                    {/* Footer */}
                    <div className="pj-card-footer">
                      <div className="pj-card-location">
                        <MapPin size={11} />
                        <span>{p.site_address || 'No address'}</span>
                      </div>
                      <div className="pj-card-status" style={{ color: sc.color, background: sc.bg }}>
                        {p.status}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </main>
      </div>

      {/* Add/Edit Project Modal */}
      {showAddModal && (
        <div className="pj-modal-overlay">
          <div className="pj-modal">
            <div className="pj-modal-head">
              <h3 className="pj-modal-title">{editingId ? 'Edit Project' : 'New Landscaping Project'}</h3>
              <button className="pj-modal-close" onClick={closeModal}>&times;</button>
            </div>
            {/* form must be a flex column child so body can scroll */}
            <form onSubmit={handleCreateProject} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
              <div className="pj-modal-body">
                <div className="pj-form-grid">
                  <div className="form-group">
                    <label>Project Name</label>
                    <input type="text" required value={form.name}
                      onChange={e => setForm({ ...form, name: e.target.value })}
                      className="input-field" placeholder="e.g. Nitesh Woodland Complex" />
                  </div>
                  <div className="form-group">
                    <label>Client Name</label>
                    <input type="text" required value={form.client_name}
                      onChange={e => setForm({ ...form, client_name: e.target.value })}
                      className="input-field" placeholder="e.g. Nitesh Estates Ltd." />
                  </div>
                  <div className="form-group">
                    <label>Client Email</label>
                    <input type="email" value={form.client_email}
                      onChange={e => setForm({ ...form, client_email: e.target.value })}
                      className="input-field" placeholder="client@example.com" />
                  </div>
                  <div className="form-group">
                    <label>Client Phone (WhatsApp)</label>
                    <input type="tel" value={form.client_phone}
                      onChange={e => setForm({ ...form, client_phone: e.target.value })}
                      className="input-field" placeholder="e.g. 9876543210" />
                  </div>
                  <div className="form-group">
                    <label>Project Type</label>
                    <select value={form.type}
                      onChange={e => setForm({ ...form, type: e.target.value })}
                      className="input-field">
                      {PROJECT_TYPES.slice(1).map(t => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Status</label>
                    <select value={form.status}
                      onChange={e => setForm({ ...form, status: e.target.value })}
                      className="input-field">
                      {STATUS_OPTIONS.map(s => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Site Supervisor</label>
                    <select value={form.supervisor_id}
                      onChange={e => setForm({ ...form, supervisor_id: e.target.value })}
                      className="input-field">
                      <option value="">Select Supervisor...</option>
                      {supervisors.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
                    </select>
                  </div>
                  <div className="form-group pj-full">
                    <label>Site Address</label>
                    <input type="text" value={form.site_address}
                      onChange={e => setForm({ ...form, site_address: e.target.value })}
                      className="input-field" placeholder="e.g. Devanahalli, Bangalore, KA" />
                  </div>
                  <div className="form-group pj-full">
                    <label>Google Maps URL</label>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <input type="url" value={form.map_location}
                        onChange={e => setForm({ ...form, map_location: e.target.value })}
                        className="input-field" placeholder="https://maps.google.com/..." style={{ flex: 1 }} />
                      <button type="button" className="pj-locate-btn" onClick={handleUseCurrentLocation} title="Use current location">
                        <Crosshair size={15} />
                      </button>
                    </div>
                    {locating && <div style={{ fontSize: '0.75rem', color: '#10b981', marginTop: '4px' }}>Getting your location...</div>}
                  </div>
                  <div className="form-group">
                    <label>Total Project Value (₹)</label>
                    <input type="number" required value={form.budget}
                      onChange={e => setForm({ ...form, budget: e.target.value })}
                      className="input-field" placeholder="e.g. 4500000" />
                  </div>
                  <div className="form-group">
                    <label>Plot Area (Sq.Ft)</label>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <input type="number" value={form.plot_area}
                        onChange={e => setForm({ ...form, plot_area: e.target.value })}
                        className="input-field" placeholder="e.g. 5000" style={{ flex: 1 }} />
                      <button type="button" className="pj-locate-btn" onClick={() => setShowAreaCalc(true)} title="Area unit converter">
                        <Calculator size={15} />
                      </button>
                    </div>
                  </div>
                  <div className="form-group">
                    <label>Start Date</label>
                    <input
                      type="date"
                      value={form.start_date}
                      onChange={e => setForm({ ...form, start_date: e.target.value })}
                      className="input-field"
                      style={{ colorScheme: 'light' }}
                    />
                  </div>
                  <div className="form-group">
                    <label>Estimated Completion</label>
                    <input
                      type="date"
                      value={form.completion_date}
                      min={form.start_date}
                      onChange={e => setForm({ ...form, completion_date: e.target.value })}
                      className="input-field"
                      style={{ colorScheme: 'light' }}
                    />
                  </div>
                </div>
              </div>
              <div className="pj-modal-foot">
                <button type="button" className="btn-secondary" onClick={closeModal}>Cancel</button>
                <button type="submit" className="btn-primary">{editingId ? 'Save Changes' : 'Create Project'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Area Unit Converter Modal */}
      {showAreaCalc && (
        <div className="pj-modal-overlay pj-calc-overlay">
          <div className="pj-modal" style={{ maxWidth: '380px' }}>
            <div className="pj-modal-head">
              <h3 className="pj-modal-title">Land Area Converter</h3>
              <button className="pj-modal-close" onClick={() => setShowAreaCalc(false)}>&times;</button>
            </div>
            <div className="pj-modal-body">
              <div className="form-group">
                <label>Enter Value</label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input type="number" value={calcValue} onChange={e => setCalcValue(e.target.value)}
                    className="input-field" placeholder="e.g. 1" style={{ flex: 1 }} />
                  <select value={calcFrom} onChange={e => setCalcFrom(e.target.value)} className="input-field" style={{ width: '130px' }}>
                    {Object.entries(AREA_UNITS).map(([key, u]) => <option key={key} value={key}>{u.label}</option>)}
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '1rem' }}>
                {Object.entries(AREA_UNITS).map(([key, u]) => (
                  <div key={key} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.6rem 0.85rem', background: key === calcFrom ? '#ecfdf5' : '#f8fafc', borderRadius: '8px', border: key === calcFrom ? '1px solid #6ee7b7' : '1px solid #f1f5f9' }}>
                    <span style={{ fontSize: '0.82rem', color: '#64748b' }}>{u.label}</span>
                    <strong style={{ fontSize: '0.85rem', color: '#0b3d27' }}>
                      {getConvertedAreas()[key].toLocaleString('en-IN', { maximumFractionDigits: 3 })}
                    </strong>
                  </div>
                ))}
              </div>
            </div>
            <div className="pj-modal-foot">
              <button type="button" className="btn-secondary" onClick={() => setShowAreaCalc(false)}>Close</button>
              <button type="button" className="btn-primary" onClick={applyCalculatedArea} disabled={!calcValue}>Use Sq.Ft Value</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}