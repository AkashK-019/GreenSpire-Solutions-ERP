import { useState, useEffect } from 'react';
import { Check, X, Clock, Loader2, Trash2, Plus } from 'lucide-react';
import { compressImage } from '../../utils/imageCompressor';
import { supabase } from '../../supabase';

const fileToBase64 = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.readAsDataURL(file);
  reader.onload  = () => resolve(reader.result);
  reader.onerror = err => reject(err);
});

const CATEGORIES = ['All', 'Plants', 'Grass Turf', 'Fertilizers', 'Irrigation Pipes', 'Pathway Stones', 'Lighting Fixtures', 'Fountains'];

export default function TabMaterialSelection({ project }) {
  const [materials, setMaterials] = useState(() => {
    try {
      const saved = localStorage.getItem(`materials_selection_${project?.id}`);
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  const [activeTab,       setActiveTab]       = useState('All');
  const [showAdd,         setShowAdd]         = useState(false);
  const [lightbox,        setLightbox]        = useState(null);
  const [isCompressing,   setIsCompressing]   = useState(false);
  const [inventoryItems,  setInventoryItems]  = useState([]);
  const [newMat, setNewMat] = useState({ name: '', category: 'Plants', comments: '', photo: null });

  useEffect(() => {
    if (project?.id) localStorage.setItem(`materials_selection_${project.id}`, JSON.stringify(materials));
  }, [materials, project?.id]);

  useEffect(() => { fetchInventory(); }, []);

  const fetchInventory = async () => {
    try {
      const [{ data: mats }, { data: plants }] = await Promise.all([
        supabase.from('materials_inventory').select('item_name, category'),
        supabase.from('plants_inventory').select('name, category')
      ]);
      setInventoryItems([
        ...(mats   || []).map(d => ({ name: d.item_name, category: d.category })),
        ...(plants || []).map(p => ({ name: p.name, category: 'Plants' }))
      ]);
    } catch (err) { console.error(err); }
  };

  const handlePhotoChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setIsCompressing(true);
    try {
      const compressed = await compressImage(file, { maxWidth: 800, maxHeight: 800, quality: 0.7 });
      const b64 = await fileToBase64(compressed);
      setNewMat(prev => ({ ...prev, photo: b64 }));
    } catch (err) { alert('Image error: ' + err.message); }
    finally { setIsCompressing(false); }
  };

  const handleAdd = (e) => {
    e.preventDefault();
    const nextId = materials.length > 0 ? Math.max(...materials.map(m => m.id)) + 1 : 1;
    setMaterials(prev => [...prev, {
      id: nextId,
      name: newMat.name,
      category: newMat.category,
      comments: newMat.comments || '',
      status: 'Pending',
      date: new Date().toISOString().split('T')[0],
      photo: newMat.photo || null
    }]);
    setShowAdd(false);
    setNewMat({ name: '', category: 'Plants', comments: '', photo: null });
  };

  const setStatus = (id, status) => {
    setMaterials(prev => prev.map(m => m.id === id ? { ...m, status, date: new Date().toISOString().split('T')[0] } : m));
  };

  const deleteMat = (id) => {
    if (!confirm('Delete this sample?')) return;
    setMaterials(prev => prev.filter(m => m.id !== id));
  };

  const filtered = activeTab === 'All' ? materials : materials.filter(m => m.category === activeTab);

  const statusIcon  = { Approved: <Check size={12} />, Rejected: <X size={12} />, Pending: <Clock size={12} /> };
  const statusColor = { Approved: '#10b981', Rejected: '#ef4444', Pending: '#f59e0b' };
  const statusBg    = { Approved: '#ecfdf5', Rejected: '#fef2f2', Pending: '#fffbeb' };

  return (
    <div className="animate-fade">

      {lightbox && (
        <div className="tab-lightbox-overlay" onClick={() => setLightbox(null)}>
          <button className="tab-lightbox-close" onClick={() => setLightbox(null)}>&times;</button>
          <img src={lightbox} alt="Material" className="tab-lightbox-img" onClick={e => e.stopPropagation()} />
        </div>
      )}

      <div className="tab-page-head">
        <div>
          <h2 className="tab-page-title">Material Selection</h2>
          <p className="tab-page-sub">Upload samples, coordinate approvals and track status.</p>
        </div>
        <button className="pj-add-btn" onClick={() => setShowAdd(true)}>
          <Plus size={15} /> Upload Sample
        </button>
      </div>

      {/* Category filter */}
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
        {CATEGORIES.map(cat => (
          <button key={cat} onClick={() => setActiveTab(cat)}
            className={`pj-filter-btn ${activeTab === cat ? 'active' : ''}`}>
            {cat}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="tab-empty">No samples in this category yet.</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '1rem' }}>
          {filtered.map(mat => (
            <div key={mat.id} className="tab-card">
              {mat.photo && (
                <div style={{ width: '100%', height: '140px', overflow: 'hidden', cursor: 'pointer' }}
                  onClick={() => setLightbox(mat.photo)}>
                  <img src={mat.photo} alt={mat.name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.2s' }}
                    onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.04)'}
                    onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                  />
                </div>
              )}
              <div className="tab-card-body" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#0b3d27' }}>{mat.name}</div>
                    <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '2px' }}>{mat.category} · {mat.date}</div>
                  </div>
                  <button className="tab-icon-btn danger" onClick={() => deleteMat(mat.id)} title="Delete">
                    <Trash2 size={12} />
                  </button>
                </div>

                {mat.comments && (
                  <p style={{ fontSize: '0.78rem', color: '#64748b', lineHeight: 1.4 }}>{mat.comments}</p>
                )}

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '6px', borderTop: '1px solid #f1f5f9' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.78rem', fontWeight: 600,
                    color: statusColor[mat.status], background: statusBg[mat.status],
                    padding: '3px 10px', borderRadius: '6px' }}>
                    {statusIcon[mat.status]} {mat.status}
                  </span>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    {['Approved', 'Pending', 'Rejected'].map(s => (
                      <button key={s} onClick={() => setStatus(mat.id, s)}
                        title={s}
                        style={{ width: '26px', height: '26px', border: 'none', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          background: mat.status === s ? statusBg[s] : '#f8fafc',
                          color: mat.status === s ? statusColor[s] : '#94a3b8' }}>
                        {s === 'Approved' ? <Check size={12} /> : s === 'Rejected' ? <X size={12} /> : <Clock size={12} />}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showAdd && (
        <div className="tab-modal-overlay">
          <div className="tab-modal">
            <div className="tab-modal-head">
              <span className="tab-modal-title">Upload Material Sample</span>
              <button className="tab-modal-close" onClick={() => setShowAdd(false)}>&times;</button>
            </div>
            <form onSubmit={handleAdd}>
              <div className="tab-modal-body">
                <div className="form-group">
                  <label>Material Name</label>
                  <input type="text" required value={newMat.name}
                    onChange={e => setNewMat({...newMat, name: e.target.value})}
                    className="input-field" placeholder="e.g. Natural Red Sandstone"
                    list="inv-suggestions" />
                  <datalist id="inv-suggestions">
                    {inventoryItems.map((item, i) => <option key={i} value={item.name} />)}
                  </datalist>
                </div>
                <div className="form-group">
                  <label>Category</label>
                  <select value={newMat.category} onChange={e => setNewMat({...newMat, category: e.target.value})} className="input-field">
                    {CATEGORIES.slice(1).map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Comments</label>
                  <textarea rows={2} value={newMat.comments}
                    onChange={e => setNewMat({...newMat, comments: e.target.value})}
                    className="input-field" style={{ resize: 'none' }}
                    placeholder="Specification notes, source, remarks..." />
                </div>
                <div className="form-group">
                  <label>Photo (optional)</label>
                  <input type="file" accept="image/*" onChange={handlePhotoChange}
                    style={{ width: '100%', padding: '0.4rem', border: '1px dashed #e2e8f0', borderRadius: '8px', fontSize: '0.82rem' }} />
                  {isCompressing && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: '#10b981', marginTop: '6px' }}>
                      <Loader2 size={13} className="db-spin" /> Compressing...
                    </div>
                  )}
                  {newMat.photo && (
                    <img src={newMat.photo} alt="preview"
                      style={{ width: '90px', height: '70px', objectFit: 'cover', borderRadius: '6px', marginTop: '8px', border: '1px solid #e2e8f0' }} />
                  )}
                </div>
              </div>
              <div className="tab-modal-foot">
                <button type="button" className="btn-secondary" onClick={() => setShowAdd(false)}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={isCompressing}>
                  {isCompressing ? 'Processing...' : 'Add Sample'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}