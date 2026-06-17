import { useState, useEffect } from 'react';
import { formatCurrency } from '../../utils/helpers';
import { Plus, Trash2, Loader2 } from 'lucide-react';
import { supabase } from '../../supabase';

const CATEGORIES = ['Plantation', 'Soil & Fertilizer', 'Irrigation', 'Lighting', 'Hardscape'];

export default function TabPlantationBOQ({ project }) {
  const [activeCat,  setActiveCat]  = useState('Plantation');
  const [items,      setItems]      = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [newItem, setNewItem] = useState({ name: '', qty: 1, unit: 'nos', rate: 0 });

  useEffect(() => { fetchBOQ(); }, [project.id]);

  const fetchBOQ = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('boq_items')
        .select('*').eq('project_id', project.id).order('created_at', { ascending: true });
      if (error) throw error;
      setItems(data || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    const qty = Number(newItem.qty) || 1;
    const rate = Number(newItem.rate) || 0;
    try {
      const { error } = await supabase.from('boq_items').insert([{
        project_id: project.id, category: activeCat,
        item_name: newItem.name, quantity: qty, unit: newItem.unit, rate, amount: qty * rate
      }]);
      if (error) throw error;
      setNewItem({ name: '', qty: 1, unit: 'nos', rate: 0 });
      fetchBOQ();
    } catch (err) { alert(err.message); }
  };

  const removeItem = async (id) => {
    try {
      const { error } = await supabase.from('boq_items').delete().eq('id', id);
      if (error) throw error;
      fetchBOQ();
    } catch (err) { console.error(err); }
  };

  const filtered = items.filter(i => i.category === activeCat);
  const total    = filtered.reduce((s, i) => s + Number(i.amount), 0);
  const preview  = (Number(newItem.qty) || 0) * (Number(newItem.rate) || 0);

  return (
    <div className="animate-fade">
      <div className="tab-page-head">
        <div>
          <h2 className="tab-page-title">Plantation BOQ</h2>
          <p className="tab-page-sub">Manage material schedules, vegetation quantities and cost estimates.</p>
        </div>
      </div>

      {/* Category tabs */}
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
        {CATEGORIES.map(cat => (
          <button key={cat} onClick={() => setActiveCat(cat)}
            className={`pj-filter-btn ${activeCat === cat ? 'active' : ''}`}>{cat}</button>
        ))}
      </div>

      <div className="tab-split-260-r" style={{ display: 'grid', gridTemplateColumns: '1fr 260px', gap: '1.25rem', alignItems: 'start' }}>

        {/* BOQ table */}
        <div className="tab-card">
          <div className="tab-card-head">
            <span className="tab-card-title">{activeCat} Schedule</span>
            <span style={{ fontWeight: 700, color: '#0b3d27', fontSize: '0.88rem' }}>Total: {formatCurrency(total)}</span>
          </div>
          <div className="tab-card-body" style={{ padding: 0 }}>
            {loading ? (
              <div className="tab-empty" style={{ padding: '2rem' }}><Loader2 size={18} className="db-spin" style={{ color: '#10b981' }} /></div>
            ) : filtered.length === 0 ? (
              <div className="tab-empty" style={{ padding: '2rem' }}>No items yet. Add from the form.</div>
            ) : (
              <table className="tab-table">
                <thead>
                  <tr><th>Item</th><th>Qty</th><th>Unit</th><th>Rate</th><th>Amount</th><th></th></tr>
                </thead>
                <tbody>
                  {filtered.map(item => (
                    <tr key={item.id}>
                      <td style={{ fontWeight: 600 }}>{item.item_name}</td>
                      <td>{item.quantity}</td>
                      <td style={{ color: '#64748b' }}>{item.unit}</td>
                      <td>{formatCurrency(item.rate)}</td>
                      <td style={{ fontWeight: 700 }}>{formatCurrency(item.amount)}</td>
                      <td>
                        <button className="tab-icon-btn danger" onClick={() => removeItem(item.id)} title="Delete"><Trash2 size={12} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Add form */}
        <div className="tab-card">
          <div className="tab-card-head"><span className="tab-card-title">Add Item</span></div>
          <div className="tab-card-body">
            <form onSubmit={handleAdd} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div className="form-group">
                <label>Item Name</label>
                <input type="text" required value={newItem.name}
                  onChange={e => setNewItem({...newItem, name: e.target.value})}
                  className="input-field" placeholder="e.g. Foxtail Palm 8ft" />
              </div>
              <div className="tab-split-half" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div className="form-group">
                  <label>Quantity</label>
                  <input type="number" required min="0.1" step="any" value={newItem.qty}
                    onChange={e => setNewItem({...newItem, qty: e.target.value})} className="input-field" />
                </div>
                <div className="form-group">
                  <label>Unit</label>
                  <select value={newItem.unit} onChange={e => setNewItem({...newItem, unit: e.target.value})} className="input-field">
                    {['nos','rft','sqft','bag','kg','cum'].map(u => <option key={u}>{u}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label>Unit Rate (₹)</label>
                <input type="number" required value={newItem.rate}
                  onChange={e => setNewItem({...newItem, rate: e.target.value})}
                  className="input-field" placeholder="e.g. 350" />
              </div>
              <div style={{ background: '#f8fafc', border: '1px solid #e9eef3', borderRadius: '8px', padding: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.83rem' }}>
                <span style={{ color: '#64748b' }}>Amount</span>
                <strong style={{ color: '#0b3d27' }}>{formatCurrency(preview)}</strong>
              </div>
              <button type="submit" className="btn-primary" style={{ justifyContent: 'center' }}>
                <Plus size={14} /> Add to BOQ
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}