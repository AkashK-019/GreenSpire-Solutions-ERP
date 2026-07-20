import { useState, useEffect, useCallback, useMemo } from 'react';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import {
  Package, Plus, Search, Leaf,
  Droplets, Shovel, Loader2, Edit2, Trash2,
  Download, ChevronLeft, AlertTriangle, CheckCircle2,
  FlaskConical, Layers
} from 'lucide-react';
import { supabase } from '../supabase';
import '../index.css';
import '../styles/Inventory.css';

const MAIN_TABS  = ['Plants', 'Materials'];
const MAT_SUBTABS = ['All', 'Fertilizers', 'Irrigation', 'Tools', 'Aggregates', 'Others'];

const MAT_META = {
  Fertilizers: { icon: <FlaskConical size={13}/>, desc:'NPK, organic, micronutrients' },
  Irrigation:  { icon: <Droplets size={13}/>,     desc:'Drip pipes, emitters, fittings' },
  Tools:       { icon: <Shovel size={13}/>,        desc:'Spades, pruners, equipment' },
  Aggregates:  { icon: <Layers size={13}/>,        desc:'Soil, cocopeat, pebbles, sand' },
  Others:      { icon: <Package size={13}/>,       desc:'Miscellaneous supplies' },
};

const ALL_ADD_CATS = ['Plants', 'Materials'];
const EMPTY_FORM = { name:'', botanical_name:'', category:'Plants', unit:'', stock:'', min_stock:'', unit_cost:'', supplier:'' };

const fmtDate = iso => iso ? new Date(iso).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}) : '—';
const fmtINR  = n => '₹' + Number(n).toLocaleString('en-IN');
const fmtVal  = n => {
  const v = Number(n);
  if (v === 0)      return '₹0';
  if (v < 1000)     return '₹' + v.toLocaleString('en-IN');
  if (v < 100000)   return '₹' + (v/1000).toFixed(v%1000===0?0:1).replace(/\.0$/,'') + 'K';
  if (v < 10000000) return '₹' + (v/100000).toFixed(v%100000===0?0:1).replace(/\.0$/,'') + 'L';
  return '₹' + (v/10000000).toFixed(1).replace(/\.0$/,'') + 'Cr';
};

export default function Inventory() {
  const [loading, setLoading]     = useState(true);
  const [items, setItems]         = useState([]);
  const [mainTab, setMainTab]     = useState('Plants');
  const [matSubTab, setMatSubTab] = useState('All');
  const [search, setSearch]       = useState('');
  const [showPicker, setShowPicker] = useState(false);
  const [showForm, setShowForm]   = useState(false);
  const [editItem, setEditItem]   = useState(null);
  const [confirmDel, setConfirmDel] = useState(null);
  const [form, setForm]           = useState(EMPTY_FORM);
  const [saving, setSaving]       = useState(false);


  /* ── fetch ── */
  const fetchInventory = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data: plants, error: pe }, { data: mats, error: me }] = await Promise.all([
        supabase.from('plants_inventory').select('*'),
        supabase.from('materials_inventory').select('*'),
      ]);
      if (pe) throw pe;
      if (me) throw me;

      const norm = [
        ...(plants || []).map(p => ({
          id:`plant-${p.id}`, dbId:p.id, type:'plant',
          name:p.name, sub:p.botanical_name||'',
          category:'Plants', unit:p.size_height||'Nos',
          stock:p.quantity_available||0,
          min_stock:p.low_stock_threshold||0,
          unit_cost:Number(p.purchase_rate)||0,
          supplier:p.nursery_source||'N/A',
          last_updated:fmtDate(p.created_at),
        })),
        ...(mats || []).map(m => {
          let cat='Others';
          const db=m.category||'';
          if (db.includes('Fertilizer'))                                    cat='Fertilizers';
          else if (db.includes('Irrigation')||db.includes('Drip'))         cat='Irrigation';
          else if (db.includes('Tools')||db.includes('Garden'))            cat='Tools';
          else if (db.includes('Pebbles')||db.includes('Soil')||
                   db.includes('Cocopeat')||db.includes('Sand'))           cat='Aggregates';
          return {
            id:`material-${m.id}`, dbId:m.id, type:'material',
            name:m.item_name, sub:'', category:cat, dbCategory:db,
            unit:m.unit||'Nos',
            stock:Number(m.quantity_available)||0,
            min_stock:Number(m.low_stock_threshold)||0,
            unit_cost:Number(m.purchase_rate)||0,
            supplier: m.supplier || 'General Vendor',
            last_updated:fmtDate(m.created_at),
          };
        }),
      ];
      setItems(norm);
    } catch(err) {
      alert('Failed to load inventory');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchInventory(); }, [fetchInventory]);

