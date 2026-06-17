import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { generateDrawingNumber } from '../../utils/helpers';
import { Plus, Download, Eye, Loader2, Trash2, Share2 } from 'lucide-react';
import { supabase } from '../../supabase';

const CATEGORIES = ['All', 'Landscape', 'Irrigation', 'Lighting', 'Hardscape'];

const CATEGORY_CODE = {
  Landscape: 'PL',
  Irrigation: 'IR',
  Lighting:  'LT',
  Hardscape: 'CS',
};

/* Lock / unlock body scroll when modal is open */
function useBodyScrollLock(active) {
  useEffect(() => {
    if (!active) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [active]);
}

export default function TabDesignLayouts({ project }) {
  const [filter,    setFilter]    = useState('All');
  const [showModal, setShowModal] = useState(false);
  const [loading,   setLoading]   = useState(true);
  const [uploading, setUploading] = useState(false);
  const [drawings,  setDrawings]  = useState([]);
  const [sharing,   setSharing]   = useState(null); // dwg.id being shared
  const [newDwg, setNewDwg] = useState({ name: '', category: 'Landscape', description: '', file: null });

  useBodyScrollLock(showModal);

  useEffect(() => { fetchDrawings(); }, [project.id]);

  const fetchDrawings = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('site_drawings')
        .select('*')
        .eq('project_id', project.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setDrawings(data || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const closeModal = useCallback(() => {
    setShowModal(false);
    setNewDwg({ name: '', category: 'Landscape', description: '', file: null });
  }, []);

  const handleDelete = async (dwg) => {
    if (!confirm('Delete this drawing?')) return;
    try {
      if (dwg.file_url && dwg.file_url.includes('/storage/v1/object/public/drawings/')) {
        const path = dwg.file_url.split('/drawings/')[1];
        await supabase.storage.from('drawings').remove([path]);
      }
      const { error } = await supabase.from('site_drawings').delete().eq('id', dwg.id);
      if (error) throw error;
      fetchDrawings();
    } catch (err) { alert(err.message); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setUploading(true);
    try {
      const subCode = CATEGORY_CODE[newDwg.category] || 'GEN';
      const count   = drawings.filter(d => d.category === newDwg.category).length + 1;
      const autoNum = generateDrawingNumber(newDwg.category, subCode, count);

      let fileUrl = null;
      if (newDwg.file) {
        const ext  = newDwg.file.name.split('.').pop();
        const path = `${project.id}/${autoNum}-${Date.now()}.${ext}`;
        const { error: uploadErr } = await supabase.storage.from('drawings').upload(path, newDwg.file);
        if (uploadErr) throw uploadErr;
        const { data: urlData } = supabase.storage.from('drawings').getPublicUrl(path);
        fileUrl = urlData.publicUrl;
      }

      const { error } = await supabase.from('site_drawings').insert([{
        project_id:      project.id,
        drawing_number:  autoNum,
        name:            newDwg.name,
        category:        newDwg.category,
        status:          'Draft',
        client_comments: newDwg.description || null,
        file_url:        fileUrl,
      }]);
      if (error) throw error;

      closeModal();
      fetchDrawings();
    } catch (err) {
      alert(err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const updateStatus = async (id, status) => {
    try {
      const { error } = await supabase.from('site_drawings').update({ status }).eq('id', id);
      if (error) throw error;
      setDrawings(prev => prev.map(d => d.id === id ? { ...d, status } : d));
    } catch (err) { console.error(err); }
  };

  const viewFile = (url) => {
    if (!url) { alert('No file uploaded for this drawing.'); return; }
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const downloadFile = async (dwg) => {
    if (!dwg.file_url) { alert('No file uploaded for this drawing.'); return; }
    try {
      const res  = await fetch(dwg.file_url);
      if (!res.ok) throw new Error('Failed to fetch file');
      const blob = await res.blob();
      const ext  = dwg.file_url.split('.').pop().split('?')[0];
      const url  = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href     = url;
      link.download = `${dwg.drawing_number}.${ext}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) { alert('Download failed: ' + err.message); }
  };

  const formatWhatsAppNumber = (rawPhone) => {
    let digits = rawPhone.replace(/\D/g, '');
    if (digits.length === 10) digits = '91' + digits;
    return digits;
  };

  /* Share: always tries to send the actual file blob via Web Share API.
     On desktop or unsupported browsers, auto-downloads the file instead.
     Never sends a raw Supabase link. */
  const handleShare = async (dwg) => {
    if (!dwg.file_url) {
      alert('No file uploaded for this drawing. Upload a file first.');
      return;
    }

    setSharing(dwg.id);
    try {
      // 1. Fetch the actual file blob
      const res = await fetch(dwg.file_url);
      if (!res.ok) throw new Error('Could not fetch file for sharing.');
      const blob = await res.blob();
      const ext  = dwg.file_url.split('.').pop().split('?')[0].toLowerCase();
      const fileName = `${dwg.drawing_number}-${dwg.name.replace(/\s+/g, '_')}.${ext}`;
      const file = new File([blob], fileName, { type: blob.type });

      const shareText = `${dwg.name} (${dwg.drawing_number}) — ${project.name}`;

      // 2. Try native file share (works on Android, iOS, some desktop)
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: dwg.name, text: shareText });
        return;
      }

      // 3. If client_phone exists, open WhatsApp — but auto-download the file too
      //    (WhatsApp doesn't accept files via URL scheme, so user downloads then attaches)
      if (project.client_phone) {
        const phone = formatWhatsAppNumber(project.client_phone);
        if (phone.length >= 11) {
          // First download the file so user can attach it
          const objUrl = URL.createObjectURL(blob);
          const link   = document.createElement('a');
          link.href     = objUrl;
          link.download = fileName;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          setTimeout(() => URL.revokeObjectURL(objUrl), 1000);

          // Then open WhatsApp chat so user can manually attach the downloaded file
          const msg = `Hello ${project.client_name},\n\nPlease find the attached drawing *${dwg.name}* (${dwg.drawing_number}) for *${project.name}*.\n\n— GreenSpire`;
          setTimeout(() => {
            window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank', 'noopener,noreferrer');
          }, 800);
          return;
        }
      }

      // 4. Final fallback: just download the file
      const objUrl = URL.createObjectURL(blob);
      const link   = document.createElement('a');
      link.href     = objUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(objUrl), 1000);
      alert('File downloaded. You can now share it manually via WhatsApp or email.');

    } catch (err) {
      if (err.name !== 'AbortError') {
        alert('Share failed: ' + err.message);
      }
    } finally {
      setSharing(null);
    }
  };

  const filtered = filter === 'All' ? drawings : drawings.filter(d => d.category === filter);

  const statusBadge = (s) => {
    const map = {
      Approved: 'tab-badge-green',
      'Under Review': 'tab-badge-yellow',
      Draft: 'tab-badge-gray',
      'Revision Required': 'tab-badge-red',
      'Final Issue': 'tab-badge-blue',
    };
    return map[s] || 'tab-badge-gray';
  };

  return (
    <div className="animate-fade">
      <div className="tab-page-head">
        <div>
          <h2 className="tab-page-title">Design Layout Register</h2>
          <p className="tab-page-sub">Upload blueprints, track revisions and client approvals.</p>
        </div>
        <button className="pj-add-btn" onClick={() => setShowModal(true)}>
          <Plus size={15} /> Upload Layout
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
        {CATEGORIES.map(cat => (
          <button key={cat} onClick={() => setFilter(cat)}
            className={`pj-filter-btn ${filter === cat ? 'active' : ''}`}>
            {cat}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="tab-empty">
          <Loader2 size={20} className="db-spin" style={{ color: '#10b981' }} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="tab-empty">No drawings uploaded yet.</div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="tab-table-wrap drawings-table-wrap">
            <table className="tab-table">
              <thead>
                <tr>
                  <th>Drawing No.</th>
                  <th>Name</th>
                  <th>Category</th>
                  <th>Status</th>
                  <th>Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(dwg => (
                  <tr key={dwg.id}>
                    <td style={{ fontWeight: 700, color: '#0b3d27', fontSize: '0.82rem' }}>{dwg.drawing_number}</td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{dwg.name}</div>
                      {dwg.client_comments && (
                        <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '2px', maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {dwg.client_comments}
                        </div>
                      )}
                    </td>
                    <td style={{ color: '#64748b', fontSize: '0.82rem' }}>{dwg.category}</td>
                    <td>
                      <select value={dwg.status} onChange={e => updateStatus(dwg.id, e.target.value)}
                        style={{ fontSize: '0.75rem', padding: '3px 7px', border: '1px solid #e2e8f0', borderRadius: '6px', background: 'white', outline: 'none' }}>
                        {['Draft', 'Under Review', 'Approved', 'Revision Required', 'Final Issue'].map(s => (
                          <option key={s}>{s}</option>
                        ))}
                      </select>
                    </td>
                    <td style={{ color: '#64748b', fontSize: '0.8rem' }}>
                      {dwg.submission_date || new Date(dwg.created_at).toLocaleDateString('en-IN')}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button className="tab-icon-btn" title="View" onClick={() => viewFile(dwg.file_url)}>
                          <Eye size={13} />
                        </button>
                        <button className="tab-icon-btn" title="Download" onClick={() => downloadFile(dwg)}>
                          <Download size={13} />
                        </button>
                        <button
                          className="tab-icon-btn"
                          title="Share file (download + WhatsApp)"
                          onClick={() => handleShare(dwg)}
                          disabled={sharing === dwg.id}
                          style={{ color: sharing === dwg.id ? '#94a3b8' : '#25D366' }}
                        >
                          {sharing === dwg.id ? <Loader2 size={13} className="db-spin" /> : <Share2 size={13} />}
                        </button>
                        <button className="tab-icon-btn danger" onClick={() => handleDelete(dwg)} title="Delete">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="drawings-card-list">
            {filtered.map(dwg => (
              <div key={dwg.id} className="drawing-card">
                <div className="drawing-card-top">
                  <div>
                    <div className="drawing-card-number">{dwg.drawing_number}</div>
                    <div className="drawing-card-name">{dwg.name}</div>
                  </div>
                </div>
                {dwg.client_comments && (
                  <div className="drawing-card-desc">{dwg.client_comments}</div>
                )}
                <div className="drawing-card-meta">
                  <span className="drawing-card-tag">{dwg.category}</span>
                  <span className="drawing-card-date">
                    {dwg.submission_date || new Date(dwg.created_at).toLocaleDateString('en-IN')}
                  </span>
                </div>
                <div className="drawing-card-status">
                  <label>Status</label>
                  <select value={dwg.status} onChange={e => updateStatus(dwg.id, e.target.value)} className="input-field">
                    {['Draft', 'Under Review', 'Approved', 'Revision Required', 'Final Issue'].map(s => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div className="drawing-card-actions">
                  <button className="tab-icon-btn" title="View" onClick={() => viewFile(dwg.file_url)}>
                    <Eye size={14} />
                  </button>
                  <button className="tab-icon-btn" title="Download" onClick={() => downloadFile(dwg)}>
                    <Download size={14} />
                  </button>
                  <button
                    className="tab-icon-btn"
                    title="Share file"
                    onClick={() => handleShare(dwg)}
                    disabled={sharing === dwg.id}
                    style={{ color: sharing === dwg.id ? '#94a3b8' : '#25D366' }}
                  >
                    {sharing === dwg.id ? <Loader2 size={14} className="db-spin" /> : <Share2 size={14} />}
                  </button>
                  <button className="tab-icon-btn danger" onClick={() => handleDelete(dwg)} title="Delete">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Upload Drawing Modal — portalled to body to escape stacking contexts */}
      {showModal && createPortal(
        <div
          className="tab-modal-overlay"
          onClick={e => { if (e.target === e.currentTarget) closeModal(); }}
        >
          <div className="tab-modal">
            <div className="tab-modal-head">
              <span className="tab-modal-title">Upload Layout Drawing</span>
              <button className="tab-modal-close" onClick={closeModal}>&times;</button>
            </div>
            <form
              onSubmit={handleSubmit}
              style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}
            >
              <div className="tab-modal-body">
                <div className="form-group">
                  <label>Drawing Name</label>
                  <input
                    type="text" required value={newDwg.name}
                    onChange={e => setNewDwg({ ...newDwg, name: e.target.value })}
                    className="input-field" placeholder="e.g. Garden Plantation Layout"
                  />
                </div>
                <div className="form-group">
                  <label>Category</label>
                  <select
                    value={newDwg.category}
                    onChange={e => setNewDwg({ ...newDwg, category: e.target.value })}
                    className="input-field"
                  >
                    {CATEGORIES.slice(1).map(c => <option key={c}>{c}</option>)}
                  </select>
                  <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '4px' }}>
                    Drawing code: <strong style={{ color: '#0b3d27' }}>{CATEGORY_CODE[newDwg.category]}</strong>
                  </div>
                </div>
                <div className="form-group">
                  <label>Description <span style={{ color: '#94a3b8', fontWeight: 400 }}>(optional)</span></label>
                  <textarea
                    rows={3} value={newDwg.description}
                    onChange={e => setNewDwg({ ...newDwg, description: e.target.value })}
                    className="input-field" style={{ resize: 'none' }}
                    placeholder="Notes about this drawing, scope, version details..."
                  />
                </div>
                <div className="form-group">
                  <label>File <span style={{ color: '#94a3b8', fontWeight: 400 }}>(PDF or image)</span></label>
                  <input
                    type="file" accept=".pdf,image/*"
                    onChange={e => setNewDwg(prev => ({ ...prev, file: e.target.files[0] || null }))}
                    style={{
                      width: '100%', padding: '0.55rem 0.7rem',
                      border: '1.5px dashed #d1fae5', borderRadius: '8px',
                      fontSize: '0.82rem', background: '#f0fdf4', cursor: 'pointer',
                    }}
                  />
                  {newDwg.file && (
                    <div style={{ fontSize: '0.75rem', color: '#10b981', marginTop: '5px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                      ✓ {newDwg.file.name}
                    </div>
                  )}
                </div>
              </div>
              <div className="tab-modal-foot">
                <button type="button" className="btn-secondary" onClick={closeModal}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={uploading}>
                  {uploading ? <><Loader2 size={13} className="db-spin" /> Uploading…</> : 'Save Drawing'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}