import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  Plus, Trash2, Pencil, Loader2, Check, X, Clock,
  Leaf, Package, Wrench, IndianRupee, ImageOff,
} from 'lucide-react';
import { formatCurrency } from '../../utils/helpers';
import { compressImage } from '../../utils/imageCompressor';
import { supabase } from '../../supabase';

/* ─── body scroll lock (same as TabSchedule / TabDesignLayouts) ─── */
function useBodyScrollLock(active) {
  useEffect(() => {
    if (!active) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [active]);
}

/* ─── helpers ─── */
const fileToBase64 = (file) => new Promise((res, rej) => {
  const r = new FileReader();
  r.readAsDataURL(file);
  r.onload = () => res(r.result);
  r.onerror = rej;
});

/* ─── constants ─── */
const SECTIONS = {
  plants: {
    label: 'Plants & Plantation', singular: 'Plant / Item',
    icon: Leaf, color: '#10b981', dark: '#065f46', bg: '#ecfdf5',
    // Units: physical quantities only — no time-based rental units for plants
    units: ['nos', 'rft', 'sqft', 'bag', 'kg', 'cum', 'set', 'litre'],
    hasCost: true, hasStatus: false, table: 'boq_items',
  },
  materials: {
    label: 'Materials', singular: 'Material',
    icon: Package, color: '#3b82f6', dark: '#1e40af', bg: '#eff6ff',
    // Units: physical quantities — materials are purchased not rented
    units: ['nos', 'rft', 'sqft', 'bag', 'kg', 'litre', 'set', 'cum'],
    hasCost: true, hasStatus: true, table: 'material_samples',
  },
  equipment: {
    label: 'Equipment & Machinery', singular: 'Equipment',
    icon: Wrench, color: '#f59e0b', dark: '#92400e', bg: '#fffbeb',
    // Units: time-based first (most equipment is rented by day/hr), then counts
    units: ['day', 'hr', 'nos', 'set', 'month'],
    hasCost: true, hasStatus: true, table: 'equipment_items',
  },
};

const STATUSES = ['Pending', 'Approved', 'Rejected'];

const STATUS_BADGE = {
  Approved: 'tab-badge tab-badge-green',
  Rejected: 'tab-badge tab-badge-red',
  Pending:  'tab-badge tab-badge-yellow',
};

const STATUS_ICON = {
  Approved: <Check size={10} />,
  Rejected: <X size={10} />,
  Pending:  <Clock size={10} />,
};

function emptyForm(sectionKey) {
  return {
    name: '',
    qty: 1, unit: SECTIONS[sectionKey].units[0], rate: 0,
    comments: '', remarks: '', status: 'Pending', photo: null,
  };
}

/* ══════════════════════════════════════════════════════════════ */
export default function TabResources({ project }) {
  const [section, setSection] = useState('plants');

  const [items,   setItems]   = useState({ plants: [], materials: [], equipment: [] });
  const [loading, setLoading] = useState({ plants: true, materials: true, equipment: true });

  const [showModal,  setShowModal]  = useState(false);
  const [editingId,  setEditingId]  = useState(null);
  const [form,       setForm]       = useState(emptyForm('plants'));
  const [compressing, setCompressing] = useState(false);
  const [saving,      setSaving]      = useState(false);

  const [lightbox, setLightbox] = useState(null);
  const [invItems, setInvItems] = useState([]);

  useBodyScrollLock(showModal || !!lightbox);

  const cfg = SECTIONS[section];

  /* ─── fetch ─── */
  useEffect(() => {
    fetchSection('plants');
    fetchSection('materials');
    fetchSection('equipment');
    fetchInventory();
  }, [project.id]);

  const fetchSection = async (key) => {
    setLoading(prev => ({ ...prev, [key]: true }));
    try {
      const { data, error } = await supabase
        .from(SECTIONS[key].table).select('*')
        .eq('project_id', project.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setItems(prev => ({ ...prev, [key]: data || [] }));
    } catch (e) { console.error(e); }
    finally { setLoading(prev => ({ ...prev, [key]: false })); }
  };

  const fetchInventory = async () => {
    try {
      const [{ data: mats }, { data: plants }] = await Promise.all([
        supabase.from('materials_inventory').select('item_name'),
        supabase.from('plants_inventory').select('name'),
      ]);
      setInvItems([
        ...(mats   || []).map(d => d.item_name),
        ...(plants || []).map(p => p.name),
      ]);
    } catch (e) { console.error(e); }
  };

  /* ─── modal ─── */
  const openAdd = () => {
    setEditingId(null);
    setForm(emptyForm(section));
    setShowModal(true);
  };

  const openEdit = (item) => {
    setEditingId(item.id);
    setForm({
      name:     item.name || item.item_name || '',
      qty:      item.qty ?? item.quantity ?? 1,
      unit:     item.unit || cfg.units[0],
      rate:     item.rate ?? 0,
      comments: item.comments || '',
      remarks:  item.remarks  || '',
      status:   item.status   || 'Pending',
      photo:    item.photo    || null,
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingId(null);
    setForm(emptyForm(section));
  };

  /* ─── photo ─── */
  const handlePhoto = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setCompressing(true);
    try {
      const comp = await compressImage(file, { maxWidth: 800, maxHeight: 800, quality: 0.7 });
      const b64  = await fileToBase64(comp);
      setForm(prev => ({ ...prev, photo: b64 }));
    } catch (err) { alert('Image error: ' + err.message); }
    finally { setCompressing(false); }
  };

  /* ─── save ─── */
  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const qty  = Number(form.qty)  || 1;
      const rate = Number(form.rate) || 0;
      const amount = qty * rate;

      let payload = { photo: form.photo || null };

      if (section === 'plants') {
        payload = { ...payload, item_name: form.name, quantity: qty, unit: form.unit, rate, amount };
      } else if (section === 'materials') {
        payload = { ...payload, name: form.name, qty, unit: form.unit, rate, amount,
          comments: form.comments || null, status: editingId ? form.status : 'Pending' };
      } else {
        payload = { ...payload, name: form.name, qty, unit: form.unit, rate, amount,
          status: form.status, remarks: form.remarks || null };
      }

      if (editingId) {
        const { error } = await supabase.from(cfg.table).update(payload).eq('id', editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from(cfg.table).insert([{ ...payload, project_id: project.id }]);
        if (error) throw error;
      }
      closeModal();
      fetchSection(section);
    } catch (err) {
      alert(err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  /* ─── delete ─── */
  const handleDelete = async (item) => {
    if (!confirm(`Delete "${item.name || item.item_name}"?`)) return;
    try {
      const { error } = await supabase.from(cfg.table).delete().eq('id', item.id);
      if (error) throw error;
      setItems(prev => ({ ...prev, [section]: prev[section].filter(i => i.id !== item.id) }));
    } catch (e) { alert(e.message); }
  };

  /* ─── cycle status ─── */
  const cycleStatus = async (item) => {
    const next = STATUSES[(STATUSES.indexOf(item.status) + 1) % STATUSES.length];
    setItems(prev => ({ ...prev, [section]: prev[section].map(i => i.id === item.id ? { ...i, status: next } : i) }));
    try {
      const { error } = await supabase.from(cfg.table).update({ status: next }).eq('id', item.id);
      if (error) throw error;
    } catch (e) { alert(e.message); fetchSection(section); }
  };

  /* ─── derived ─── */
  const sectionItems = items[section] || [];

  const plantsTotal    = useMemo(() => (items.plants    || []).reduce((s, i) => s + Number(i.amount || 0), 0), [items.plants]);
  const materialsTotal = useMemo(() => (items.materials || []).reduce((s, i) => s + Number(i.amount || 0), 0), [items.materials]);
  const eqTotal        = useMemo(() => (items.equipment || []).reduce((s, i) => s + Number(i.amount || 0), 0), [items.equipment]);
  const grandTotal     = plantsTotal + materialsTotal + eqTotal;
  const pendingCount   = useMemo(() =>
    (items.materials || []).filter(m => m.status === 'Pending').length +
    (items.equipment || []).filter(e => e.status === 'Pending').length
  , [items.materials, items.equipment]);

  const previewAmount = (Number(form.qty) || 0) * (Number(form.rate) || 0);

  /* ══════════════════════════════════════════ RENDER */
  return (
    <div className="animate-fade">

      {/* Lightbox */}
      {lightbox && createPortal(
        <div className="res-lightbox-overlay" onClick={() => setLightbox(null)}>
          <button className="res-lightbox-close" onClick={() => setLightbox(null)}>&times;</button>
          <img src={lightbox} alt="" className="res-lightbox-img" onClick={e => e.stopPropagation()} />
        </div>,
        document.body
      )}

      {/* ── Header ── */}
      <div className="tab-page-head">
        <div>
          <h2 className="tab-page-title">Resources</h2>
        </div>
        <button className="pj-add-btn" onClick={openAdd}>
          <Plus size={15} /> Add {cfg.singular}
        </button>
      </div>

      {/* ── KPI row ── */}
      <div className="res-kpi-row">
        <div className="tab-kpi">
          <div className="tab-kpi-label">Plants &amp; BOQ</div>
          <div className="tab-kpi-value">{formatCurrency(plantsTotal)}</div>
        </div>
        <div className="tab-kpi">
          <div className="tab-kpi-label">Materials</div>
          <div className="tab-kpi-value">{formatCurrency(materialsTotal)}</div>
        </div>
        <div className="tab-kpi">
          <div className="tab-kpi-label">Equipment</div>
          <div className="tab-kpi-value">{formatCurrency(eqTotal)}</div>
        </div>
        <div className="tab-kpi">
          <div className="tab-kpi-label">Total Cost</div>
          <div className="tab-kpi-value">{formatCurrency(grandTotal)}</div>
        </div>
      </div>

      {/* ── Section switcher ── */}
      <div className="res-switcher">
        {Object.entries(SECTIONS).map(([key, s]) => {
          const Icon = s.icon;
          const isActive = section === key;
          return (
            <button key={key}
              className={`res-switcher-btn ${isActive ? 'active' : ''}`}
              style={isActive ? { '--rs-color': s.dark, '--rs-bg': s.bg, borderColor: s.dark } : {}}
              onClick={() => setSection(key)}>
              <Icon size={14} />
              <span className="res-switcher-label">{s.label}</span>
              <span className="res-switcher-label-short">{s.singular === 'Plant / Item' ? 'Plants' : s.singular}</span>
              <span className="res-switcher-count">{items[key]?.length || 0}</span>
            </button>
          );
        })}
      </div>

      {/* ── Content ── */}
      {loading[section] ? (
        <div className="tab-empty">
          <Loader2 size={22} className="db-spin" style={{ color: cfg.color }} />
        </div>
      ) : sectionItems.length === 0 ? (
        <div className="tab-empty">
          {`No ${cfg.label.toLowerCase()} added yet. Click "Add ${cfg.singular}" to begin.`}
        </div>
      ) : (
        <div className="res-grid">
          {sectionItems.map(item => {
            const name = item.name || item.item_name;
            const qty  = item.qty ?? item.quantity;
            const Icon = cfg.icon;
            return (
              <div key={item.id} className="res-card">
                {/* Photo */}
                {item.photo ? (
                  <div className="res-card-photo" onClick={() => setLightbox(item.photo)}>
                    <img src={item.photo} alt={name} />
                  </div>
                ) : (
                  <div className="res-card-photo-empty">
                    <Icon size={22} />
                  </div>
                )}

                <div className="res-card-body">
                  {/* Name + actions */}
                  <div className="res-card-top">
                    <div style={{ minWidth: 0 }}>
                      <div className="res-card-name" title={name}>{name}</div>
                    </div>
                    <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                      <button className="tab-icon-btn" title="Edit" onClick={() => openEdit(item)}>
                        <Pencil size={12} />
                      </button>
                      <button className="tab-icon-btn danger" title="Delete" onClick={() => handleDelete(item)}>
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>

                  {/* Comments (materials) */}
                  {item.comments && (
                    <p className="res-card-note">{item.comments}</p>
                  )}

                  {/* Cost stats (plants + equipment) */}
                  {cfg.hasCost && (
                    <div className="res-card-cost">
                      <div>
                        <div className="res-cost-label">Qty</div>
                        <div className="res-cost-value">{qty} {item.unit}</div>
                      </div>
                      <div>
                        <div className="res-cost-label">Rate</div>
                        <div className="res-cost-value">{formatCurrency(item.rate)}</div>
                      </div>
                      <div>
                        <div className="res-cost-label">Amount</div>
                        <div className="res-cost-value res-cost-amount">{formatCurrency(item.amount)}</div>
                      </div>
                    </div>
                  )}

                  {/* Status + remarks */}
                  {(cfg.hasStatus || item.remarks) && (
                    <div className="res-card-foot">
                      {cfg.hasStatus && (
                        <button
                          className={`${STATUS_BADGE[item.status] || 'tab-badge tab-badge-gray'} res-status-btn`}
                          onClick={() => cycleStatus(item)}
                          title="Click to cycle status">
                          {STATUS_ICON[item.status]} {item.status}
                        </button>
                      )}
                      {item.remarks && (
                        <span style={{ fontSize: '0.72rem', color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '120px' }}>
                          {item.remarks}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ══════════════ Modal — portalled to body ══════════════ */}
      {showModal && createPortal(
        <div
          className="tab-modal-overlay"
          onClick={e => { if (e.target === e.currentTarget) closeModal(); }}>
          <div className="tab-modal">
            <div className="tab-modal-head">
              <span className="tab-modal-title">
                {editingId ? 'Edit' : 'Add'} {cfg.singular}
              </span>
              <button className="tab-modal-close" onClick={closeModal}>&times;</button>
            </div>
            <form onSubmit={handleSave}
              style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
              <div className="tab-modal-body">

                <div className="form-group">
                  <label>Name</label>
                  <input type="text" required value={form.name}
                    onChange={e => setForm({ ...form, name: e.target.value })}
                    className="input-field"
                    placeholder={
                      section === 'plants'    ? 'e.g. Foxtail Palm 8ft' :
                      section === 'materials' ? 'e.g. Natural Red Sandstone' :
                                                'e.g. JCB Mini Excavator'
                    }
                    list={section !== 'equipment' ? 'res-inv-suggestions' : undefined}
                    autoFocus />
                  {section !== 'equipment' && (
                    <datalist id="res-inv-suggestions">
                      {invItems.map((n, i) => <option key={i} value={n} />)}
                    </datalist>
                  )}
                </div>

                {cfg.hasCost && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                    <div className="form-group">
                      <label>Quantity</label>
                      <input type="number" required min="0.1" step="any" value={form.qty}
                        onChange={e => setForm({ ...form, qty: e.target.value })}
                        className="input-field" />
                    </div>
                    <div className="form-group">
                      <label>Unit</label>
                      <select value={form.unit}
                        onChange={e => setForm({ ...form, unit: e.target.value })}
                        className="input-field">
                        {cfg.units.map(u => <option key={u}>{u}</option>)}
                      </select>
                    </div>
                  </div>
                )}

                {cfg.hasCost && (
                  <>
                    <div className="form-group">
                      <label>Rate (₹ per {form.unit})</label>
                      <input type="number" required min="0" step="any" value={form.rate}
                        onChange={e => setForm({ ...form, rate: e.target.value })}
                        className="input-field" placeholder="e.g. 350" />
                    </div>
                    <div style={{ background: '#f8fafc', border: '1px solid #e9eef3', borderRadius: '8px', padding: '0.7rem 0.85rem', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '6px', fontSize: '0.8rem' }}>
                      <span style={{ color: '#64748b' }}>{form.qty || 0} {form.unit} × {formatCurrency(form.rate || 0)}</span>
                      <strong style={{ color: '#0b3d27', fontFamily: 'Outfit, sans-serif' }}>{formatCurrency(previewAmount)}</strong>
                    </div>
                  </>
                )}

                {section === 'materials' && (
                  <div className="form-group">
                    <label>Comments <span style={{ color: '#94a3b8', fontWeight: 400 }}>(optional)</span></label>
                    <textarea rows={2} value={form.comments}
                      onChange={e => setForm({ ...form, comments: e.target.value })}
                      className="input-field" style={{ resize: 'none' }}
                      placeholder="Specification notes, source, finish details..." />
                  </div>
                )}

                {section === 'equipment' && (
                  <div className="form-group">
                    <label>Remarks <span style={{ color: '#94a3b8', fontWeight: 400 }}>(optional)</span></label>
                    <input type="text" value={form.remarks}
                      onChange={e => setForm({ ...form, remarks: e.target.value })}
                      className="input-field" placeholder="Supplier, condition, rental period..." />
                  </div>
                )}

                {cfg.hasStatus && (
                  <div className="form-group">
                    <label>Approval Status</label>
                    <select value={form.status}
                      onChange={e => setForm({ ...form, status: e.target.value })}
                      className="input-field">
                      {STATUSES.map(s => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                )}

                <div className="form-group">
                  <label>Photo <span style={{ color: '#94a3b8', fontWeight: 400 }}>(optional)</span></label>
                  <input type="file" accept="image/*" onChange={handlePhoto}
                    style={{ width: '100%', padding: '0.45rem 0.7rem', border: '1.5px dashed #d1fae5', borderRadius: '8px', fontSize: '0.8rem', background: '#f0fdf4', cursor: 'pointer' }} />
                  {compressing && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: '#10b981', marginTop: '6px' }}>
                      <Loader2 size={13} className="db-spin" /> Compressing...
                    </div>
                  )}
                  {form.photo && !compressing && (
                    <img src={form.photo} alt="preview"
                      style={{ width: '90px', height: '70px', objectFit: 'cover', borderRadius: '6px', marginTop: '8px', border: '1px solid #e2e8f0' }} />
                  )}
                </div>

              </div>
              <div className="tab-modal-foot">
                <button type="button" className="btn-secondary" onClick={closeModal}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={saving || compressing}>
                  {saving
                    ? <><Loader2 size={13} className="db-spin" /> Saving…</>
                    : editingId ? 'Save Changes' : 'Add'}
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