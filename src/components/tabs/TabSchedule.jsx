import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Trash2, Loader2, MoreVertical, Calendar } from 'lucide-react';
import { supabase } from '../../supabase';

const COLUMNS = [
  { key: 'Not Started', label: 'Not Started', color: '#94a3b8' },
  { key: 'In Progress', label: 'In Progress', color: '#f59e0b' },
  { key: 'Completed',   label: 'Completed',   color: '#10b981' },
];

function useBodyScrollLock(active) {
  useEffect(() => {
    if (!active) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [active]);
}

export default function TabSchedule({ project }) {
  const [loading,      setLoading]      = useState(true);
  const [stages,       setStages]       = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newStage,     setNewStage]     = useState({ stage_name: '', start_date: '', end_date: '' });
  const [menuOpenId,   setMenuOpenId]   = useState(null);
  const [editDatesId,  setEditDatesId]  = useState(null);
  const [editDates,    setEditDates]    = useState({ start_date: '', end_date: '' });

  useBodyScrollLock(showAddModal);

  useEffect(() => { fetchStages(); }, [project.id]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!menuOpenId) return;
    const handler = () => setMenuOpenId(null);
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [menuOpenId]);

  const fetchStages = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('schedule_stages')
        .select('*')
        .eq('project_id', project.id)
        .order('created_at', { ascending: true });
      if (error) throw error;
      setStages(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const closeAddModal = () => {
    setShowAddModal(false);
    setNewStage({ stage_name: '', start_date: '', end_date: '' });
  };

  const addStage = async (e) => {
    e.preventDefault();
    if (!newStage.stage_name.trim()) return;
    if (newStage.start_date && newStage.end_date && newStage.end_date < newStage.start_date) {
      alert('End date cannot be before start date.');
      return;
    }
    try {
      const { data, error } = await supabase.from('schedule_stages').insert([{
        project_id:  project.id,
        stage_name:  newStage.stage_name,
        status:      'Not Started',
        start_date:  newStage.start_date || null,
        end_date:    newStage.end_date   || null,
      }]).select().single();
      if (error) throw error;
      setStages(prev => [...prev, data]);
      closeAddModal();
    } catch (err) {
      alert(err.message);
    }
  };

  const moveStage = async (id, newStatus) => {
    setStages(prev => prev.map(s => s.id === id ? { ...s, status: newStatus } : s));
    setMenuOpenId(null);
    try {
      const { error } = await supabase.from('schedule_stages').update({ status: newStatus }).eq('id', id);
      if (error) throw error;
    } catch (err) {
      console.error(err);
      fetchStages();
    }
  };

  const deleteStage = async (id) => {
    if (!confirm('Delete this stage?')) return;
    try {
      const { error } = await supabase.from('schedule_stages').delete().eq('id', id);
      if (error) throw error;
      setStages(prev => prev.filter(s => s.id !== id));
    } catch (err) {
      alert(err.message);
    }
  };

  const saveDates = async (id) => {
    if (editDates.start_date && editDates.end_date && editDates.end_date < editDates.start_date) {
      alert('End date cannot be before start date.');
      return;
    }
    try {
      const { error } = await supabase.from('schedule_stages').update({
        start_date: editDates.start_date || null,
        end_date:   editDates.end_date   || null,
      }).eq('id', id);
      if (error) throw error;
      setStages(prev => prev.map(s => s.id === id ? { ...s, ...editDates } : s));
      setEditDatesId(null);
    } catch (err) {
      alert(err.message);
    }
  };

  const openDateEditor = (stage) => {
    setEditDates({ start_date: stage.start_date || '', end_date: stage.end_date || '' });
    setEditDatesId(stage.id);
    setMenuOpenId(null);
  };

  const totalStages = stages.length;
  const doneStages  = stages.filter(s => s.status === 'Completed').length;
  const pct = totalStages > 0 ? Math.round((doneStages / totalStages) * 100) : 0;

  return (
    <div className="animate-fade">
      <div className="tab-page-head">
        <div>
          <h2 className="tab-page-title">Schedule</h2>
          <p className="tab-page-sub">Track project stages on a Kanban board.</p>
        </div>
        <button className="pj-add-btn" onClick={() => setShowAddModal(true)}>
          <Plus size={15} /> Add Stage
        </button>
      </div>

      {/* Progress summary */}
      {totalStages > 0 && (
        <div className="tab-card" style={{ marginBottom: '1.25rem' }}>
          <div className="tab-card-body">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0b3d27' }}>Overall Progress</span>
              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#10b981' }}>{doneStages}/{totalStages} stages ({pct}%)</span>
            </div>
            <div className="pj-progress-track">
              <div className="pj-progress-fill" style={{ width: `${pct}%`, background: '#10b981' }} />
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="tab-empty"><Loader2 size={20} className="db-spin" style={{ color: '#10b981' }} /></div>
      ) : stages.length === 0 ? (
        <div className="tab-empty">No stages yet. Add your first project stage above.</div>
      ) : (
        <div className="kanban-board">
          {COLUMNS.map(col => {
            const colStages = stages.filter(s => s.status === col.key);
            return (
              <div key={col.key} className="kanban-column">
                <div className="kanban-col-head">
                  <span className="kanban-col-dot" style={{ background: col.color }} />
                  <span className="kanban-col-title">{col.label}</span>
                  <span className="kanban-col-count">{colStages.length}</span>
                </div>
                <div className="kanban-col-body">
                  {colStages.length === 0 ? (
                    <div className="kanban-empty">No stages</div>
                  ) : colStages.map(stage => (
                    <div key={stage.id} className="kanban-card">
                      <div className="kanban-card-head">
                        <span className="kanban-card-name">{stage.stage_name}</span>
                        <div style={{ position: 'relative' }}>
                          <button
                            className="tab-icon-btn"
                            onClick={e => { e.stopPropagation(); setMenuOpenId(menuOpenId === stage.id ? null : stage.id); }}
                          >
                            <MoreVertical size={13} />
                          </button>
                          {menuOpenId === stage.id && (
                            <div className="kanban-menu" onClick={e => e.stopPropagation()}>
                              <div className="kanban-menu-label">Move to</div>
                              {COLUMNS.filter(c => c.key !== stage.status).map(c => (
                                <button key={c.key} className="kanban-menu-item" onClick={() => moveStage(stage.id, c.key)}>
                                  <span className="kanban-col-dot" style={{ background: c.color }} /> {c.label}
                                </button>
                              ))}
                              <div className="kanban-menu-divider" />
                              <button className="kanban-menu-item" onClick={() => openDateEditor(stage)}>
                                <Calendar size={12} /> Edit dates
                              </button>
                              <button className="kanban-menu-item danger" onClick={() => deleteStage(stage.id)}>
                                <Trash2 size={12} /> Delete stage
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      {(stage.start_date || stage.end_date) && (
                        <div className="kanban-card-dates">
                          {stage.start_date
                            ? new Date(stage.start_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
                            : '—'}
                          {' → '}
                          {stage.end_date
                            ? new Date(stage.end_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
                            : '—'}
                        </div>
                      )}

                      {editDatesId === stage.id && (
                        <div className="kanban-date-editor">
                          <div className="form-group" style={{ marginBottom: '6px' }}>
                            <label style={{ fontSize: '0.7rem' }}>Start Date</label>
                            <input type="date" value={editDates.start_date}
                              onChange={e => {
                                const val = e.target.value;
                                setEditDates(prev => ({
                                  ...prev,
                                  start_date: val,
                                  end_date: prev.end_date && prev.end_date < val ? '' : prev.end_date,
                                }));
                              }}
                              className="input-field" style={{ fontSize: '0.78rem', padding: '0.35rem' }} />
                          </div>
                          <div className="form-group" style={{ marginBottom: '8px' }}>
                            <label style={{ fontSize: '0.7rem' }}>End Date</label>
                            <input type="date" value={editDates.end_date}
                              min={editDates.start_date || undefined}
                              onChange={e => setEditDates({ ...editDates, end_date: e.target.value })}
                              className="input-field" style={{ fontSize: '0.78rem', padding: '0.35rem' }} />
                          </div>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button type="button" className="btn-secondary"
                              style={{ flex: 1, justifyContent: 'center', padding: '0.35rem', fontSize: '0.75rem' }}
                              onClick={() => setEditDatesId(null)}>Cancel</button>
                            <button type="button" className="btn-primary"
                              style={{ flex: 1, justifyContent: 'center', padding: '0.35rem', fontSize: '0.75rem' }}
                              onClick={() => saveDates(stage.id)}>Save</button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Stage Modal — portalled to body */}
      {showAddModal && createPortal(
        <div
          className="tab-modal-overlay"
          onClick={e => { if (e.target === e.currentTarget) closeAddModal(); }}
        >
          <div className="tab-modal" style={{ maxWidth: '440px' }}>
            <div className="tab-modal-head">
              <span className="tab-modal-title">Add Schedule Stage</span>
              <button className="tab-modal-close" onClick={closeAddModal}>&times;</button>
            </div>
            <form
              onSubmit={addStage}
              style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}
            >
              <div className="tab-modal-body">
                <div className="form-group">
                  <label>Stage Name</label>
                  <input
                    type="text" required
                    value={newStage.stage_name}
                    onChange={e => setNewStage({ ...newStage, stage_name: e.target.value })}
                    className="input-field"
                    placeholder="e.g. Site Survey, Plantation, Handover"
                    autoFocus
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div className="form-group">
                    <label>Start Date</label>
                    <input
                      type="date" value={newStage.start_date}
                      onChange={e => {
                        const val = e.target.value;
                        setNewStage(prev => ({
                          ...prev,
                          start_date: val,
                          end_date: prev.end_date && prev.end_date < val ? '' : prev.end_date,
                        }));
                      }}
                      className="input-field"
                    />
                  </div>
                  <div className="form-group">
                    <label>End Date</label>
                    <input
                      type="date" value={newStage.end_date}
                      min={newStage.start_date || undefined}
                      onChange={e => setNewStage({ ...newStage, end_date: e.target.value })}
                      className="input-field"
                    />
                  </div>
                </div>
              </div>
              <div className="tab-modal-foot">
                <button type="button" className="btn-secondary" onClick={closeAddModal}>Cancel</button>
                <button type="submit" className="btn-primary">Add Stage</button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}