import { useState, useEffect } from 'react';
import { UserCheck, ShieldAlert, Plus, CheckCircle2, Loader2 } from 'lucide-react';
import { supabase } from '../../supabase';

export default function TabTeam({ project }) {
  const [loading,     setLoading]     = useState(true);
  const [teamMembers, setTeamMembers] = useState([]);
  const [tasks,       setTasks]       = useState([]);
  const [profiles,    setProfiles]    = useState([]);
  const [showModal,   setShowModal]   = useState(false);
  const [newTask, setNewTask] = useState({ name: '', assigned_to: '', deadline: '', priority: 'Medium', remarks: '' });

  useEffect(() => { fetchAll(); }, [project.id]);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [{ data: team }, { data: taskData }, { data: profileData }] = await Promise.all([
        supabase.from('project_team').select('assigned_role, profiles(id, full_name, email)').eq('project_id', project.id),
        supabase.from('tasks').select('*, profiles(full_name)').eq('project_id', project.id).order('created_at', { ascending: false }),
        supabase.from('profiles').select('id, full_name').order('full_name')
      ]);
      setTeamMembers(team || []);
      setTasks(taskData || []);
      setProfiles(profileData || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const handleTaskSubmit = async (e) => {
    e.preventDefault();
    try {
      const { error } = await supabase.from('tasks').insert([{
        project_id:  project.id,
        name:        newTask.name,
        assigned_to: newTask.assigned_to || null,
        deadline:    newTask.deadline || null,
        priority:    newTask.priority,
        status:      'Pending',
        remarks:     newTask.remarks || null
      }]);
      if (error) throw error;
      setShowModal(false);
      setNewTask({ name: '', assigned_to: '', deadline: '', priority: 'Medium', remarks: '' });
      fetchAll();
    } catch (err) { alert(err.message); }
  };

  const toggleTask = async (id, current) => {
    const next = current === 'Completed' ? 'Pending' : 'Completed';
    try {
      const { error } = await supabase.from('tasks').update({ status: next }).eq('id', id);
      if (error) throw error;
      fetchAll();
    } catch (err) { console.error(err); }
  };

  const priorityColor = { High: '#ef4444', Medium: '#f59e0b', Low: '#10b981' };

  return (
    <div className="animate-fade">
      <div className="tab-page-head">
        <div>
          <h2 className="tab-page-title">Team & Tasks</h2>
          <p className="tab-page-sub">View assigned team members and manage project task allocations.</p>
        </div>
      </div>

      {loading ? (
        <div className="tab-empty"><Loader2 size={22} className="db-spin" style={{ color: '#10b981' }} /></div>
      ) : (
        <div className="tab-grid-2">

          {/* Team */}
          <div className="tab-card" style={{ height: 'fit-content' }}>
            <div className="tab-card-head"><span className="tab-card-title"><UserCheck size={14} /> Team Assignments</span></div>
            <div className="tab-card-body">
              {teamMembers.length === 0 ? (
                <div className="tab-empty" style={{ padding: '1rem' }}>No team assigned yet.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                  {teamMembers.map((m, i) => (
                    <div key={i} style={{ padding: '0.75rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #f1f5f9' }}>
                      <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '3px' }}>{m.assigned_role}</div>
                      <div style={{ fontWeight: 700, fontSize: '0.86rem', color: '#0b3d27' }}>{m.profiles?.full_name || 'Unassigned'}</div>
                      {m.profiles?.email && <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '2px' }}>{m.profiles.email}</div>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Tasks */}
          <div className="tab-card">
            <div className="tab-card-head">
              <span className="tab-card-title"><ShieldAlert size={14} /> Task Board</span>
              <button className="pj-add-btn" style={{ padding: '0.35rem 0.75rem', fontSize: '0.78rem' }} onClick={() => setShowModal(true)}>
                <Plus size={13} /> Add Task
              </button>
            </div>
            <div className="tab-card-body" style={{ padding: tasks.length === 0 ? '1rem' : 0 }}>
              {tasks.length === 0 ? (
                <div className="tab-empty" style={{ padding: '1rem' }}>No tasks assigned yet.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {tasks.map(task => (
                    <div key={task.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '0.8rem 1rem', borderBottom: '1px solid #f1f5f9', opacity: task.status === 'Completed' ? 0.6 : 1 }}>
                      <button onClick={() => toggleTask(task.id, task.status)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: task.status === 'Completed' ? '#10b981' : '#cbd5e1', padding: 0, marginTop: '1px', flexShrink: 0 }}>
                        <CheckCircle2 size={18} />
                      </button>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: '0.85rem', color: '#1e293b', textDecoration: task.status === 'Completed' ? 'line-through' : 'none' }}>{task.name}</div>
                        <div style={{ display: 'flex', gap: '10px', marginTop: '3px', fontSize: '0.73rem', color: '#94a3b8', flexWrap: 'wrap' }}>
                          {task.profiles?.full_name && <span>{task.profiles.full_name}</span>}
                          {task.deadline && <span>Due: {task.deadline}</span>}
                          <span style={{ color: priorityColor[task.priority], fontWeight: 600 }}>{task.priority}</span>
                        </div>
                        {task.remarks && <div style={{ fontSize: '0.73rem', color: '#94a3b8', fontStyle: 'italic', marginTop: '2px' }}>{task.remarks}</div>}
                      </div>
                      <span className={`tab-badge ${task.status === 'Completed' ? 'tab-badge-green' : task.status === 'In Progress' ? 'tab-badge-yellow' : 'tab-badge-gray'}`} style={{ flexShrink: 0 }}>
                        {task.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <div className="tab-modal-overlay">
          <div className="tab-modal">
            <div className="tab-modal-head">
              <span className="tab-modal-title">Assign New Task</span>
              <button className="tab-modal-close" onClick={() => setShowModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleTaskSubmit}>
              <div className="tab-modal-body">
                <div className="form-group">
                  <label>Task Name</label>
                  <input type="text" required value={newTask.name}
                    onChange={e => setNewTask({...newTask, name: e.target.value})}
                    className="input-field" placeholder="e.g. Mark tree positions on site" />
                </div>
                <div className="tab-split-half" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="form-group">
                    <label>Assigned To</label>
                    <select value={newTask.assigned_to} onChange={e => setNewTask({...newTask, assigned_to: e.target.value})} className="input-field">
                      <option value="">Select...</option>
                      {profiles.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Deadline</label>
                    <input type="date" value={newTask.deadline}
                      onChange={e => setNewTask({...newTask, deadline: e.target.value})} className="input-field" />
                  </div>
                </div>
                <div className="form-group">
                  <label>Priority</label>
                  <select value={newTask.priority} onChange={e => setNewTask({...newTask, priority: e.target.value})} className="input-field">
                    {['Low','Medium','High'].map(p => <option key={p}>{p}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Remarks</label>
                  <input type="text" value={newTask.remarks}
                    onChange={e => setNewTask({...newTask, remarks: e.target.value})}
                    className="input-field" placeholder="Notes for the assignee..." />
                </div>
              </div>
              <div className="tab-modal-foot">
                <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn-primary">Assign Task</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}