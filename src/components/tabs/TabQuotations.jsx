import { useState, useEffect } from 'react';
import { QUOTATION_TEMPLATES } from '../../utils/templates';
import { calculateGST, formatCurrency } from '../../utils/helpers';
import { Printer, Save, Loader2 } from 'lucide-react';
import { supabase } from '../../supabase';

export default function TabQuotations({ project }) {
  const defaultTpl = QUOTATION_TEMPLATES['Landscape Consultancy'];
  const [selectedTpl,          setSelectedTpl]          = useState('Landscape Consultancy');
  const [scope,                setScope]                = useState(defaultTpl?.scope || '');
  const [designFees,           setDesignFees]           = useState(defaultTpl?.fees || 0);
  const [visitCharges,         setVisitCharges]         = useState(defaultTpl?.visitCharges || 0);
  const [consultancyCharges,   setConsultancyCharges]   = useState(defaultTpl?.consultancyCharges || 0);
  const [gstPercent,           setGstPercent]           = useState(18);
  const [paymentTerms,         setPaymentTerms]         = useState(defaultTpl?.paymentTerms || '');
  const [isSaving,             setIsSaving]             = useState(false);
  const [quotations,           setQuotations]           = useState([]);
  const [loading,              setLoading]              = useState(true);

  useEffect(() => { fetchQuotations(); }, [project.id]);

  const fetchQuotations = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('quotations')
        .select('*').eq('project_id', project.id).order('created_at', { ascending: false });
      if (error) throw error;
      setQuotations(data || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const changeTpl = (name) => {
    setSelectedTpl(name);
    const tpl = QUOTATION_TEMPLATES[name];
    if (tpl) { setScope(tpl.scope); setDesignFees(tpl.fees); setVisitCharges(tpl.visitCharges); setConsultancyCharges(tpl.consultancyCharges); setPaymentTerms(tpl.paymentTerms); }
  };

  const subTotal = Number(designFees) + Number(visitCharges) + Number(consultancyCharges);
  const gst      = calculateGST(subTotal, gstPercent);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const qNum = `QT-${project.name.slice(0,3).toUpperCase()}-${Date.now().toString().slice(-4)}`;
      const { error } = await supabase.from('quotations').insert([{
        project_id:    project.id,
        quotation_number: qNum,
        client_name:   project.client_name,
        amount:        gst.base,
        gst_percent:   gstPercent,
        gst_amount:    gst.gstAmount,
        total_amount:  gst.total,
        scope_of_work: scope,
        status:        'Pending'
      }]);
      if (error) throw error;
      fetchQuotations();
    } catch (err) { alert(err.message); }
    finally { setIsSaving(false); }
  };

  const updateStatus = async (id, status) => {
    try {
      const { error } = await supabase.from('quotations').update({ status }).eq('id', id);
      if (error) throw error;
      fetchQuotations();
    } catch (err) { console.error(err); }
  };

  return (
    <div className="animate-fade">
      <div className="tab-page-head">
        <div>
          <h2 className="tab-page-title">Quotation Generator</h2>
          <p className="tab-page-sub">Generate client estimates using templates and save to project.</p>
        </div>
      </div>

      <div className="tab-split-300" style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '1.25rem', marginBottom: '1.5rem' }}>

        {/* Config panel */}
        <div className="tab-card" style={{ height: 'fit-content' }}>
          <div className="tab-card-head"><span className="tab-card-title">Configuration</span></div>
          <div className="tab-card-body" style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
            <div className="form-group">
              <label>Template</label>
              <select value={selectedTpl} onChange={e => changeTpl(e.target.value)} className="input-field">
                {Object.keys(QUOTATION_TEMPLATES).map(k => <option key={k}>{k}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Scope of Work</label>
              <textarea rows={3} value={scope} onChange={e => setScope(e.target.value)} className="input-field" style={{ resize: 'none', fontSize: '0.82rem' }} />
            </div>
            <div className="tab-split-half" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div className="form-group">
                <label>Design Fees</label>
                <input type="number" value={designFees} onChange={e => setDesignFees(Number(e.target.value))} className="input-field" />
              </div>
              <div className="form-group">
                <label>Visit Fees</label>
                <input type="number" value={visitCharges} onChange={e => setVisitCharges(Number(e.target.value))} className="input-field" />
              </div>
              <div className="form-group">
                <label>Consultancy</label>
                <input type="number" value={consultancyCharges} onChange={e => setConsultancyCharges(Number(e.target.value))} className="input-field" />
              </div>
              <div className="form-group">
                <label>GST %</label>
                <input type="number" value={gstPercent} onChange={e => setGstPercent(Number(e.target.value))} className="input-field" />
              </div>
            </div>
            <div className="form-group">
              <label>Payment Terms</label>
              <input type="text" value={paymentTerms} onChange={e => setPaymentTerms(e.target.value)} className="input-field" />
            </div>
            <button className="btn-primary" style={{ justifyContent: 'center' }} onClick={handleSave} disabled={isSaving}>
              <Save size={14} /> {isSaving ? 'Saving...' : 'Save Quotation'}
            </button>
          </div>
        </div>

        {/* Preview */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button className="btn-secondary" onClick={() => window.print()}>
              <Printer size={14} /> Print PDF
            </button>
          </div>
          <div className="document-preview-box">
            <div className="document-preview-title">Project Estimation Quotation</div>
            <div style={{ fontSize: '0.88rem', marginBottom: '1rem', fontFamily: 'Inter, sans-serif' }}>
              <p><strong>Category:</strong> {selectedTpl}</p>
              <p><strong>Client:</strong> {project.client_name}</p>
              <p><strong>Date:</strong> {new Date().toLocaleDateString('en-IN')}</p>
            </div>
            <div style={{ fontSize: '0.88rem', marginBottom: '1rem', fontFamily: 'Inter, sans-serif' }}>
              <strong>Scope:</strong>
              <p style={{ marginTop: '4px', lineHeight: 1.5 }}>{scope}</p>
            </div>
            <div style={{ borderTop: '1px solid #ddd', borderBottom: '1px solid #ddd', padding: '0.75rem 0', margin: '1rem 0', fontSize: '0.85rem', fontFamily: 'Inter, sans-serif', display: 'flex', flexDirection: 'column', gap: '5px' }}>
              {[['Design Fees', designFees], ['Visit Charges', visitCharges], ['Consultancy', consultancyCharges]].map(([l, v]) => (
                <div key={l} style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>{l}</span><strong>{formatCurrency(v)}</strong>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed #eee', paddingTop: '5px', marginTop: '4px' }}>
                <span>GST ({gstPercent}%)</span><strong>{formatCurrency(gst.gstAmount)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: '1rem', borderTop: '1px solid #ddd', paddingTop: '6px', marginTop: '4px', color: '#0b3d27' }}>
                <span>Total</span><span>{formatCurrency(gst.total)}</span>
              </div>
            </div>
            <div style={{ fontSize: '0.82rem', fontFamily: 'Inter, sans-serif' }}>
              <strong>Payment Terms:</strong> {paymentTerms}
            </div>
            <div className="document-signature-block" style={{ marginTop: '2rem' }}>
              <div style={{ borderTop: '1px solid #333', width: '160px', textAlign: 'center', paddingTop: '6px', fontSize: '0.8rem' }}>Client Signature</div>
              <div style={{ borderTop: '1px solid #333', width: '160px', textAlign: 'center', paddingTop: '6px', fontSize: '0.8rem' }}>Consultant</div>
            </div>
          </div>
        </div>
      </div>

      {/* History */}
      <div className="tab-card">
        <div className="tab-card-head"><span className="tab-card-title">Quotation History</span></div>
        <div className="tab-card-body">
          {loading ? (
            <div className="tab-empty" style={{ padding: '1.5rem' }}><Loader2 size={16} className="db-spin" style={{ color: '#10b981' }} /></div>
          ) : quotations.length === 0 ? (
            <div className="tab-empty" style={{ padding: '1rem' }}>No quotations saved yet.</div>
          ) : (
            <div className="tab-table-wrap">
              <table className="tab-table">
                <thead>
                  <tr><th>Quote No.</th><th>Total</th><th>Scope</th><th>Status</th><th>Date</th></tr>
                </thead>
                <tbody>
                  {quotations.map(q => (
                    <tr key={q.id}>
                      <td style={{ fontWeight: 700, fontSize: '0.82rem', color: '#0b3d27' }}>{q.quotation_number}</td>
                      <td style={{ fontWeight: 700 }}>{formatCurrency(q.total_amount)}</td>
                      <td style={{ color: '#64748b', fontSize: '0.78rem', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{q.scope_of_work}</td>
                      <td>
                        <select value={q.status} onChange={e => updateStatus(q.id, e.target.value)}
                          style={{ fontSize: '0.75rem', padding: '3px 6px', border: '1px solid #e2e8f0', borderRadius: '6px', background: 'white', outline: 'none' }}>
                          {['Pending','Approved','Rejected','Converted'].map(s => <option key={s}>{s}</option>)}
                        </select>
                      </td>
                      <td style={{ color: '#64748b', fontSize: '0.8rem' }}>{new Date(q.created_at).toLocaleDateString('en-IN')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}