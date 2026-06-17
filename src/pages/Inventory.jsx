import { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import { Package, Plus, Search, AlertTriangle, TrendingDown, Leaf, Droplets, Shovel, Loader2 } from 'lucide-react';
import { supabase } from '../supabase';
import '../index.css';

const CATEGORIES = ['All', 'Plants', 'Fertilizers', 'Irrigation', 'Tools', 'Aggregates', 'Others'];

const CATEGORY_ICONS = {
  Plants: <Leaf size={16} />,
  Fertilizers: <Leaf size={16} />,
  Irrigation: <Droplets size={16} />,
  Tools: <Shovel size={16} />,
  Aggregates: <Package size={16} />,
  Others: <Package size={16} />
};

export default function Inventory() {
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [items, setItems] = useState([]);

  const [form, setForm] = useState({ 
    name: '', 
    botanical_name: '',
    category: 'Plants', 
    unit: '', 
    stock: '', 
    min_stock: '', 
    unit_cost: '', 
    supplier: '' 
  });

  useEffect(() => {
    fetchInventory();
  }, []);

  const fetchInventory = async () => {
    setLoading(true);
    try {
      const { data: plants, error: plantsError } = await supabase
        .from('plants_inventory')
        .select('*');

      if (plantsError) throw plantsError;

      const { data: materials, error: mError } = await supabase
        .from('materials_inventory')
        .select('*');

      if (mError) throw mError;

      // Normalize plants entries
      const plantsNormalized = (plants || []).map(p => ({
        id: `plant-${p.id}`,
        dbId: p.id,
        type: 'plant',
        name: p.name + (p.botanical_name ? ` (${p.botanical_name})` : ''),
        rawName: p.name,
        botanicalName: p.botanical_name || '',
        category: 'Plants',
        unit: p.size_height || 'Nos',
        stock: p.quantity_available || 0,
        min_stock: p.low_stock_threshold || 0,
        unit_cost: Number(p.purchase_rate) || 0,
        supplier: p.nursery_source || 'N/A',
        last_updated: p.created_at ? new Date(p.created_at).toISOString().split('T')[0] : 'N/A'
      }));

      // Normalize materials entries
      const materialsNormalized = (materials || []).map(m => {
        let cat = 'Others';
        const dbCat = m.category || '';
        if (dbCat.includes('Fertilizer')) cat = 'Fertilizers';
        else if (dbCat.includes('Irrigation') || dbCat.includes('Drip')) cat = 'Irrigation';
        else if (dbCat.includes('Tools') || dbCat.includes('Garden')) cat = 'Tools';
        else if (dbCat.includes('Pebbles') || dbCat.includes('Soil') || dbCat.includes('Cocopeat') || dbCat.includes('Sand')) cat = 'Aggregates';

        return {
          id: `material-${m.id}`,
          dbId: m.id,
          type: 'material',
          name: m.item_name,
          category: cat,
          dbCategory: dbCat,
          unit: m.unit || 'Nos',
          stock: Number(m.quantity_available) || 0,
          min_stock: Number(m.low_stock_threshold) || 0,
          unit_cost: Number(m.purchase_rate) || 0,
          supplier: 'General Vendor',
          last_updated: m.created_at ? new Date(m.created_at).toISOString().split('T')[0] : 'N/A'
        };
      });

      setItems([...plantsNormalized, ...materialsNormalized]);
    } catch (err) {
      console.error('Error fetching inventory:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    try {
      if (form.category === 'Plants') {
        const { error } = await supabase
          .from('plants_inventory')
          .insert([{
            name: form.name,
            botanical_name: form.botanical_name || '',
            category: 'Ornamental Plants', // default plants category
            size_height: form.unit || 'Nos',
            quantity_available: Number(form.stock) || 0,
            low_stock_threshold: Number(form.min_stock) || 0,
            nursery_source: form.supplier || 'General Nursery',
            purchase_rate: Number(form.unit_cost) || 0
          }]);

        if (error) throw error;
      } else {
        // Map to DB category enum: Pots, Fertilizers, Drip Irrigation Material, Pebbles, Soil, Cocopeat, Garden Tools, Others
        let dbCat = 'Others';
        if (form.category === 'Fertilizers') dbCat = 'Fertilizers';
        else if (form.category === 'Irrigation') dbCat = 'Drip Irrigation Material';
        else if (form.category === 'Tools') dbCat = 'Garden Tools';
        else if (form.category === 'Aggregates') dbCat = 'Pebbles';

        const { error } = await supabase
          .from('materials_inventory')
          .insert([{
            item_name: form.name,
            category: dbCat,
            quantity_available: Number(form.stock) || 0,
            unit: form.unit || 'Nos',
            low_stock_threshold: Number(form.min_stock) || 0,
            purchase_rate: Number(form.unit_cost) || 0
          }]);

        if (error) throw error;
      }

      setShowAddModal(false);
      setForm({ name: '', botanical_name: '', category: 'Plants', unit: '', stock: '', min_stock: '', unit_cost: '', supplier: '' });
      fetchInventory();
    } catch (err) {
      console.error('Error adding inventory item:', err);
      alert(err.message || 'Failed to add item');
    }
  };

  const filtered = items.filter(i => {
    const matchSearch = i.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      i.supplier.toLowerCase().includes(searchTerm.toLowerCase());
    const matchCat = categoryFilter === 'All' || i.category === categoryFilter;
    return matchSearch && matchCat;
  });

  const lowStockItems = items.filter(i => i.stock < i.min_stock).length;
  const totalValue = items.reduce((s, i) => s + (i.stock * i.unit_cost), 0);

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Header title="Inventory" />
        <main className="main-content animate-fade">
          {/* Page Header */}
          <div className="projects-header-bar" style={{ marginBottom: '1.5rem' }}>
            <div>
              <h1 style={{ fontSize: '1.75rem', fontWeight: 800 }}>Inventory & Stock</h1>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Plants, fertilizers, irrigation supplies, tools, and aggregates.</p>
            </div>
            <button className="btn-primary" onClick={() => setShowAddModal(true)}>
              <Plus size={18} /> Add Item
            </button>
          </div>

          {/* Summary Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
            {[
              { label: 'Total Items', val: items.length, icon: <Package size={20} />, color: '#6d28d9' },
              { label: 'Low Stock Alerts', val: lowStockItems, icon: <AlertTriangle size={20} />, color: '#dc2626' },
              { label: 'Total Stock Value', val: `₹${(totalValue / 100000).toFixed(1)}L`, icon: <TrendingDown size={20} />, color: '#0284c7' }
            ].map(s => (
              <div key={s.label} className="stat-card" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: `${s.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: s.color }}>{s.icon}</div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{s.label}</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: s.color }}>{s.val}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Search + Filter */}
          <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: 1, maxWidth: '360px' }}>
              <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search item or supplier..." className="input-field" style={{ paddingLeft: '2.5rem' }} />
            </div>
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
              {CATEGORIES.map(cat => (
                <button key={cat} onClick={() => setCategoryFilter(cat)} style={{ padding: '0.35rem 0.8rem', borderRadius: '20px', border: '1px solid var(--border)', backgroundColor: categoryFilter === cat ? 'var(--primary)' : 'white', color: categoryFilter === cat ? 'white' : 'var(--text)', fontSize: '0.82rem', fontWeight: 500, cursor: 'pointer' }}>{cat}</button>
              ))}
            </div>
          </div>

          {/* Table */}
          <div style={{ background: 'white', borderRadius: '14px', border: '1px solid var(--border)', overflow: 'hidden' }}>
            {loading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
                <Loader2 className="db-spin" size={32} />
              </div>
            ) : (
              <div className="table-responsive">
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f8fafc' }}>
                      {['Item Name', 'Category', 'Unit/Size', 'In Stock', 'Min Stock', 'Unit Cost', 'Total Value', 'Supplier', 'Status', 'Last Updated'].map(h => (
                        <th key={h} style={{ padding: '0.875rem 1rem', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)', whiteSpace: 'nowrap', borderBottom: '1px solid var(--border)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((item, idx) => {
                      const isLow = item.stock < item.min_stock;
                      return (
                        <tr key={item.id} style={{ borderBottom: '1px solid #f1f5f9', background: isLow ? '#fff5f5' : idx % 2 === 0 ? 'white' : '#fafbfc' }}>
                          <td style={{ padding: '0.875rem 1rem', fontWeight: 600, color: 'var(--text)' }}>
                            {isLow && <AlertTriangle size={13} style={{ color: '#dc2626', marginRight: '0.3rem', verticalAlign: 'middle' }} />}
                            {item.name}
                          </td>
                          <td style={{ padding: '0.875rem 1rem' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: 'var(--primary)' }}>
                              {CATEGORY_ICONS[item.category] || <Package size={14} />} {item.category}
                            </span>
                          </td>
                          <td style={{ padding: '0.875rem 1rem', color: 'var(--text-muted)' }}>{item.unit}</td>
                          <td style={{ padding: '0.875rem 1rem', fontWeight: 700, color: isLow ? '#dc2626' : '#10b981' }}>{item.stock}</td>
                          <td style={{ padding: '0.875rem 1rem', color: 'var(--text-muted)' }}>{item.min_stock}</td>
                          <td style={{ padding: '0.875rem 1rem' }}>₹{item.unit_cost.toLocaleString()}</td>
                          <td style={{ padding: '0.875rem 1rem', fontWeight: 600 }}>₹{(item.stock * item.unit_cost).toLocaleString()}</td>
                          <td style={{ padding: '0.875rem 1rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>{item.supplier}</td>
                          <td style={{ padding: '0.875rem 1rem' }}>
                            <span style={{ padding: '0.2rem 0.6rem', borderRadius: '20px', fontSize: '0.72rem', fontWeight: 700, backgroundColor: isLow ? '#fee2e2' : '#d1fae5', color: isLow ? '#dc2626' : '#059669' }}>
                              {isLow ? 'Low Stock' : 'In Stock'}
                            </span>
                          </td>
                          <td style={{ padding: '0.875rem 1rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>{item.last_updated}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {!loading && filtered.length === 0 && (
              <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                <Package size={40} style={{ marginBottom: '1rem', opacity: 0.4 }} />
                <p>No items found</p>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal-content animate-fade" style={{ maxWidth: '560px' }}>
            <div className="modal-header">
              <h3 style={{ fontWeight: 700 }}>Add Inventory Item</h3>
              <button onClick={() => setShowAddModal(false)} style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer' }}>&times;</button>
            </div>
            <form onSubmit={handleAdd}>
              <div className="modal-body modal-form-grid">
                <div className="form-group" style={{ gridColumn: '1/-1' }}>
                  <label>Item Name</label>
                  <input type="text" required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="input-field" placeholder="e.g. Areca Palm or Heavy Spade" />
                </div>
                {form.category === 'Plants' && (
                  <div className="form-group" style={{ gridColumn: '1/-1' }}>
                    <label>Botanical Name</label>
                    <input type="text" value={form.botanical_name} onChange={e => setForm({ ...form, botanical_name: e.target.value })} className="input-field" placeholder="e.g. Dypsis lutescens" />
                  </div>
                )}
                <div className="form-group">
                  <label>Category</label>
                  <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value, botanical_name: e.target.value === 'Plants' ? form.botanical_name : '' })} className="input-field">
                    {CATEGORIES.slice(1).map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>{form.category === 'Plants' ? 'Height / Size' : 'Unit'}</label>
                  <input type="text" required value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} className="input-field" placeholder={form.category === 'Plants' ? 'e.g. 5-6 ft bag' : 'e.g. Nos / Bags / Meters'} />
                </div>
                <div className="form-group">
                  <label>Current Stock</label>
                  <input type="number" required value={form.stock} onChange={e => setForm({ ...form, stock: e.target.value })} className="input-field" />
                </div>
                <div className="form-group">
                  <label>Minimum Stock Level</label>
                  <input type="number" required value={form.min_stock} onChange={e => setForm({ ...form, min_stock: e.target.value })} className="input-field" />
                </div>
                <div className="form-group">
                  <label>Unit Cost (₹)</label>
                  <input type="number" required value={form.unit_cost} onChange={e => setForm({ ...form, unit_cost: e.target.value })} className="input-field" />
                </div>
                {form.category === 'Plants' && (
                  <div className="form-group">
                    <label>Nursery Source</label>
                    <input type="text" value={form.supplier} onChange={e => setForm({ ...form, supplier: e.target.value })} className="input-field" placeholder="e.g. GreenGrow Nursery" />
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setShowAddModal(false)}>Cancel</button>
                <button type="submit" className="btn-primary">Add Item</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
