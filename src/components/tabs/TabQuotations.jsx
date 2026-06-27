import { useState, useEffect, useRef } from 'react';
import { QUOTATION_TEMPLATES } from '../../utils/templates';
import { formatCurrency } from '../../utils/helpers';
import { 
  Printer, Save, Loader2, Plus, Share2, Mail, Check,
  FileDown, MessageCircle, Pencil, Trash2, X, FileText,
  MapPin, CheckCircle
} from 'lucide-react';
import { supabase } from '../../supabase';
import '../../styles/quotations.css';

/* ── Constants ─────────────────────────────────────────── */
const UNITS          = ['Nos', 'Sqft', 'Rft', 'Bags', 'Hours', 'Days', 'Lump Sum', 'Kg', 'Litre'];
const GST_OPTIONS    = [0, 5, 12, 18, 28];

const STATUS_CONFIG = {
  Pending:  { color: '#f59e0b', bg: '#fffbeb' },
  Approved: { color: '#10b981', bg: '#ecfdf5' },
  Rejected: { color: '#ef4444', bg: '#fef2f2' },
};

const blankItem = () => ({
  id:       Date.now() + Math.random(),
  name:     '',
  desc:     '',
  qty:      1,
  unit:     'Nos',
  rate:     '',
  hasGst:   true,
  gstPct:   18,
});

/* ── Helpers ────────────────────────────────────────────── */
const fmtINR = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const calcItemAmount = (item) => {
  const amount = (Number(item.qty) || 0) * (Number(item.rate) || 0);
  const gst    = item.hasGst ? parseFloat(((amount * Number(item.gstPct)) / 100).toFixed(2)) : 0;
  return { amount, gst, total: parseFloat((amount + gst).toFixed(2)) };
};

const calcTotals = (items) => {
  let subtotal = 0, totalGst = 0;
  items.forEach(it => {
    const { amount, gst } = calcItemAmount(it);
    subtotal  += amount;
    totalGst  += gst;
  });
  return {
    subtotal:    parseFloat(subtotal.toFixed(2)),
    totalGst:    parseFloat(totalGst.toFixed(2)),
    grandTotal:  parseFloat((subtotal + totalGst).toFixed(2)),
  };
};

