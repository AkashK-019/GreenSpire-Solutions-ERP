import { useState, useEffect } from 'react';
import { FileText, Download, Eye, Plus, Folder, Loader2, Trash2 } from 'lucide-react';
import { supabase } from '../../supabase';

const CATEGORIES = ['All','Agreements','Contracts','Quotations','BOQ','Invoices','Purchase Orders','Site Instructions','Contractor Bills','Approval Letters'];

export default function TabDocuments({ project }) {
  const [loading,  setLoading]  = useState(true);
  const [docs,     setDocs]     = useState([]);
  const [filter,   setFilter]   = useState('All');
  const [showModal, setShowModal] = useState(false);
  const [newDoc, setNewDoc] = useState({ name: '', category: 'Agreements', file: '' });

  useEffect(() => { fetchDocs(); }, [project.id]);

  const fetchDocs = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('documents')
        .select('*').eq('project_id', project.id).order('created_at', { ascending: false });
      if (error) throw error;
      setDocs(data || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this document?')) return;
    try {
      const { error } = await supabase.from('documents').delete().eq('id', id);
      if (error) throw error;
      fetchDocs();
    } catch (err) { alert(err.message); }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    try {
      const { error } = await supabase.from('documents').insert([{
        project_id: project.id,
        name:       newDoc.name,
        category:   newDoc.category,
        file_url:   newDoc.file || 'document.pdf'
      }]);
      if (error) throw error;
      setShowModal(false);
      setNewDoc({ name: '', category: 'Agreements', file: '' });
      fetchDocs();
    } catch (err) { alert(err.message); }
  };

  const filtered = filter === 'All' ? docs : docs.filter(d => d.category === filter);

  return (
    <div className="animate-fade">
      <div className="tab-page-head">
        <div>
          <h2 className="tab-page-title">Document Repository</h2>
          <p className="tab-page-sub">Store contracts, invoices, purchase orders and project files.</p>
        </div>
        <button className="pj-add-btn" onClick={() => setShowModal(true)}>
          <Plus size={15} /> Upload Document
        </button>
      </div>

      <div className="tab-split-180" style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: '1.25rem' }}>

        {/* Folder sidebar */}
        <div style={{ background: '#f8fafc', border: '1px solid #e9eef3', borderRadius: '10px', padding: '0.6rem', height: 'fit-content' }}>
          <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '0.25rem 0.5rem 0.6rem' }}>Folders</div>
          {CATEGORIES.map(cat => (
            <button key={cat} onClick={() => setFilter(cat)}
              style={{ display: 'flex', alignItems: 'center', gap: '7px', width: '100%', padding: '0.5rem 0.6rem', border: 'none', borderRadius: '7px', background: filter === cat ? '#ecfdf5' : 'transparent', color: filter === cat ? '#065f46' : '#64748b', fontWeight: filter === cat ? 700 : 400, fontSize: '0.8rem', cursor: 'pointer', textAlign: 'left', fontFamily: 'Inter, sans-serif' }}>
              <Folder size={13} style={{ color: filter === cat ? '#10b981' : '#94a3b8' }} />
              {cat}
            </button>
          ))}
        </div>

        {/* Document table */}
        <div>
          <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#0b3d27', marginBottom: '0.75rem' }}>{filter}</div>
          {loading ? (
            <div className="tab-empty"><Loader2 size={18} className="db-spin" style={{ color: '#10b981' }} /></div>
          ) : filtered.length === 0 ? (
            <div className="tab-empty">No documents in this folder.</div>
          ) : (
            <div className="tab-table-wrap">
              <table className="tab-table">
                <thead>
                  <tr>
                    <th>File Name</th>
                    <th>Category</th>
                    <th>Date</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(doc => (
                    <tr key={doc.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}>
                          <FileText size={14} style={{ color: '#10b981', flexShrink: 0 }} />
                          {doc.name}
                        </div>
                      </td>
                      <td><span className="tab-badge tab-badge-gray">{doc.category}</span></td>
                      <td style={{ color: '#64748b', fontSize: '0.8rem' }}>{new Date(doc.created_at).toLocaleDateString('en-IN')}</td>
                      <td>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <button className="tab-icon-btn" title="View"><Eye size={13} /></button>
                          <button className="tab-icon-btn" title="Download"><Download size={13} /></button>
                          <button className="tab-icon-btn danger" onClick={() => handleDelete(doc.id)} title="Delete"><Trash2 size={13} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <div className="tab-modal-overlay">
          <div className="tab-modal">
            <div className="tab-modal-head">
              <span className="tab-modal-title">Upload Document</span>
              <button className="tab-modal-close" onClick={() => setShowModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleUpload}>
              <div className="tab-modal-body">
                <div className="form-group">
                  <label>Document Name</label>
                  <input type="text" required value={newDoc.name}
                    onChange={e => setNewDoc({...newDoc, name: e.target.value})}
                    className="input-field" placeholder="e.g. Signed_Contract.pdf" />
                </div>
                <div className="form-group">
                  <label>Folder</label>
                  <select value={newDoc.category} onChange={e => setNewDoc({...newDoc, category: e.target.value})} className="input-field">
                    {CATEGORIES.slice(1).map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Select File</label>
                  <input type="file" required
                    onChange={e => {
                      const file = e.target.files[0];
                      if (file) setNewDoc(prev => ({ ...prev, file: file.name, name: prev.name || file.name.replace(/\.[^/.]+$/, '') }));
                    }}
                    style={{ width: '100%', padding: '0.4rem', border: '1px dashed #e2e8f0', borderRadius: '8px', fontSize: '0.82rem' }} />
                </div>
              </div>
              <div className="tab-modal-foot">
                <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn-primary">Save Document</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}