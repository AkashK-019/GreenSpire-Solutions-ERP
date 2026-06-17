import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Camera, Plus, Calendar, Loader2, Trash2, Users, X } from 'lucide-react';
import { supabase } from '../../supabase';
import { compressImage } from '../../utils/imageCompressor';

const fileToBase64 = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.readAsDataURL(file);
  reader.onload  = () => resolve(reader.result);
  reader.onerror = (err) => reject(err);
});

function useBodyScrollLock(active) {
  useEffect(() => {
    if (!active) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [active]);
}

export default function TabSiteVisits({ project }) {
  const [loading,        setLoading]        = useState(true);
  const [visits,         setVisits]         = useState([]);
  const [showModal,      setShowModal]      = useState(false);
  const [isSaving,       setIsSaving]       = useState(false);
  const [isCompressing,  setIsCompressing]  = useState(false);
  const [lightbox,       setLightbox]       = useState(null);

  const [meetings,       setMeetings]       = useState([]);
  const [showMeetModal,  setShowMeetModal]  = useState(false);
  const [newMeeting,     setNewMeeting]     = useState({ date: '', agenda: '', attendees: '' });

  const [form, setForm] = useState({
    date: '', supervisor: '',
    work_done: '', issues: '', next_action: '', photos: [],
  });

  // Lock scroll when any modal or lightbox is open
  useBodyScrollLock(showModal || showMeetModal || !!lightbox);

  useEffect(() => { fetchVisits(); fetchMeetings(); }, [project.id]);

  const fetchVisits = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('daily_site_reports')
        .select('*')
        .eq('project_id', project.id)
        .order('report_date', { ascending: false });
      if (error) throw error;
      setVisits(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchMeetings = async () => {
    try {
      const { data, error } = await supabase
        .from('site_meetings')
        .select('*')
        .eq('project_id', project.id)
        .order('meeting_date', { ascending: false });
      if (error) throw error;
      setMeetings(data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const closeReportModal = () => {
    setShowModal(false);
    setForm({ date: '', supervisor: '', work_done: '', issues: '', next_action: '', photos: [] });
  };

  const closeMeetModal = () => {
    setShowMeetModal(false);
    setNewMeeting({ date: '', agenda: '', attendees: '' });
  };

  const handleMeetSubmit = async (e) => {
    e.preventDefault();
    try {
      const { data, error } = await supabase
        .from('site_meetings')
        .insert([{
          project_id:   project.id,
          meeting_date: newMeeting.date,
          agenda:       newMeeting.agenda,
          attendees:    newMeeting.attendees,
        }])
        .select().single();
      if (error) throw error;
      setMeetings(prev => [data, ...prev]);
      closeMeetModal();
    } catch (err) {
      alert(err.message || 'Failed to save meeting');
    }
  };

  const deleteMeeting = async (id) => {
    if (!confirm('Delete this meeting record?')) return;
    try {
      const { error } = await supabase.from('site_meetings').delete().eq('id', id);
      if (error) throw error;
      setMeetings(prev => prev.filter(m => m.id !== id));
    } catch (err) {
      alert(err.message || 'Failed to delete meeting');
    }
  };

  const handleFiles = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    setIsCompressing(true);
    try {
      const bases = [];
      for (const file of files) {
        const compressed = await compressImage(file, { maxWidth: 1000, maxHeight: 1000, quality: 0.7 });
        const b64 = await fileToBase64(compressed);
        bases.push(b64);
      }
      setForm(prev => ({ ...prev, photos: [...prev.photos, ...bases] }));
    } catch (err) {
      alert('Image error: ' + err.message);
    } finally {
      setIsCompressing(false);
      e.target.value = '';
    }
  };

  const removePhoto = (idx) => {
    setForm(prev => ({ ...prev, photos: prev.photos.filter((_, i) => i !== idx) }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const { error } = await supabase.from('daily_site_reports').insert([{
        project_id:        project.id,
        report_date:       form.date || new Date().toISOString().split('T')[0],
        weather_condition: form.supervisor,
        labour_count:      0,
        work_done:         form.work_done,
        materials_used:    form.next_action,
        issues_on_site:    form.issues,
        photo_urls:        form.photos,
      }]);
      if (error) throw error;
      closeReportModal();
      fetchVisits();
    } catch (err) {
      alert(err.message || 'Failed to save');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this site report?')) return;
    try {
      const { error } = await supabase.from('daily_site_reports').delete().eq('id', id);
      if (error) throw error;
      fetchVisits();
    } catch (err) {
      alert(err.message);
    }
  };

  const fmtDate = (d) => d
    ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    : '—';

  return (
    <div className="animate-fade">

      {/* Lightbox — portalled */}
      {lightbox && createPortal(
        <div
          className="tab-lightbox-overlay"
          onClick={() => setLightbox(null)}
          style={{ zIndex: 5000 }}
        >
          <button
            className="tab-lightbox-close"
            onClick={() => setLightbox(null)}
            style={{ zIndex: 5001 }}
          >&times;</button>
          <img
            src={lightbox}
            alt="Site photo"
            className="tab-lightbox-img"
            onClick={e => e.stopPropagation()}
          />
        </div>,
        document.body
      )}

      <div className="tab-page-head">
        <div>
          <h2 className="tab-page-title">Site Visits</h2>
          <p className="tab-page-sub">Log site visit reports and meeting records.</p>
        </div>
        <button className="pj-add-btn" onClick={() => setShowModal(true)}>
          <Plus size={15} /> New Report
        </button>
      </div>

      {/* Site Visit Reports */}
      {loading ? (
        <div className="tab-empty">
          <Loader2 size={22} className="db-spin" style={{ color: '#10b981' }} />
        </div>
      ) : visits.length === 0 ? (
        <div className="tab-empty">
          <Camera size={32} style={{ color: '#e2e8f0', marginBottom: '4px' }} />
          No site visits logged yet.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
          {visits.map(v => (
            <div key={v.id} className="tab-card">
              <div className="tab-card-head">
                <span className="tab-card-title">
                  <Calendar size={13} />
                  {fmtDate(v.report_date)}
                  {v.weather_condition && (
                    <span style={{ fontWeight: 500, color: '#64748b', fontSize: '0.8rem' }}>
                      · {v.weather_condition}
                    </span>
                  )}
                </span>
                <button className="tab-icon-btn danger" onClick={() => handleDelete(v.id)} title="Delete">
                  <Trash2 size={13} />
                </button>
              </div>
              <div className="tab-card-body" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {v.work_done && (
                  <div>
                    <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '3px' }}>Work Done</div>
                    <p style={{ fontSize: '0.85rem', color: '#1e293b', lineHeight: 1.5 }}>{v.work_done}</p>
                  </div>
                )}
                {v.issues_on_site && (
                  <div>
                    <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '3px' }}>Issues / Instructions</div>
                    <p style={{ fontSize: '0.85rem', color: '#1e293b', lineHeight: 1.5 }}>{v.issues_on_site}</p>
                  </div>
                )}
                {v.materials_used && (
                  <div>
                    <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '3px' }}>Next Action</div>
                    <p style={{ fontSize: '0.85rem', color: '#1e293b', lineHeight: 1.5 }}>{v.materials_used}</p>
                  </div>
                )}
                {v.photo_urls?.length > 0 && (
                  <div>
                    <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
                      Site Photos ({v.photo_urls.length})
                    </div>
                    <div className="tab-photo-grid">
                      {v.photo_urls.map((photo, idx) => (
                        <img
                          key={idx}
                          src={photo}
                          alt={`Site photo ${idx + 1}`}
                          className="tab-photo-thumb"
                          onClick={() => setLightbox(photo)}
                          title="Click to enlarge"
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Site Meeting Records */}
      <div className="tab-card">
        <div className="tab-card-head">
          <span className="tab-card-title"><Users size={14} /> Site Meeting Records</span>
          <button
            className="pj-add-btn"
            style={{ padding: '0.35rem 0.75rem', fontSize: '0.78rem' }}
            onClick={() => setShowMeetModal(true)}
          >
            <Plus size={13} /> Log Meeting
          </button>
        </div>
        <div className="tab-card-body">
          {meetings.length === 0 ? (
            <div className="tab-empty" style={{ padding: '1.5rem' }}>No meetings logged yet.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {meetings.map(m => (
                <div key={m.id} style={{
                  display: 'flex', alignItems: 'flex-start', gap: '12px',
                  padding: '0.75rem', background: '#f8fafc', borderRadius: '8px',
                  border: '1px solid #f1f5f9',
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem', fontWeight: 700, color: '#0b3d27' }}>
                        <Calendar size={12} /> {fmtDate(m.meeting_date)}
                      </span>
                      {m.attendees && (
                        <span style={{ fontSize: '0.75rem', color: '#64748b' }}>· {m.attendees}</span>
                      )}
                    </div>
                    <p style={{ fontSize: '0.83rem', color: '#1e293b', lineHeight: 1.5 }}>{m.agenda}</p>
                  </div>
                  <button className="tab-icon-btn danger" onClick={() => deleteMeeting(m.id)} title="Delete" style={{ flexShrink: 0 }}>
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* New Site Report Modal — portalled */}
      {showModal && createPortal(
        <div
          className="tab-modal-overlay"
          onClick={e => { if (e.target === e.currentTarget) closeReportModal(); }}
        >
          <div className="tab-modal">
            <div className="tab-modal-head">
              <span className="tab-modal-title">Log Site Visit</span>
              <button className="tab-modal-close" onClick={closeReportModal}>&times;</button>
            </div>
            <form
              onSubmit={handleSubmit}
              style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}
            >
              <div className="tab-modal-body">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.9rem' }}>
                  <div className="form-group">
                    <label>Visit Date</label>
                    <input
                      type="date" required value={form.date}
                      onChange={e => setForm({ ...form, date: e.target.value })}
                      className="input-field"
                    />
                  </div>
                  <div className="form-group">
                    <label>Supervisor / Team</label>
                    <input
                      type="text" required value={form.supervisor}
                      onChange={e => setForm({ ...form, supervisor: e.target.value })}
                      className="input-field" placeholder="e.g. Kunal Kapoor"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Work Done</label>
                  <textarea
                    required rows={3} value={form.work_done}
                    onChange={e => setForm({ ...form, work_done: e.target.value })}
                    className="input-field" style={{ resize: 'none' }}
                    placeholder="Describe progress, plantation, earthwork..."
                  />
                </div>

                <div className="form-group">
                  <label>Issues / Client Instructions</label>
                  <textarea
                    rows={2} value={form.issues}
                    onChange={e => setForm({ ...form, issues: e.target.value })}
                    className="input-field" style={{ resize: 'none' }}
                    placeholder="Issues on site, delayed materials..."
                  />
                </div>

                <div className="form-group">
                  <label>Next Action</label>
                  <input
                    type="text" value={form.next_action}
                    onChange={e => setForm({ ...form, next_action: e.target.value })}
                    className="input-field" placeholder="e.g. Check soil levelling"
                  />
                </div>

                <div className="form-group">
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Camera size={14} style={{ color: '#10b981' }} /> Site Photos
                  </label>
                  <input
                    type="file" accept="image/*" multiple
                    onChange={handleFiles}
                    style={{
                      width: '100%', padding: '0.55rem 0.7rem',
                      border: '1.5px dashed #d1fae5', borderRadius: '8px',
                      fontSize: '0.82rem', background: '#f0fdf4', cursor: 'pointer',
                    }}
                  />
                  <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '4px' }}>
                    Select multiple images or take a new photo.
                  </div>
                  {isCompressing && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: '#10b981', marginTop: '6px' }}>
                      <Loader2 size={13} className="db-spin" /> Compressing images…
                    </div>
                  )}
                  {form.photos.length > 0 && (
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '10px' }}>
                      {form.photos.map((p, idx) => (
                        <div key={idx} style={{
                          position: 'relative', width: '68px', height: '68px',
                          borderRadius: '7px', overflow: 'hidden', border: '1px solid #e2e8f0',
                          flexShrink: 0,
                        }}>
                          <img src={p} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          <button
                            type="button" onClick={() => removePhoto(idx)}
                            style={{
                              position: 'absolute', top: '3px', right: '3px',
                              width: '18px', height: '18px',
                              background: 'rgba(239,68,68,0.9)', border: 'none',
                              borderRadius: '50%', color: 'white', cursor: 'pointer',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: '11px', lineHeight: 1,
                            }}
                          >&times;</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="tab-modal-foot">
                <button type="button" className="btn-secondary" onClick={closeReportModal}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={isSaving || isCompressing}>
                  {isSaving ? <><Loader2 size={13} className="db-spin" /> Saving…</> : 'Save Report'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Log Meeting Modal — portalled */}
      {showMeetModal && createPortal(
        <div
          className="tab-modal-overlay"
          onClick={e => { if (e.target === e.currentTarget) closeMeetModal(); }}
        >
          <div className="tab-modal" style={{ maxWidth: '460px' }}>
            <div className="tab-modal-head">
              <span className="tab-modal-title">Log Site Meeting</span>
              <button className="tab-modal-close" onClick={closeMeetModal}>&times;</button>
            </div>
            <form
              onSubmit={handleMeetSubmit}
              style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}
            >
              <div className="tab-modal-body">
                <div className="form-group">
                  <label>Meeting Date</label>
                  <input
                    type="date" required value={newMeeting.date}
                    onChange={e => setNewMeeting({ ...newMeeting, date: e.target.value })}
                    className="input-field"
                  />
                </div>
                <div className="form-group">
                  <label>Attendees</label>
                  <input
                    type="text" required value={newMeeting.attendees}
                    onChange={e => setNewMeeting({ ...newMeeting, attendees: e.target.value })}
                    className="input-field" placeholder="e.g. Designer, Supervisor, Client"
                  />
                </div>
                <div className="form-group">
                  <label>Minutes / Discussion</label>
                  <textarea
                    required rows={4} value={newMeeting.agenda}
                    onChange={e => setNewMeeting({ ...newMeeting, agenda: e.target.value })}
                    className="input-field" style={{ resize: 'none' }}
                    placeholder="Discussion notes, decisions, action items..."
                  />
                </div>
              </div>
              <div className="tab-modal-foot">
                <button type="button" className="btn-secondary" onClick={closeMeetModal}>Cancel</button>
                <button type="submit" className="btn-primary">Save Meeting</button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}