/* ═══════════════════════════════════════════════════════════
   COMPONENT
═══════════════════════════════════════════════════════════ */
export default function TabQuotations({ project }) {
  const [loading, setLoading]       = useState(true);
  const [quotations, setQuotations] = useState([]);
  const [showModal, setShowModal]   = useState(false);
  const [editingId, setEditingId]   = useState(null);
  
  const BLANK_FORM = {
    quotation_number: '',
    client_name:      project?.client_name || '',
    client_email:     project?.client_email || '',
    client_phone:     project?.client_phone || '',
    project_type:     project?.type || 'Residential',
    site_address:     project?.site_address || '',
    scope_of_work:    '',
    validity_days:    '30',
    quotation_date:   new Date().toISOString().split('T')[0],
    notes:            '',
  };

  const [form, setForm]             = useState(BLANK_FORM);
  const [items, setItems]           = useState([blankItem()]);
  const [selectedTpl, setSelectedTpl] = useState('');
  const [shareOpen, setShareOpen]   = useState(null);
  const [isSaving, setIsSaving]     = useState(false);
  const shareRef                    = useRef(null);

  /* ── Close share dropdown on outside click ── */
  useEffect(() => {
    const handler = (e) => {
      if (shareRef.current && !shareRef.current.contains(e.target)) setShareOpen(null);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  /* ── Fetch project-specific quotations ── */
  useEffect(() => {
    fetchQuotations();
  }, [project.id]);

  const fetchQuotations = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('quotations')
        .select('*')
        .eq('project_id', project.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setQuotations(data || []);
    } catch (err) {
      console.error('Error fetching quotations:', err);
    } finally {
      setLoading(false);
    }
  };

  /* ── Auto quotation number ── */
  const genQuotationNumber = () => {
    const now   = new Date();
    const yyMM  = `${String(now.getFullYear()).slice(-2)}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const prefix = project?.name?.slice(0, 3).toUpperCase() || 'QT';
    const rand  = String(Math.floor(Math.random() * 900) + 100);
    return `${prefix}-${yyMM}-${rand}`;
  };

  /* ── Form helpers ── */
  const f = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  /* ── Item helpers ── */
  const addItem = () => setItems(prev => [...prev, blankItem()]);

  const removeItem = (id) => setItems(prev => prev.filter(it => it.id !== id));

  const updateItem = (id, field, value) =>
    setItems(prev => prev.map(it => it.id === id ? { ...it, [field]: value } : it));

  /* ── Populate from templates ── */
  const changeTpl = (tplName) => {
    setSelectedTpl(tplName);
    const tpl = QUOTATION_TEMPLATES[tplName];
    if (tpl) {
      f('scope_of_work', tpl.scope);
      f('notes', tpl.paymentTerms || '');
      
      const newItems = [];
      if (tpl.fees) {
        newItems.push({
          id: Date.now() + Math.random(),
          name: 'Design Fees',
          desc: 'Landscape zoning, layouts and drawings',
          qty: 1,
          unit: 'Nos',
          rate: tpl.fees,
          hasGst: true,
          gstPct: 18,
        });
      }
      if (tpl.visitCharges) {
        newItems.push({
          id: Date.now() + Math.random() + 1,
          name: 'Visit Charges',
          desc: 'Site visits and consultation',
          qty: 1,
          unit: 'Nos',
          rate: tpl.visitCharges,
          hasGst: true,
          gstPct: 18,
        });
      }
      if (tpl.consultancyCharges) {
        newItems.push({
          id: Date.now() + Math.random() + 2,
          name: 'Consultancy Charges',
          desc: 'Plant selection, project coordination',
          qty: 1,
          unit: 'Nos',
          rate: tpl.consultancyCharges,
          hasGst: true,
          gstPct: 18,
        });
      }
      setItems(newItems.length > 0 ? newItems : [blankItem()]);
    }
  };

  const openAddModal = () => {
    setForm({
      ...BLANK_FORM,
      quotation_number: genQuotationNumber(),
      client_name:      project?.client_name || '',
      client_email:     project?.client_email || '',
      client_phone:     project?.client_phone || '',
      project_type:     project?.type || 'Residential',
      site_address:     project?.site_address || '',
    });
    setItems([blankItem()]);
    setSelectedTpl('');
    setEditingId(null);
    setShowModal(true);
  };

  const openEditModal = (q) => {
    setForm({
      quotation_number: q.quotation_number || '',
      client_name:      q.client_name      || '',
      client_email:     q.client_email     || '',
      client_phone:     q.client_phone     || '',
      project_type:     q.project_type     || 'Residential',
      site_address:     q.site_address     || '',
      scope_of_work:    q.scope_of_work    || '',
      validity_days:    q.validity_days    ?? '30',
      quotation_date:   q.quotation_date   || new Date().toISOString().split('T')[0],
      notes:            q.notes            || '',
    });
    try {
      const saved = q.line_items ? JSON.parse(q.line_items) : null;
      setItems(saved && saved.length > 0 ? saved.map(i => ({ ...i, id: Date.now() + Math.random() })) : [blankItem()]);
    } catch {
      setItems([blankItem()]);
    }
    setEditingId(q.id);
    setSelectedTpl('');
    setShowModal(true);
  };

  const closeModal = () => { 
    setShowModal(false); 
    setEditingId(null); 
    setForm(BLANK_FORM); 
    setItems([blankItem()]); 
    setSelectedTpl('');
  };

  /* ── Live totals ── */
  const totals = calcTotals(items);

  /* ── Save ── */
  const handleSave = async (e) => {
    e.preventDefault();
    setIsSaving(true);

    const { subtotal, totalGst, grandTotal } = totals;

    const payload = {
      project_id:       project.id,
      quotation_number: form.quotation_number,
      client_name:      form.client_name,
      client_email:     form.client_email  || null,
      client_phone:     form.client_phone  || null,
      project_type:     form.project_type,
      site_address:     form.site_address  || null,
      scope_of_work:    form.scope_of_work || null,
      amount:           subtotal,
      gst_percent:      items.some(i => i.hasGst) ? (items.find(i => i.hasGst)?.gstPct || 0) : 0,
      gst_amount:       totalGst,
      total_amount:     grandTotal,
      validity_days:    Number(form.validity_days) || 30,
      quotation_date:   form.quotation_date || null,
      notes:            form.notes || null,
      line_items:       JSON.stringify(items),
    };

    try {
      if (editingId) {
        const { error } = await supabase.from('quotations').update(payload).eq('id', editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('quotations').insert([{ ...payload, status: 'Pending' }]);
        if (error) throw error;
      }
      closeModal();
      fetchQuotations();
    } catch (err) {
      alert(err.message || 'Failed to save quotation');
    } finally {
      setIsSaving(false);
    }
  };

  /* ── Delete ── */
  const handleDelete = async (id) => {
    if (!window.confirm('Delete this quotation permanently?')) return;
    try {
      const { error } = await supabase.from('quotations').delete().eq('id', id);
      if (error) throw error;
      fetchQuotations();
    } catch (err) {
      alert('Failed to delete: ' + err.message);
    }
  };

  /* ── Print / PDF ── */
  const getPrintItems = (q) => {
    try {
      if (q.line_items) return JSON.parse(q.line_items);
    } catch {}
    return null;
  };

  const handlePrint = (q) => {
    setShareOpen(null);
    const lineItems = getPrintItems(q);
    const { subtotal, totalGst, grandTotal } = lineItems
      ? calcTotals(lineItems)
      : { subtotal: Number(q.amount || 0), totalGst: Number(q.gst_amount || 0), grandTotal: Number(q.total_amount || 0) };

    const validUntil = q.quotation_date
      ? new Date(new Date(q.quotation_date).getTime() + (q.validity_days || 30) * 86400000)
          .toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
      : '—';

    const itemRows = lineItems
      ? lineItems.map((it, i) => {
          const { amount, gst, total } = calcItemAmount(it);
          return `
            <tr>
              <td>${i + 1}</td>
              <td><strong>${it.name || '—'}</strong>${it.desc ? `<br/><span style="color:#64748b;font-size:8pt">${it.desc}</span>` : ''}</td>
              <td style="text-align:center">${it.qty}</td>
              <td style="text-align:center">${it.unit}</td>
              <td style="text-align:right">₹${Number(it.rate || 0).toLocaleString('en-IN')}</td>
              <td style="text-align:center">${it.hasGst ? `${it.gstPct}%` : 'NIL'}</td>
              <td style="text-align:right">₹${gst.toLocaleString('en-IN')}</td>
              <td style="text-align:right;font-weight:700">₹${total.toLocaleString('en-IN')}</td>
            </tr>`;
        }).join('')
      : `<tr>
          <td>1</td>
          <td><strong>Service</strong></td>
          <td style="text-align:center">1</td>
          <td style="text-align:center">Lump Sum</td>
          <td style="text-align:right">₹${Number(q.amount || 0).toLocaleString('en-IN')}</td>
          <td style="text-align:center">${q.gst_percent || 18}%</td>
          <td style="text-align:right">₹${Number(q.gst_amount || 0).toLocaleString('en-IN')}</td>
          <td style="text-align:right;font-weight:700">₹${Number(q.total_amount || 0).toLocaleString('en-IN')}</td>
        </tr>`;

    let root = document.getElementById('qt-print-root');
    if (!root) { root = document.createElement('div'); root.id = 'qt-print-root'; document.body.appendChild(root); }

    root.innerHTML = `
      <div class="qt-print-doc">
        <div class="qtp-header">
          <div>
            <div class="qtp-brand">Green<span>Spire</span></div>
            <div class="qtp-tagline">Landscaping &amp; Greenery Solutions</div>
          </div>
          <div class="qtp-header-right">
            <div class="qtp-doc-title">QUOTATION</div>
            <div class="qtp-doc-num">${q.quotation_number || '—'}</div>
          </div>
        </div>

        <div class="qtp-meta">
          <div class="qtp-meta-block">
            <span class="qtp-meta-label">Date</span>
            <span class="qtp-meta-value">${q.quotation_date ? new Date(q.quotation_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</span>
          </div>
          <div class="qtp-meta-block">
            <span class="qtp-meta-label">Valid Until</span>
            <span class="qtp-meta-value">${validUntil}</span>
          </div>
          <div class="qtp-meta-block">
            <span class="qtp-meta-label">Project Type</span>
            <span class="qtp-meta-value">${q.project_type || '—'}</span>
          </div>
          <div class="qtp-meta-block">
            <span class="qtp-meta-label">Status</span>
            <span class="qtp-meta-value">${q.status || 'Pending'}</span>
          </div>
        </div>

        <div class="qtp-details-row">
          <div class="qtp-details-block">
            <div class="qtp-details-head">Prepared For</div>
            <div class="qtp-detail-line"><strong>${q.client_name || '—'}</strong></div>
            ${q.client_email ? `<div class="qtp-detail-line">${q.client_email}</div>` : ''}
            ${q.client_phone ? `<div class="qtp-detail-line">${q.client_phone}</div>` : ''}
            ${q.site_address ? `<div class="qtp-detail-line">${q.site_address}</div>` : ''}
          </div>
          <div class="qtp-details-block">
            <div class="qtp-details-head">Prepared By</div>
            <div class="qtp-detail-line"><strong>GreenSpire Landscape Studio</strong></div>
            <div class="qtp-detail-line">info@greenspire.in</div>
            <div class="qtp-detail-line">+91 98765 43210</div>
            <div class="qtp-detail-line">Bengaluru, Karnataka</div>
          </div>
        </div>

        ${q.scope_of_work ? `
        <div class="qtp-scope">
          <div class="qtp-section-head">Scope of Work</div>
          <div class="qtp-scope-text">${q.scope_of_work}</div>
        </div>` : ''}

        <div class="qtp-financials">
          <div class="qtp-section-head">Product / Service Details</div>
          <table class="qtp-items-print-table">
            <thead>
              <tr>
                <th>#</th><th>Product / Service</th><th>Qty</th><th>Unit</th>
                <th>Rate (₹)</th><th>GST</th><th>GST Amt</th><th>Total</th>
              </tr>
            </thead>
            <tbody>${itemRows}</tbody>
          </table>

          <table class="qtp-fin-table" style="margin-top:12px;width:40%;margin-left:auto">
            <tr>
              <td class="fin-label">Subtotal (excl. GST)</td>
              <td class="fin-value">₹${subtotal.toLocaleString('en-IN')}</td>
            </tr>
            <tr>
              <td class="fin-label">Total GST</td>
              <td class="fin-value">₹${totalGst.toLocaleString('en-IN')}</td>
            </tr>
            <tr class="qtp-fin-total">
              <td class="fin-label" style="color:#fff">Grand Total</td>
              <td class="fin-value">₹${grandTotal.toLocaleString('en-IN')}</td>
            </tr>
          </table>
        </div>

        <div class="qtp-terms">
          <div class="qtp-section-head">Terms &amp; Conditions</div>
          <ul class="qtp-terms-list">
            <li>This quotation is valid for <strong>${q.validity_days || 30} days</strong> from the date of issue.</li>
            <li>50% advance payment is required to commence work.</li>
            <li>Balance payment due upon project completion.</li>
            <li>All plants and materials remain the property of GreenSpire until full payment is received.</li>
            <li>Any changes to scope may result in revised pricing.</li>
          </ul>
        </div>

        ${q.notes ? `
        <div class="qtp-scope">
          <div class="qtp-section-head">Additional Notes</div>
          <div class="qtp-scope-text">${q.notes}</div>
        </div>` : ''}

        <div class="qtp-footer">
          <div class="qtp-sig-block">
            <div style="height:40px"></div>
            <div class="qtp-sig-line"></div>
            <div class="qtp-sig-label">Client Signature &amp; Date</div>
          </div>
          <div class="qtp-sig-block">
            <div style="height:40px"></div>
            <div class="qtp-sig-line"></div>
            <div class="qtp-sig-label">Authorised Signatory</div>
          </div>
          <div class="qtp-footer-note">
            Thank you for choosing GreenSpire.<br/>
            For queries: info@greenspire.in
          </div>
        </div>
      </div>
    `;

    setTimeout(() => window.print(), 100);
  };

  /* ── WhatsApp ── */
  const handleWhatsApp = (q) => {
    setShareOpen(null);
    const gt = Number(q.total_amount || 0);
    const text = encodeURIComponent(
      `Hello ${q.client_name},\n\nPlease find below the quotation details for project *${project.name}*:\n\n` +
      `📋 *Quotation No:* ${q.quotation_number}\n` +
      `📅 *Date:* ${q.quotation_date || '—'}\n` +
      `💰 *Total Amount (incl. GST):* ₹${gt.toLocaleString('en-IN')}\n\n` +
      `This quotation is valid for ${q.validity_days || 30} days.\n\n` +
      `Kindly review and confirm to proceed. Thank you! 🌿`
    );
    const phone = (q.client_phone || '').replace(/\D/g, '');
    window.open(`https://wa.me/${phone ? `91${phone}` : ''}?text=${text}`, '_blank');
  };

  /* ── Mail ── */
  const handleMail = (q) => {
    const subject = encodeURIComponent(`Quotation ${q.quotation_number} — ${project.name}`);
    const body    = encodeURIComponent(
      `Dear ${q.client_name},\n\n` +
      `Please find below the quotation details for project ${project.name}:\n\n` +
      `Quotation No : ${q.quotation_number}\n` +
      `Date         : ${q.quotation_date || '—'}\n` +
      `Subtotal     : ₹${Number(q.amount || 0).toLocaleString('en-IN')}\n` +
      `GST Amount   : ₹${Number(q.gst_amount || 0).toLocaleString('en-IN')}\n` +
      `Total Amount : ₹${Number(q.total_amount || 0).toLocaleString('en-IN')}\n\n` +
      `Scope of Work:\n${q.scope_of_work || '—'}\n\n` +
      `This quotation is valid for ${q.validity_days || 30} days from the date of issue.\n\n` +
      `Please feel free to reach out for any queries.\n\nWarm regards,\nGreenSpire Landscape Studio\ninfo@greenspire.in`
    );
    window.location.href = `mailto:${q.client_email || ''}?subject=${subject}&body=${body}`;
  };

  return (
    <div className="animate-fade">
      <div className="tab-page-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <div>
          <h2 className="tab-page-title" style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0b3d27', margin: 0 }}>Quotation Generator</h2>
          <p className="tab-page-sub" style={{ fontSize: '0.8rem', color: '#64748b', margin: '2px 0 0' }}>Generate client estimates using templates and save to project.</p>
        </div>
        <button className="btn-primary" onClick={openAddModal} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 0.9rem', fontSize: '0.82rem' }}>
          <Plus size={14} /> New Quotation
        </button>
      </div>

      {/* History Card */}
      <div className="tab-card">
        <div className="tab-card-head"><span className="tab-card-title">Quotation History</span></div>
        <div className="tab-card-body">
          {loading ? (
            <div className="tab-empty" style={{ padding: '2rem', display: 'flex', justifyContent: 'center' }}>
              <Loader2 size={24} className="db-spin" style={{ color: '#f59e0b' }} />
            </div>
          ) : quotations.length === 0 ? (
            <div className="tab-empty" style={{ padding: '2.5rem', textAlign: 'center', color: '#94a3b8' }}>
              <FileText size={36} style={{ color: '#cbd5e1', marginBottom: '0.5rem' }} />
              <p style={{ margin: 0, fontSize: '0.85rem' }}>No quotations saved for this project yet.</p>
            </div>
          ) : (
            <div className="tab-table-wrap">
              <table className="tab-table">
                <thead>
                  <tr>
                    <th>Quote No.</th>
                    <th>Date</th>
                    <th>Subtotal</th>
                    <th>GST Amount</th>
                    <th>Grand Total</th>
                    <th>Status</th>
                    <th style={{ width: '130px', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {quotations.map(q => {
                    const sc = STATUS_CONFIG[q.status] || STATUS_CONFIG.Pending;
                    return (
                      <tr key={q.id}>
                        <td style={{ fontWeight: 700, fontSize: '0.82rem', color: '#0b3d27' }}>#{q.quotation_number}</td>
                        <td style={{ color: '#64748b', fontSize: '0.8rem' }}>
                          {q.quotation_date ? new Date(q.quotation_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                        </td>
                        <td style={{ color: '#334155', fontSize: '0.82rem' }}>{formatCurrency(q.amount)}</td>
                        <td style={{ color: '#64748b', fontSize: '0.8rem' }}>{formatCurrency(q.gst_amount)}</td>
                        <td style={{ fontWeight: 700, color: '#0b3d27', fontSize: '0.82rem' }}>{formatCurrency(q.total_amount)}</td>
                        <td>
                          <select 
                            value={q.status} 
                            onChange={e => updateStatus(q.id, e.target.value)}
                            style={{ 
                              fontSize: '0.75rem', 
                              padding: '3px 6px', 
                              border: '1.5px solid #e2e8f0', 
                              borderRadius: '6px', 
                              background: sc.bg, 
                              color: sc.color, 
                              fontWeight: 600,
                              outline: 'none',
                              cursor: 'pointer'
                            }}
                          >
                            {['Pending','Approved','Rejected'].map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end', alignItems: 'center' }}>
                            {/* Print */}
                            <button className="qt-card-action-btn" title="Print PDF" onClick={() => handlePrint(q)}>
                              <Printer size={13} />
                            </button>
                            
                            {/* Edit */}
                            <button className="qt-card-action-btn" title="Edit" onClick={() => openEditModal(q)}>
                              <Pencil size={13} />
                            </button>

                            {/* WhatsApp */}
                            <button className="qt-card-action-btn" title="WhatsApp" onClick={() => handleWhatsApp(q)}>
                              <MessageCircle size={13} />
                            </button>

                            {/* Email */}
                            <button className="qt-card-action-btn" title="Send Email" onClick={() => handleMail(q)}>
                              <Mail size={13} />
                            </button>

                            {/* Delete */}
                            <button className="qt-card-action-btn delete-btn" title="Delete" onClick={() => handleDelete(q.id)}>
                              <Trash2 size={13} />
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
      </div>

      {/* ══════════ ADD / EDIT MODAL ══════════ */}
      {showModal && (
        <div className="qt-modal-overlay">
          <div className="qt-modal qt-modal-wide">
            <div className="qt-modal-head">
              <h3 className="qt-modal-title">{editingId ? 'Edit Quotation' : 'New Quotation'}</h3>
              <button className="qt-modal-close" onClick={closeModal}>×</button>
            </div>
            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
              <div className="qt-modal-body">
                <div className="qt-form-grid">

                  {/* ── CLIENT DETAILS ── */}
                  <div className="qt-section-label">Quotation Details &amp; Presets</div>
                  
                  {/* Template */}
                  <div className="form-group">
                    <label>Apply Template Preset</label>
                    <select value={selectedTpl} onChange={e => changeTpl(e.target.value)} className="input-field">
                      <option value="">-- Select Template --</option>
                      {Object.keys(QUOTATION_TEMPLATES).map(k => <option key={k} value={k}>{k}</option>)}
                    </select>
                  </div>

                  {/* Quotation Number */}
                  <div className="form-group">
                    <label>Quotation Number</label>
                    <input type="text" required value={form.quotation_number}
                      onChange={e => f('quotation_number', e.target.value)}
                      className="input-field" placeholder="QT-2606-001" />
                  </div>

                  {/* Date */}
                  <div className="form-group">
                    <label>Quotation Date</label>
                    <input type="date" value={form.quotation_date}
                      onChange={e => f('quotation_date', e.target.value)}
                      className="input-field" style={{ colorScheme: 'light' }} />
                  </div>

                  {/* Client Name */}
                  <div className="form-group">
                    <label>Client Name</label>
                    <input type="text" required value={form.client_name}
                      onChange={e => f('client_name', e.target.value)}
                      className="input-field" placeholder="Client Name" />
                  </div>

                  {/* Project Type */}
                  <div className="form-group">
                    <label>Project Type</label>
                    <input type="text" required value={form.project_type}
                      onChange={e => f('project_type', e.target.value)}
                      className="input-field" placeholder="e.g. Residential" />
                  </div>

                  {/* Email */}
                  <div className="form-group">
                    <label>Client Email</label>
                    <input type="email" value={form.client_email}
                      onChange={e => f('client_email', e.target.value)}
                      className="input-field" placeholder="client@example.com" />
                  </div>

                  {/* Phone */}
                  <div className="form-group">
                    <label>Client Phone (WhatsApp)</label>
                    <input type="tel" value={form.client_phone}
                      onChange={e => f('client_phone', e.target.value)}
                      className="input-field" placeholder="e.g. 9876543210" />
                  </div>

                  {/* Site Address */}
                  <div className="form-group qt-full">
                    <label>Site Address</label>
                    <input type="text" value={form.site_address}
                      onChange={e => f('site_address', e.target.value)}
                      className="input-field" placeholder="Site Address" />
                  </div>

                  {/* Scope of Work */}
                  <div className="form-group qt-full">
                    <label>Scope of Work / Description</label>
                    <textarea value={form.scope_of_work}
                      onChange={e => f('scope_of_work', e.target.value)}
                      className="input-field" rows={2}
                      placeholder="Brief description of the project scope…"
                      style={{ resize: 'vertical', fontFamily: 'inherit' }} />
                  </div>

                  {/* ── PRODUCT LINE ITEMS ── */}
                  <div className="qt-section-label">Products &amp; Services</div>

                  <div className="qt-items-wrap">
                    <table className="qt-items-table">
                      <thead>
                        <tr>
                          <th style={{ width: '30px' }}>#</th>
                          <th style={{ width: '160px' }}>Product / Service</th>
                          <th>Description</th>
                          <th style={{ width: '55px' }}>Qty</th>
                          <th style={{ width: '80px' }}>Unit</th>
                          <th style={{ width: '100px' }}>Rate (₹)</th>
                          <th style={{ width: '110px' }}>GST</th>
                          <th style={{ width: '90px' }}>Amount</th>
                          <th style={{ width: '30px' }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((it, idx) => {
                          const { amount, gst, total } = calcItemAmount(it);
                          return (
                            <tr key={it.id}>
                              <td style={{ textAlign: 'center', color: '#94a3b8', fontSize: '.75rem', fontWeight: 600 }}>
                                {idx + 1}
                              </td>
                              <td>
                                <input
                                  className="qt-item-input"
                                  value={it.name}
                                  onChange={e => updateItem(it.id, 'name', e.target.value)}
                                  placeholder="e.g. Lawn Turf"
                                  required
                                />
                              </td>
                              <td>
                                <input
                                  className="qt-item-input"
                                  value={it.desc}
                                  onChange={e => updateItem(it.id, 'desc', e.target.value)}
                                  placeholder="Optional detail…"
                                />
                              </td>
                              <td>
                                <input
                                  type="number" min="0" step="0.01"
                                  className="qt-item-input narrow"
                                  value={it.qty}
                                  onChange={e => updateItem(it.id, 'qty', e.target.value)}
                                />
                              </td>
                              <td>
                                <select
                                  className="qt-item-input med"
                                  value={it.unit}
                                  onChange={e => updateItem(it.id, 'unit', e.target.value)}
                                >
                                  {UNITS.map(u => <option key={u}>{u}</option>)}
                                </select>
                              </td>
                              <td>
                                <input
                                  type="number" min="0" step="0.01"
                                  className="qt-item-input med"
                                  value={it.rate}
                                  onChange={e => updateItem(it.id, 'rate', e.target.value)}
                                  placeholder="0"
                                />
                              </td>
                              <td>
                                <div className="qt-gst-toggle">
                                  <label className="qt-toggle-switch">
                                    <input
                                      type="checkbox"
                                      checked={it.hasGst}
                                      onChange={e => updateItem(it.id, 'hasGst', e.target.checked)}
                                    />
                                    <span className="qt-toggle-slider" />
                                  </label>
                                  {it.hasGst && (
                                    <select
                                      className="qt-gst-pct-input"
                                      value={it.gstPct}
                                      onChange={e => updateItem(it.id, 'gstPct', Number(e.target.value))}
                                    >
                                      {GST_OPTIONS.map(g => <option key={g} value={g}>{g}%</option>)}
                                    </select>
                                  )}
                                  {!it.hasGst && <span style={{ fontSize: '.72rem', color: '#94a3b8' }}>NIL</span>}
                                </div>
                              </td>
                              <td>
                                <div className="qt-row-amount">{fmtINR(total)}</div>
                                {it.hasGst && (
                                  <div style={{ fontSize: '.68rem', color: '#94a3b8' }}>+GST {fmtINR(gst)}</div>
                                )}
                              </td>
                              <td>
                                <button
                                  type="button"
                                  className="qt-remove-row"
                                  onClick={() => removeItem(it.id)}
                                  disabled={items.length === 1}
                                  title="Remove row"
                                >
                                  <X size={11} />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>

                    <button type="button" className="qt-add-row-btn" onClick={addItem}>
                      <Plus size={13} /> Add Product / Service
                    </button>
                  </div>

                  {/* ── SUMMARY ── */}
                  <div className="qt-summary-box">
                    <div className="qt-summary-row">
                      <span className="qt-summary-label">Subtotal (excl. GST)</span>
                      <span className="qt-summary-val">{fmtINR(totals.subtotal)}</span>
                    </div>
                    <div className="qt-summary-row">
                      <span className="qt-summary-label">Total GST</span>
                      <span className="qt-summary-val">{fmtINR(totals.totalGst)}</span>
                    </div>
                    <div className="qt-summary-total">
                      <span className="qt-summary-label">Grand Total</span>
                      <span className="qt-summary-val">{fmtINR(totals.grandTotal)}</span>
                    </div>
                  </div>

                  {/* ── ADDITIONAL ── */}
                  <div className="qt-section-label">Additional Info</div>

                  {/* Validity */}
                  <div className="form-group">
                    <label>Validity (days)</label>
                    <input type="number" value={form.validity_days}
                      onChange={e => f('validity_days', e.target.value)}
                      className="input-field" placeholder="30" min="1" />
                  </div>

                  {/* Notes */}
                  <div className="form-group">
                    <label>Additional Notes / Payment Terms</label>
                    <input type="text" value={form.notes}
                      onChange={e => f('notes', e.target.value)}
                      className="input-field" placeholder="Optional notes…" />
                  </div>

                </div>
              </div>
              <div className="qt-modal-foot">
                <button type="button" className="btn-secondary" onClick={closeModal}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={isSaving}>
                  {isSaving ? 'Saving...' : editingId ? 'Save Changes' : 'Create Quotation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}