/* ── Prevent background scroll when modal is open ── */
useEffect(() => {
  if (showForm || showPicker || confirmDel) {
    document.body.style.overflow = 'hidden';
  } else {
    document.body.style.overflow = 'unset';
  }

  return () => {
    document.body.style.overflow = 'unset';
  };
}, [showForm, showPicker, confirmDel]);

  /* ── derived ── */
  const plants    = useMemo(() => items.filter(i => i.type === 'plant'), [items]);
  const materials = useMemo(() => items.filter(i => i.type === 'material'), [items]);

  const matSubCounts = useMemo(() => {
    const c = { All: materials.length };
    MAT_SUBTABS.slice(1).forEach(k => { c[k] = materials.filter(i => i.category === k).length; });
    return c;
  }, [materials]);

  const activeItems = useMemo(() => {
    let base = mainTab === 'Plants' ? plants : materials;
    if (mainTab === 'Materials' && matSubTab !== 'All') {
      base = base.filter(i => i.category === matSubTab);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      base = base.filter(i =>
        i.name.toLowerCase().includes(q) ||
        i.sub.toLowerCase().includes(q) ||
        i.supplier.toLowerCase().includes(q)
      );
    }
    return base;
  }, [mainTab, matSubTab, plants, materials, search]);

  const statsPlants = useMemo(() => ({
    total: plants.length,
    low:   plants.filter(i => i.stock < i.min_stock).length,
    val:   plants.filter(i => i.stock >= i.min_stock).reduce((s,i) => s+i.stock*i.unit_cost, 0),
  }), [plants]);

  const statsMats = useMemo(() => ({
    total: materials.length,
    low:   materials.filter(i => i.stock < i.min_stock).length,
    val:   materials.filter(i => i.stock >= i.min_stock).reduce((s,i) => s+i.stock*i.unit_cost, 0),
  }), [materials]);

  /* ── stock adjust ── */
  const adjustStock = async (item, delta) => {
    const val = Math.max(0, item.stock + delta);
    const tbl = item.type === 'plant' ? 'plants_inventory' : 'materials_inventory';
    const { error } = await supabase.from(tbl).update({ quantity_available: val }).eq('id', item.dbId);
        if (error) { alert('Failed to update stock'); return; }
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, stock: val } : i));
  };

  const openEdit = item => {
    setForm({ name:item.name, botanical_name:item.sub||'', category:item.category, unit:item.unit,
      stock:String(item.stock), min_stock:String(item.min_stock), unit_cost:String(item.unit_cost), supplier:item.supplier });
    setEditItem(item);
    setShowForm(true);
  };

  const pickCategory = cat => {
    setForm({ ...EMPTY_FORM, category: cat });
    setShowPicker(false);
    setShowForm(true);
  };

  const closeAll = () => {
    setShowPicker(false); setShowForm(false); setEditItem(null); setForm(EMPTY_FORM);
  };

  const handleSave = async e => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editItem) {
        if (editItem.type === 'plant') {
          const { error } = await supabase.from('plants_inventory').update({
            name:form.name, botanical_name:form.botanical_name, size_height:form.unit,
            quantity_available:Number(form.stock)||0, low_stock_threshold:Number(form.min_stock)||0,
            purchase_rate:Number(form.unit_cost)||0, nursery_source:form.supplier,
          }).eq('id', editItem.dbId);
          if (error) throw error;
        } else {
          let dbCat='Others';
          if(form.category==='Fertilizers')dbCat='Fertilizers';
          else if(form.category==='Irrigation')dbCat='Drip Irrigation Material';
          else if(form.category==='Tools')dbCat='Garden Tools';
          else if(form.category==='Aggregates')dbCat='Pebbles';
          const { error } = await supabase.from('materials_inventory').update({
            item_name: form.name,
            category: dbCat,
            unit: form.unit,
            quantity_available: Number(form.stock)||0,
            low_stock_threshold: Number(form.min_stock)||0,
            purchase_rate: Number(form.unit_cost)||0,
            supplier: form.supplier || 'General Vendor',
          }).eq('id', editItem.dbId);
          if (error) throw error;
        }
        alert('Item updated');
      } else {
        if (form.category === 'Plants') {
          const { error } = await supabase.from('plants_inventory').insert([{
            name:form.name, botanical_name:form.botanical_name||'', category:'Ornamental Plants',
            size_height:form.unit||'Nos', quantity_available:Number(form.stock)||0,
            low_stock_threshold:Number(form.min_stock)||0, nursery_source:form.supplier||'General Nursery',
            purchase_rate:Number(form.unit_cost)||0,
            supplier: form.supplier || 'General Vendor',
          }]);
          if (error) throw error;
        } else {
          let dbCat='Others';
          if(form.category==='Fertilizers')dbCat='Fertilizers';
          else if(form.category==='Irrigation')dbCat='Drip Irrigation Material';
          else if(form.category==='Tools')dbCat='Garden Tools';
          else if(form.category==='Aggregates')dbCat='Pebbles';
          const { error } = await supabase.from('materials_inventory').insert([{
            item_name: form.name,
            category: dbCat,
            unit: form.unit||'Nos',
            quantity_available: Number(form.stock)||0,
            low_stock_threshold: Number(form.min_stock)||0,
            purchase_rate: Number(form.unit_cost)||0,
            supplier: form.supplier || 'General Vendor',
          }]);
          if (error) throw error;
        }
        alert('Item added');
      }
      closeAll();
      fetchInventory();
    } catch(err) {
      alert(err.message || 'Save failed');
    } finally { setSaving(false); }
  };

  const doDelete = async item => {
    try {
      const tbl = item.type==='plant' ? 'plants_inventory' : 'materials_inventory';
      const { error } = await supabase.from(tbl).delete().eq('id', item.dbId);
      if (error) throw error;
      setItems(prev => prev.filter(i => i.id !== item.id));
            alert('Item deleted');
    } catch { alert('Delete failed'); }
    finally { setConfirmDel(null); }
  };

  const exportCSV = () => {
    const rows = [
      ['Name','Sub / Botanical','Category','Unit','Stock','Min Stock','Unit Cost','Total Value','Supplier','Status'],
      ...activeItems.map(i => [
        i.name, i.sub||'', i.category, i.unit, i.stock, i.min_stock,
        i.unit_cost, i.stock*i.unit_cost, i.supplier,
        i.stock < i.min_stock ? 'Low Stock' : 'In Stock',
      ])
    ];
    const csv = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type:'text/csv' }));
    a.download = 'inventory.csv';
    a.click();
  };

  const barPct = item => item.min_stock > 0
    ? Math.min(100, Math.round((item.stock / item.min_stock) * 100))
    : 100;

  const activeStats = mainTab === 'Plants' ? statsPlants : statsMats;

  return (
    <div className="inv-layout">
      <Sidebar/>
      <div className="inv-right">
        <Header title="Inventory"/>

        <main className="inv-main animate-fade">

          {/* ── PAGE HEAD ── */}
          <div className="inv-page-head">
            <div>
              <h1 className="inv-page-title">Inventory</h1>
              <p className="inv-page-sub">Manage stock levels, costs, and low-stock alerts.</p>
            </div>
          </div>

          {/* ── TOOLBAR ──
               View switcher (Plants / Materials) sits on the left,
               page actions (Search / Export / Add Item) sit on the right.
               Keeping them at opposite ends of the row — instead of stacked
               directly on top of each other — is what stops the two groups
               from reading as one cluttered button cluster. */}
          <div className="inv-toolbar-row">
            <div className="inv-main-tabs">
              {MAIN_TABS.map(tab => {
                const st = tab === 'Plants' ? statsPlants : statsMats;
                return (
                  <button
                    key={tab}
                    className={`inv-main-tab ${mainTab === tab ? 'active' : ''}`}
                    onClick={() => { setMainTab(tab); setSearch(''); }}
                  >
                    <span className="imt-icon">
                      {tab === 'Plants' ? <Leaf size={15}/> : <Package size={15}/>}
                    </span>
                    <span className="imt-label">{tab}</span>
                    {st.low > 0 && (
                      <span className="imt-alert"><AlertTriangle size={10}/> {st.low}</span>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="inv-head-right">
              <div className="inv-search-wrap">
                <Search className="inv-search-icon" size={14}/>
                <input className="inv-search-input" type="text"
                  placeholder={`Search ${mainTab.toLowerCase()}…`}
                  value={search} onChange={e => setSearch(e.target.value)}/>
              </div>
              <button className="inv-export-btn" onClick={exportCSV}>
                <Download size={14}/> Export
              </button>
              <button className="inv-add-btn" onClick={() => setShowPicker(true)}>
                <Plus size={14}/> Add Item
              </button>
            </div>
          </div>

          {/* ── STATS ROW ── */}
          <div className="inv-stats-row">
            <div className="inv-stat-card">
              <div className="isc-label">Total Items</div>
              <div className="isc-val">{activeStats.total}</div>
            </div>
            <div className="inv-stat-card">
              <div className="isc-label">Low Stock</div>
              <div className={`isc-val ${activeStats.low > 0 ? 'isc-red' : 'isc-green'}`}>
                {activeStats.low}
              </div>
            </div>
            <div className="inv-stat-card">
              <div className="isc-label">In-Stock Value</div>
              <div className="isc-val isc-green">{fmtVal(activeStats.val)}</div>
            </div>
          </div>

          {/* ── MATERIAL SUB-TABS (only when Materials is active) ── */}
          {mainTab === 'Materials' && (
            <div className="inv-sub-tabs">
              {MAT_SUBTABS.map(sub => (
                <button
                  key={sub}
                  className={`inv-sub-tab ${matSubTab === sub ? 'active' : ''}`}
                  onClick={() => setMatSubTab(sub)}
                >
                  {sub === 'All' ? 'All Materials' : sub}
                  <span className="ist-pill">{matSubCounts[sub] || 0}</span>
                </button>
              ))}
            </div>
          )}

          {/* ── TABLE CARD ── */}
          <div className="inv-table-card">
            {loading ? (
              <div className="inv-loading"><Loader2 className="db-spin" size={22}/> Loading…</div>
            ) : activeItems.length === 0 ? (
              <div className="inv-empty">
                {mainTab === 'Plants' ? <Leaf size={34} style={{opacity:0.15}}/> : <Package size={34} style={{opacity:0.15}}/>}
                <p>{search ? `No results for "${search}"` : `No ${mainTab.toLowerCase()} added yet`}</p>
                <button className="inv-empty-add" onClick={() => setShowPicker(true)}>
                  <Plus size={13}/> Add {mainTab === 'Plants' ? 'a plant' : 'a material'}
                </button>
              </div>
            ) : (
              <div className="inv-table-scroll">
                <table className="inv-table">
                  <thead>
                    <tr>
                      <th>Item</th>
                      {mainTab === 'Materials' && <th>Category</th>}
                      <th>Unit</th>
                      <th>Stock</th>
                      <th>Unit Cost</th>
                      <th>Total Value</th>
                      <th>Supplier</th>
                      <th>Status</th>
                      <th style={{textAlign:'right'}}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeItems.map(item => {
                      const isLow = item.stock < item.min_stock;
                      const pct   = barPct(item);
                      const barC  = isLow ? 'var(--c-red)' : 'var(--c-green)';
                      return (
                        <tr key={item.id} className={isLow ? 'row-low' : ''}>
                          <td>
                            <div className="inv-item-cell">
                              {isLow && <span className="inv-low-dot"/>}
                              <div>
                                <div className="inv-item-name">{item.name}</div>
                                {item.sub && <div className="inv-item-sub">{item.sub}</div>}
                              </div>
                            </div>
                          </td>
                          {mainTab === 'Materials' && (
                            <td>
                              <span className="inv-cat-tag">{item.category}</span>
                            </td>
                          )}
                          <td className="td-muted">{item.unit}</td>
                          <td>
                            <div className="inv-stk-wrap">
                              <div className="inv-stk-ctrl">
                                <button className="inv-stk-btn" onClick={() => adjustStock(item,-1)}>−</button>
                                <span className={`inv-stk-num ${isLow ? 'stk-low' : 'stk-ok'}`}>
                                  {item.stock.toLocaleString('en-IN')}
                                </span>
                                <button className="inv-stk-btn" onClick={() => adjustStock(item,+1)}>+</button>
                              </div>
                              <div className="inv-mini-track">
                                <div className="inv-mini-fill" style={{width:`${pct}%`,background:barC}}/>
                              </div>
                              <div className="inv-mini-lbl">min {item.min_stock}</div>
                            </div>
                          </td>
                          <td>{fmtINR(item.unit_cost)}</td>
                          <td className="td-bold">{fmtINR(item.stock * item.unit_cost)}</td>
                          <td className="td-muted">{item.supplier}</td>
                          <td>
                            <span className={`inv-badge ${isLow ? 'badge-low' : 'badge-ok'}`}>
                              {isLow ? 'Low Stock' : 'In Stock'}
                            </span>
                          </td>
                          <td>
                            <div className="inv-actions">
                              <button className="inv-icon-btn" title="Edit" onClick={() => openEdit(item)}>
                                <Edit2 size={13}/>
                              </button>
                              <button className="inv-icon-btn del" title="Delete" onClick={() => setConfirmDel(item)}>
                                <Trash2 size={13}/>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ── MOBILE CARDS ── */}
          <div className="inv-mobile-cards">
            {loading ? (
              <div className="inv-loading"><Loader2 className="db-spin" size={20}/> Loading…</div>
            ) : activeItems.length === 0 ? (
              <div className="inv-empty">
                <Package size={30} style={{opacity:0.15}}/>
                <p>{search ? `No results for "${search}"` : `No ${mainTab.toLowerCase()} added yet`}</p>
                <button className="inv-empty-add" onClick={() => setShowPicker(true)}>
                  <Plus size={13}/> Add {mainTab === 'Plants' ? 'a plant' : 'a material'}
                </button>
              </div>
            ) : activeItems.map(item => {
              const isLow = item.stock < item.min_stock;
              const pct   = barPct(item);
              const barC  = isLow ? 'var(--c-red)' : 'var(--c-green)';
              return (
                <div key={item.id} className={`inv-mcard ${isLow ? 'mcard-low' : ''}`}>
                  <div className="mcard-top">
                    <div className="mcard-title-row">
                      {isLow && <span className="inv-low-dot"/>}
                      <span className="mcard-name">{item.name}</span>
                    </div>
                    {item.sub && <div className="mcard-sub">{item.sub}</div>}
                    {mainTab === 'Materials' && (
                      <span className="inv-cat-tag" style={{marginTop:'4px',display:'inline-flex'}}>{item.category}</span>
                    )}
                  </div>
                  <div className="mcard-stk-row">
                    <div className="inv-stk-ctrl">
                      <button className="inv-stk-btn" onClick={() => adjustStock(item,-1)}>−</button>
                      <span className={`inv-stk-num ${isLow ? 'stk-low' : 'stk-ok'}`}>{item.stock}</span>
                      <button className="inv-stk-btn" onClick={() => adjustStock(item,+1)}>+</button>
                    </div>
                    <div className="mcard-track"><div className="mcard-fill" style={{width:`${pct}%`,background:barC}}/></div>
                    <span className="inv-mini-lbl" style={{flexShrink:0}}>min {item.min_stock}</span>
                  </div>
                  <div className="mcard-grid">
                    <div><div className="mcard-lbl">Unit</div><div className="mcard-val">{item.unit}</div></div>
                    <div><div className="mcard-lbl">Unit Cost</div><div className="mcard-val">{fmtINR(item.unit_cost)}</div></div>
                    <div><div className="mcard-lbl">Total Value</div><div className="mcard-val td-bold">{fmtINR(item.stock*item.unit_cost)}</div></div>
                    <div><div className="mcard-lbl">Supplier</div><div className="mcard-val td-muted">{item.supplier}</div></div>
                  </div>
                  <div className="mcard-footer">
                    <span className={`inv-badge ${isLow ? 'badge-low' : 'badge-ok'}`}>
                      {isLow ? 'Low Stock' : 'In Stock'}
                    </span>
                    <div className="inv-actions">
                      <button className="inv-icon-btn" onClick={() => openEdit(item)}><Edit2 size={13}/></button>
                      <button className="inv-icon-btn del" onClick={() => setConfirmDel(item)}><Trash2 size={13}/></button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

        </main>
      </div>

      {/* ════ CATEGORY PICKER ════ */}
      {showPicker && (
        <div className="inv-overlay" onClick={e => e.target===e.currentTarget && closeAll()}>
          <div className="inv-modal inv-modal-sm">
            <div className="inv-modal-head">
              <span className="inv-modal-title">Select Category</span>
              <button className="inv-modal-close" onClick={closeAll}>&times;</button>
            </div>
            <div className="inv-picker-list">
              {ALL_ADD_CATS.map(cat => {
          let meta;
  if (cat === 'Plants') {
    meta = { icon: <Leaf size={14}/>, desc: 'Trees, shrubs, ground covers' };
  } else if (cat === 'Materials') {
    meta = { icon: <Package size={14}/>, desc: 'Fertilizers, tools, irrigation & more' };
  }
  
  return (
    <button key={cat} className="inv-picker-row" onClick={() => pickCategory(cat)}>
      <span className="inv-picker-ico">{meta?.icon}</span>
      <div>
        <div className="inv-picker-name">{cat}</div>
        <div className="inv-picker-desc">{meta?.desc}</div>
      </div>
      <span className="inv-picker-arr">›</span>
    </button>
  );
})}
            </div>
          </div>
        </div>
      )}

      {/* ════ ADD / EDIT FORM ════ */}
      {showForm && (
        <div className="inv-overlay" onClick={e => e.target===e.currentTarget && closeAll()}>
          <div className="inv-modal">
            <div className="inv-modal-head">
              <span className="inv-modal-title">
                {editItem ? `Edit — ${editItem.name}` : `Add ${form.category}`}
              </span>
              <button className="inv-modal-close" onClick={closeAll}>&times;</button>
            </div>
            <form onSubmit={handleSave} style={{display:'contents'}}>
              <div className="inv-modal-body">
                <div className="inv-form-sec">Basic Info</div>
                <div className="inv-form-grid">
                  <div className="inv-fg inv-full">
                    <label>Item Name *</label>
                    <input type="text" required
                      placeholder={form.category==='Plants' ? 'e.g. Areca Palm' : 'e.g. NPK 19-19-19'}
                      value={form.name} onChange={e => setForm({...form,name:e.target.value})}/>
                  </div>
                  {form.category==='Plants' && (
                    <div className="inv-fg inv-full">
                      <label>Botanical Name</label>
                      <input type="text" placeholder="e.g. Dypsis lutescens"
                        value={form.botanical_name} onChange={e => setForm({...form,botanical_name:e.target.value})}/>
                    </div>
                  )}
                                    <div className="inv-fg">
                    <label>{form.category==='Plants' ? 'Height / Size *' : 'Unit *'}</label>
                    <input type="text" required
                      placeholder={form.category==='Plants' ? 'e.g. 5–6 ft bag' : 'e.g. Nos / Bags / Ltrs'}
                      value={form.unit} onChange={e => setForm({...form,unit:e.target.value})}/>
                  </div>

                  {/* Category Dropdown - Only for Materials */}
                  {form.category !== 'Plants' && (
                    <div className="inv-fg">
                      <label>Category *</label>
                      <select 
                        required 
                        value={form.category} 
                        onChange={e => setForm({...form, category: e.target.value})}
                        style={{padding:'0.6rem 0.85rem', borderRadius:'8px', border:'1px solid var(--c-border)'}}
                      >
                        <option value="">Select Material Category</option>
                        <option value="Fertilizers">Fertilizers</option>
                        <option value="Irrigation">Irrigation</option>
                        <option value="Tools">Tools</option>
                        <option value="Aggregates">Aggregates</option>
                        <option value="Others">Others</option>
                      </select>
                    </div>
                  )}

                  <div className="inv-fg">
                    <label>Supplier</label>
                    <input type="text"
                      placeholder="e.g. General Vendor / Company Name"
                      value={form.supplier} 
                      onChange={e => setForm({...form, supplier: e.target.value})}/>
                  </div>
                </div>
                <div className="inv-form-sec">Stock & Pricing</div>
                <div className="inv-form-grid">
                  <div className="inv-fg">
                    <label>Current Stock *</label>
                    <input type="number" required min="0" placeholder="0"
                      value={form.stock} onChange={e => setForm({...form,stock:e.target.value})}/>
                  </div>
                  <div className="inv-fg">
                    <label>Minimum Stock *</label>
                    <input type="number" required min="0" placeholder="0"
                      value={form.min_stock} onChange={e => setForm({...form,min_stock:e.target.value})}/>
                  </div>
                  <div className="inv-fg">
                    <label>Unit Cost (₹) *</label>
                    <input type="number" required min="0" placeholder="0"
                      value={form.unit_cost} onChange={e => setForm({...form,unit_cost:e.target.value})}/>
                  </div>
                  <div className="inv-fg">
                    <label>Est. Stock Value</label>
                    <input type="text" readOnly
                      value={(form.stock&&form.unit_cost)
                        ?`₹${(Number(form.stock)*Number(form.unit_cost)).toLocaleString('en-IN')}`:'—'}/>
                  </div>
                </div>
              </div>
              <div className="inv-modal-foot">
                <button type="button" className="btn-secondary" onClick={closeAll}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? <Loader2 size={14} className="db-spin"/> : <CheckCircle2 size={14}/>}
                  {editItem ? 'Save Changes' : 'Add Item'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ════ CONFIRM DELETE ════ */}
      {confirmDel && (
        <div className="inv-overlay" onClick={e => e.target===e.currentTarget && setConfirmDel(null)}>
          <div className="inv-modal inv-modal-sm">
            <div className="inv-modal-head">
              <span className="inv-modal-title">Confirm Delete</span>
              <button className="inv-modal-close" onClick={() => setConfirmDel(null)}>&times;</button>
            </div>
            <div className="inv-confirm-body">
              <div className="inv-confirm-ico"><Trash2 size={20}/></div>
              <div className="inv-confirm-title">Delete "{confirmDel.name}"?</div>
            </div>
            <div className="inv-modal-foot">
              <button className="btn-secondary" onClick={() => setConfirmDel(null)}>Cancel</button>
              <button className="inv-btn-danger" onClick={() => doDelete(confirmDel)}>
                <Trash2 size={13}/> Delete
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}