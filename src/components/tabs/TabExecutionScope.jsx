import { useState, useEffect } from 'react';
import { Plus, Trash2, Loader2 } from 'lucide-react';
import { supabase } from '../../supabase';

const CATEGORIES = ['Plantation', 'Irrigation', 'Hardscape', 'General'];

export default function TabExecutionScope({ project }) {
  const [items,   setItems]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [newItem, setNewItem] = useState({ name: '', category: 'Plantation' });
  const [activeCat, setActiveCat] = useState('All');

  useEffect(() => { fetchItems(); }, [project.id]);

  const fetchItems = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('execution_scope_items')
        .select('*')
        .eq('project_id', project.id)
        .order('created_at', { ascending: true });
      if (error) throw error;
      setItems(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const toggleItem = async (id, checked) => {
    // Optimistic update — avoids scroll jump and feels instant
    setItems(prev => prev.map(i => i.id === id ? { ...i, checked: !checked } : i));
    try {
      const { error } = await supabase
        .from('execution_scope_items')
        .update({ checked: !checked })
        .eq('id', id);
      if (error) throw error;
    } catch (err) {
      console.error(err);
      // revert on failure
      setItems(prev => prev.map(i => i.id === id ? { ...i, checked } : i));
    }
  };

  const addItem = async (e) => {
    e.preventDefault();
    if (!newItem.name.trim()) return;
    try {
      const { data, error } = await supabase
        .from('execution_scope_items')
        .insert([{ project_id: project.id, category: newItem.category, item_name: newItem.name, checked: false }])
        .select().single();
      if (error) throw error;
      setItems(prev => [...prev, data]);
      setNewItem({ name: '', category: newItem.category });
    } catch (err) {
      alert(err.message);
    }
  };

  const deleteItem = async (id) => {
    try {
      const { error } = await supabase.from('execution_scope_items').delete().eq('id', id);
      if (error) throw error;
      setItems(prev => prev.filter(i => i.id !== id));
    } catch (err) {
      alert(err.message);
    }
  };

  const filtered = activeCat === 'All' ? items : items.filter(i => i.category === activeCat);
  const total = items.length;
  const done  = items.filter(i => i.checked).length;
  const pct   = total > 0 ? Math.round((done / total) * 100) : 0;

  // Group filtered items by category for display
  const grouped = CATEGORIES.reduce((acc, cat) => {
    const catItems = filtered.filter(i => i.category === cat);
    if (catItems.length > 0) acc[cat] = catItems;
    return acc;
  }, {});

  return (
    <div className="animate-fade">
      <div className="tab-page-head">
        <div>
          <h2 className="tab-page-title">Execution Scope</h2>
          <p className="tab-page-sub">Build a custom checklist of deliverables for this project. Saved to the cloud — synced across all devices.</p>
        </div>
      </div>

      {/* Progress summary */}
      {total > 0 && (
        <div className="tab-card" style={{ marginBottom: '1.25rem' }}>
          <div className="tab-card-body">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0b3d27' }}>Overall Progress</span>
              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#10b981' }}>{done}/{total} ({pct}%)</span>
            </div>
            <div className="pj-progress-track">
              <div className="pj-progress-fill" style={{ width: `${pct}%`, background: '#10b981' }} />
            </div>
          </div>
        </div>
      )}

      {/* Add item form */}
      <div className="tab-card" style={{ marginBottom: '1.25rem' }}>
        <div className="tab-card-head"><span className="tab-card-title">Add Checklist Item</span></div>
        <div className="tab-card-body">
          <form onSubmit={addItem} style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
            <input type="text" required value={newItem.name}
              onChange={e => setNewItem({...newItem, name: e.target.value})}
              className="input-field" placeholder="e.g. Soil preparation & levelling"
              style={{ flex: '1 1 240px' }} />
            <select value={newItem.category}
              onChange={e => setNewItem({...newItem, category: e.target.value})}
              className="input-field" style={{ width: '140px', flexShrink: 0 }}>
              {CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>
            <button type="submit" className="btn-primary" style={{ flexShrink: 0 }}>
              <Plus size={14} /> Add
            </button>
          </form>
        </div>
      </div>

      {/* Category filter */}
      {items.length > 0 && (
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
          {['All', ...CATEGORIES].map(cat => (
            <button key={cat} onClick={() => setActiveCat(cat)}
              className={`pj-filter-btn ${activeCat === cat ? 'active' : ''}`}>{cat}</button>
          ))}
        </div>
      )}

      {/* Checklist */}
      {loading ? (
        <div className="tab-empty"><Loader2 size={20} className="db-spin" style={{ color: '#10b981' }} /></div>
      ) : items.length === 0 ? (
        <div className="tab-empty">No checklist items yet. Add one above to get started.</div>
      ) : (
        Object.entries(grouped).map(([cat, catItems]) => (
          <div key={cat} className="scope-section">
            <div className="scope-title">
              <span>{cat}</span>
              <span style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 400 }}>
                {catItems.filter(i => i.checked).length}/{catItems.length} done
              </span>
            </div>
            <div className="scope-list">
              {catItems.map(item => (
                <div key={item.id} className="scope-item" style={{ cursor: 'pointer', justifyContent: 'space-between' }}>
                  <div
                    style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}
                    onClick={() => toggleItem(item.id, item.checked)}
                  >
                    <span className={`scope-checkbox ${item.checked ? 'checked' : ''}`} aria-hidden="true">
                      {item.checked && (
                        <svg width="10" height="10" viewBox="0 0 16 16" fill="none">
                          <path d="M3 8L6 11L13 4" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </span>
                    <span style={{ fontSize: '0.84rem', textDecoration: item.checked ? 'line-through' : 'none', color: item.checked ? '#94a3b8' : '#1e293b' }}>
                      {item.item_name}
                    </span>
                  </div>
                  <button className="tab-icon-btn danger" onClick={() => deleteItem(item.id)} title="Delete" style={{ flexShrink: 0 }}>
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}