import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Search, MapPin, Loader2, FileText,
  CheckCircle, Share2, Mail,
  FileDown, MessageCircle, TrendingUp, Printer,
  Receipt, Pencil, Trash2, Plus, X
} from 'lucide-react';
import { supabase } from '../../supabase';
import { useCompanyConfig } from '../../context/CompanySettingsContext';
import { createInvoiceFromQuotation } from '../../utils/invoiceHelpers';
import html2pdf from 'html2pdf.js';
import '../../styles/quotations.css';

const UNITS       = ['Nos', 'Sqft', 'Rft', 'Bags', 'Hours', 'Days', 'Lump Sum', 'Kg', 'Litre'];
const GST_OPTIONS = [0, 5, 12, 18, 28];
const INVOICE_TYPES = ['Full', 'Advance', 'Progress', 'Final'];

const blankItem = () => ({
  id:     Date.now() + Math.random(),
  name:   '',
  desc:   '',
  qty:    1,
  unit:   'Nos',
  rate:   '',
  hasGst: true,
  gstPct: 18,
});

/* ── Inline style objects for the edit / new-invoice modals ──
   (mirrors TabQuotations.jsx so the two feel identical) ── */
const modalOverlayStyle = {
  position: 'fixed', inset: 0, background: 'rgba(11, 28, 20, 0.5)',
  backdropFilter: 'blur(3px)', WebkitBackdropFilter: 'blur(3px)',
  zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem',
};
const modalBoxStyle = (maxWidth = '680px') => ({
  background: '#fff', borderRadius: '16px', width: '100%', maxWidth,
  maxHeight: 'calc(100dvh - 2rem)', display: 'flex', flexDirection: 'column', overflow: 'hidden',
  boxShadow: '0 2px 8px rgba(0,0,0,.06), 0 16px 40px rgba(0,0,0,.16), 0 40px 80px rgba(0,0,0,.1)',
  animation: 'qtModalIn .2s ease-out',
});
const modalHeadStyle = {
  padding: '1.2rem 1.4rem', borderBottom: '1px solid #f1f5f9', display: 'flex',
  alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, background: '#fff',
};
const modalTitleStyle = { fontSize: '1.05rem', fontWeight: 700, color: '#0b3d27', margin: 0 };
const modalCloseBtnStyle = {
  width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: '1.2rem',
  color: '#64748b', cursor: 'pointer', lineHeight: 1, flexShrink: 0,
};
const modalBodyStyle = {
  flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden',
  WebkitOverflowScrolling: 'touch', padding: '1.25rem 1.5rem',
};
const modalFootStyle = {
  padding: '1rem 1.5rem', borderTop: '1px solid #f1f5f9', display: 'flex',
  alignItems: 'center', justifyContent: 'flex-end', gap: '.75rem', flexShrink: 0, background: '#fff',
};



/* ── Helpers ── */
const fmt = (n) =>
  n >= 10000000 ? `₹${(n / 10000000).toFixed(2)}Cr`
  : n >= 100000  ? `₹${(n / 100000).toFixed(1)}L`
  : n >= 1000    ? `₹${(n / 1000).toFixed(1)}K`
  : `₹${n}`;

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
    subtotal += amount;
    totalGst += gst;
  });
  return {
    subtotal:   parseFloat(subtotal.toFixed(2)),
    totalGst:   parseFloat(totalGst.toFixed(2)),
    grandTotal: parseFloat((subtotal + totalGst).toFixed(2)),
  };
};

const getItemCount = (q) => {
  try {
    const p = JSON.parse(q.line_items);
    if (p && !Array.isArray(p) && p.items) return p.items.length;
    if (Array.isArray(p)) return p.length;
  } catch {}
  return 1;
};

/* ═══════════════════════════════════════════════════════════
   COMPONENT
═══════════════════════════════════════════════════════════ */
export default function TabInvoices({ project }) {
  const COMPANY_CONFIG = useCompanyConfig();
  const [loading, setLoading]           = useState(true);
  const [invoices, setInvoices]         = useState([]);
  const [approvedQuotations, setApprovedQuotations] = useState([]);
  const [searchTerm, setSearchTerm]     = useState('');
  const [shareOpen, setShareOpen]       = useState(null);
  const shareRef                        = useRef(null);

  /* ── Edit-invoice modal state ── */
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState(null);
  const [form, setForm]   = useState(null);
  const [items, setItems] = useState([blankItem()]);

  /* ── New-invoice-from-quotation modal state ── */
  const [showNewModal, setShowNewModal]   = useState(false);
  const [newQuotationId, setNewQuotationId] = useState('');
  const [newInvoiceType, setNewInvoiceType] = useState('Progress');
  const [creating, setCreating]             = useState(false);

  useEffect(() => {
    const handler = (e) => {
      if (shareRef.current && !shareRef.current.contains(e.target)) setShareOpen(null);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  /* ── Fetch invoices (own table now — fully independent of quotations) ── */
  useEffect(() => { fetchInvoices(); fetchApprovedQuotations(); }, [project.id]);

  const fetchInvoices = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('invoices')
        .select('*')
        .eq('project_id', project.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setInvoices(data || []);
    } catch (err) {
      console.error('Error fetching invoices:', err);
    } finally {
      setLoading(false);
    }
  };

  /* ── Approved quotations for this project — used by the "New Invoice" picker ── */
  const fetchApprovedQuotations = async () => {
    try {
      const { data, error } = await supabase
        .from('quotations')
        .select('*')
        .eq('project_id', project.id)
        .eq('status', 'Approved')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setApprovedQuotations(data || []);
    } catch (err) {
      console.error('Error fetching approved quotations:', err);
    }
  };

  /* ── Edit modal helpers ── */
  const f = (field, value) => setForm(prev => ({ ...prev, [field]: value }));
  const addItem = () => setItems(prev => [...prev, blankItem()]);
  const removeItem = (id) => setItems(prev => prev.filter(it => it.id !== id));
  const updateItem = (id, field, value) =>
    setItems(prev => prev.map(it => it.id === id ? { ...it, [field]: value } : it));

  const totals = items ? calcTotals(items) : { subtotal: 0, totalGst: 0, grandTotal: 0 };

  const openEditModal = (inv) => {
    setEditingInvoice(inv);
    setForm({
      invoice_number:   inv.invoice_number   || '',
      invoice_type:     inv.invoice_type     || 'Full',
      invoice_date:     inv.invoice_date     || new Date().toISOString().split('T')[0],
      client_name:      inv.client_name      || '',
      client_email:     inv.client_email     || '',
      client_phone:     inv.client_phone     || '',
      client_gst:       inv.client_gst       || '',
      site_address:     inv.site_address     || '',
      notes:            inv.notes            || '',
      payment_terms:    inv.payment_terms    || '',
      terms_conditions: inv.terms_conditions || '',
    });
    try {
      const parsed = inv.line_items ? JSON.parse(inv.line_items) : null;
      let savedItems = null;
      if (parsed && !Array.isArray(parsed) && parsed.items) savedItems = parsed.items;
      else if (Array.isArray(parsed)) savedItems = parsed;
      setItems(savedItems && savedItems.length > 0 ? savedItems.map(i => ({ ...i, id: Date.now() + Math.random() })) : [blankItem()]);
    } catch {
      setItems([blankItem()]);
    }
    setShowEditModal(true);
  };

  const closeEditModal = () => {
    setShowEditModal(false);
    setEditingInvoice(null);
    setForm(null);
    setItems([blankItem()]);
  };

  /* ── Save edited invoice — writes ONLY to the invoices table.
     The source quotation (and any other invoice from it) is untouched. ── */
  const handleSaveInvoice = async (e) => {
    e.preventDefault();
    if (!editingInvoice) return;
    const { subtotal, totalGst, grandTotal } = totals;
    const payload = {
      invoice_number:   form.invoice_number,
      invoice_type:     form.invoice_type,
      invoice_date:     form.invoice_date || null,
      client_name:      form.client_name  || null,
      client_email:     form.client_email || null,
      client_phone:     form.client_phone || null,
      client_gst:       form.client_gst   || null,
      site_address:     form.site_address || null,
      notes:            form.notes || null,
      payment_terms:    form.payment_terms || null,
      terms_conditions: form.terms_conditions || null,
      line_items:       JSON.stringify({ __meta: { client_gst: form.client_gst || null }, items }),
      amount:           subtotal,
      gst_percent:      items.some(i => i.hasGst) ? (items.find(i => i.hasGst)?.gstPct || 0) : 0,
      gst_amount:       totalGst,
      total_amount:     grandTotal,
    };
    try {
      const { error } = await supabase.from('invoices').update(payload).eq('id', editingInvoice.id);
      if (error) throw error;
      closeEditModal();
      fetchInvoices();
    } catch (err) {
      alert(err.message || 'Failed to save invoice');
    }
  };

  /* ── Delete an invoice (does not touch the quotation) ── */
  const handleDeleteInvoice = async (inv) => {
    if (!window.confirm(`Delete invoice ${inv.invoice_number}? This cannot be undone.`)) return;
    try {
      const { error } = await supabase.from('invoices').delete().eq('id', inv.id);
      if (error) throw error;
      fetchInvoices();
    } catch (err) {
      alert('Failed to delete: ' + err.message);
    }
  };

  /* ── Create an additional invoice from an approved quotation
     (advance / progress / final billing) ── */
  const handleCreateInvoice = async () => {
    if (!newQuotationId) return;
    setCreating(true);
    try {
      const q = approvedQuotations.find(q => String(q.id) === String(newQuotationId));
      if (!q) throw new Error('Quotation not found');
      await createInvoiceFromQuotation(q, project.id, newInvoiceType);
      setShowNewModal(false);
      setNewQuotationId('');
      setNewInvoiceType('Progress');
      fetchInvoices();
    } catch (err) {
      alert(err.message || 'Failed to create invoice');
    } finally {
      setCreating(false);
    }
  };

  /* ── Build print items from saved line_items ── */
  const getPrintItems = (q) => {
    try {
      if (q.line_items) {
        const parsed = JSON.parse(q.line_items);
        if (parsed && !Array.isArray(parsed) && parsed.items) return { items: parsed.items, meta: parsed.__meta || {} };
        if (Array.isArray(parsed)) return { items: parsed, meta: {} };
      }
    } catch {}
    return { items: null, meta: {} };
  };

  /* ── Build Invoice document HTML (same layout as Quotation but titled INVOICE) ── */
  const buildInvoiceDocHTML = async (q) => {
    const { items: lineItems, meta } = getPrintItems(q);
    const clientGst = q.client_gst || meta.client_gst || null;

    const { subtotal, totalGst, grandTotal } = lineItems
      ? calcTotals(lineItems)
      : { subtotal: Number(q.amount || 0), totalGst: Number(q.gst_amount || 0), grandTotal: Number(q.total_amount || 0) };

    const dateStr = q.invoice_date
      ? new Date(q.invoice_date).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
      : '—';

    const validUntilStr = (() => {
      const d = new Date(q.invoice_date || Date.now());
      d.setDate(d.getDate() + Number(q.validity_days || 30));
      return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    })();

    const numToWords = (num) => {
      const ones = ['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine',
        'Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen'];
      const tens = ['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];
      if (num === 0) return 'Zero';
      const convert = (n) => {
        if (n < 20) return ones[n];
        if (n < 100) return tens[Math.floor(n/10)] + (n%10 ? ' ' + ones[n%10] : '');
        if (n < 1000) return ones[Math.floor(n/100)] + ' Hundred' + (n%100 ? ' ' + convert(n%100) : '');
        if (n < 100000) return convert(Math.floor(n/1000)) + ' Thousand' + (n%1000 ? ' ' + convert(n%1000) : '');
        if (n < 10000000) return convert(Math.floor(n/100000)) + ' Lakh' + (n%100000 ? ' ' + convert(n%100000) : '');
        return convert(Math.floor(n/10000000)) + ' Crore' + (n%10000000 ? ' ' + convert(n%10000000) : '');
      };
      const intPart = Math.floor(num);
      const paisa   = Math.round((num - intPart) * 100);
      let result    = convert(intPart) + ' Rupees';
      if (paisa > 0) result += ' and ' + convert(paisa) + ' Paise';
      return result + ' Only';
    };
    const amountInWords = numToWords(grandTotal);

    const allItemRows = lineItems
      ? lineItems.map((it, i) => {
          const { amount, gst, total } = calcItemAmount(it);
          return `<tr>
            <td class="col-sr">${i + 1}</td>
            <td class="col-item"><strong>${it.name || '—'}</strong>${it.desc ? `<br/><span class="item-desc">${it.desc}</span>` : ''}</td>
            <td class="col-qty">${it.qty} ${it.unit}</td>
            <td class="col-rate">₹${Number(it.rate || 0).toLocaleString('en-IN', {minimumFractionDigits:2})}</td>
            <td class="col-amt">₹${amount.toLocaleString('en-IN', {minimumFractionDigits:2})}</td>
            <td class="col-gst">${it.hasGst ? `${it.gstPct}%` : 'NIL'}</td>
            <td class="col-gstamt">${it.hasGst ? `₹${gst.toLocaleString('en-IN', {minimumFractionDigits:2})}` : '—'}</td>
            <td class="col-total">₹${total.toLocaleString('en-IN', {minimumFractionDigits:2})}</td>
          </tr>`;
        })
      : [`<tr>
          <td class="col-sr">1</td>
          <td class="col-item"><strong>Service</strong></td>
          <td class="col-qty">1 Nos</td>
          <td class="col-rate">₹${Number(q.amount || 0).toLocaleString('en-IN', {minimumFractionDigits:2})}</td>
          <td class="col-amt">₹${Number(q.amount || 0).toLocaleString('en-IN', {minimumFractionDigits:2})}</td>
          <td class="col-gst">${q.gst_percent || 0}%</td>
          <td class="col-gstamt">₹${Number(q.gst_amount || 0).toLocaleString('en-IN', {minimumFractionDigits:2})}</td>
          <td class="col-total">₹${Number(q.total_amount || 0).toLocaleString('en-IN', {minimumFractionDigits:2})}</td>
        </tr>`];

    const tableHead = () => `
      <thead>
        <tr>
          <th class="col-sr">#</th>
          <th class="col-item">Description</th>
          <th class="col-qty">Qty / Unit</th>
          <th class="col-rate">Unit Price</th>
          <th class="col-amt">Amount</th>
          <th class="col-gst">GST %</th>
          <th class="col-gstamt">GST Amt</th>
          <th class="col-total">Total</th>
        </tr>
      </thead>`;

    const pageFooterHTML = `
      <div class="qtp-page-footer">
        <div class="qtp-footer-addr-row">
          <strong>${COMPANY_CONFIG.name} ${COMPANY_CONFIG.nameSuffix}</strong>
          <span class="qtp-footer-sep">·</span>
          <span>${COMPANY_CONFIG.address}</span>
        </div>
        <div class="qtp-footer-contact-row">
          <span>📞 ${COMPANY_CONFIG.phone}</span>
          <span class="qtp-footer-sep">·</span>
          <span>✉ ${COMPANY_CONFIG.email}</span>
          <span class="qtp-footer-sep">·</span>
          <span>GST: ${COMPANY_CONFIG.gstNumber}</span>
        </div>
      </div>`;

    const sandbox = document.createElement('div');
    sandbox.style.cssText = 'position:fixed;top:0;left:-9999px;z-index:-1;visibility:hidden;pointer-events:none;width:794px;';
    document.body.appendChild(sandbox);

    const pageHeaderFinal = (pageNum, total) => `
      <div class="qtp-header">
        <div class="qtp-brand-block">
          <div class="qtp-logo-mark">
            <img src="${COMPANY_CONFIG.logo}" alt="GreenSpire" crossorigin="anonymous"/>
            <span style="position:absolute;top:4px;right:-10px;font-size:8px;font-weight:900;color:#5c3a21;line-height:1;font-family:Arial,sans-serif;">TM</span>
          </div>
          <div class="qtp-brand-text">
            <div class="qtp-brand-name-wrap">
              <div class="qtp-brand">${COMPANY_CONFIG.name}</div>
              <div class="qtp-brand-suffix">${COMPANY_CONFIG.nameSuffix}</div>
            </div>
            <div class="qtp-tagline">${COMPANY_CONFIG.tagline}</div>
          </div>
        </div>
        <div class="qtp-header-right">
          <div class="qtp-doc-title">INVOICE</div>
          <table class="qtp-meta-table">
            <tr><td class="qtp-meta-key">Inv. No.</td><td class="qtp-meta-val"><strong>${q.invoice_number || q.quotation_number || '—'}</strong></td></tr>
            <tr><td class="qtp-meta-key">Date</td><td class="qtp-meta-val"><strong>${dateStr}</strong></td></tr>
            <tr><td class="qtp-meta-key">GST No.</td><td class="qtp-meta-val"><strong>${COMPANY_CONFIG.gstNumber}</strong></td></tr>
            ${total > 1 ? `<tr><td class="qtp-meta-key">Page</td><td class="qtp-meta-val"><strong>${pageNum} / ${total}</strong></td></tr>` : ''}
          </table>
        </div>
      </div>`;

    const overflowsOnePage = (bodyHTML, pageNum, totalGuess) => {
      sandbox.innerHTML = `<div class="qt-print-doc">${pageHeaderFinal(pageNum, totalGuess)}<div class="qtp-page-body">${bodyHTML}</div>${pageFooterHTML}</div>`;
      const pageBody = sandbox.querySelector('.qtp-page-body');
      if (!pageBody || !pageBody.lastElementChild) return false;
      const reservedBottom = parseFloat(window.getComputedStyle(pageBody).paddingBottom) || 0;
      const safeBottom     = pageBody.getBoundingClientRect().top + pageBody.clientHeight - reservedBottom;
      const contentBottom  = pageBody.lastElementChild.getBoundingClientRect().bottom;
      return contentBottom > safeBottom + 1; // +1px tolerance for sub-pixel rounding
    };

    const gstRowsHTML = `
      <tr><td class="totals-label">CGST</td><td class="totals-value">₹${(totalGst / 2).toLocaleString('en-IN', {minimumFractionDigits:2})}</td></tr>
      <tr><td class="totals-label">SGST</td><td class="totals-value">₹${(totalGst / 2).toLocaleString('en-IN', {minimumFractionDigits:2})}</td></tr>`;

    const bankDetailsInnerHTML = `
      <div class="qtp-terms-section">
        <div class="qtp-terms-head">Bank Details</div>
        <div class="qtp-bank-row"><span class="qtp-bank-key">Bank Name</span><span class="qtp-bank-val">${COMPANY_CONFIG.bank.bankName}</span></div>
        <div class="qtp-bank-row"><span class="qtp-bank-key">Branch / IFSC</span><span class="qtp-bank-val">${COMPANY_CONFIG.bank.branch}</span></div>
        <div class="qtp-bank-row"><span class="qtp-bank-key">Account No.</span><span class="qtp-bank-val" style="font-weight:700;letter-spacing:.04em;">${COMPANY_CONFIG.bank.accountNo}</span></div>
        <div class="qtp-bank-row"><span class="qtp-bank-key">UPI / VPA</span><span class="qtp-bank-val" style="color:#0b3d27;font-weight:600;">${COMPANY_CONFIG.bank.vpa}</span></div>
      </div>`;

    const sigInnerHTML = `
      <div class="qtp-sig-bottom">
        <div class="qtp-sig-line"></div>
        <div class="qtp-sig-label-row">
          <div class="qtp-sig-label">Authorised Signatory</div>
          <div class="qtp-sig-company-name">${COMPANY_CONFIG.name} ${COMPANY_CONFIG.nameSuffix}</div>
        </div>
      </div>`;

    const notesHTML = q.notes ? `<div class="qtp-notes-block" style="padding: 0; margin-top: 10px; page-break-inside: avoid;"><div class="qtp-section-head">Notes</div><ul class="qtp-notes-list"><li>${q.notes.replace(/\n/g,'</li><li>')}</li></ul></div>` : '';

    const summaryLeftHTML = `
      <div class="qtp-totals-words">Amount in Words: <strong>${amountInWords}</strong></div>
      ${notesHTML}
      <div class="qtp-summary-left-terms">${bankDetailsInnerHTML}</div>`;

    const summaryRightHTML = `
      <table class="qtp-totals-table">
        <tbody>
          <tr><td class="totals-label">Subtotal (excl. GST)</td><td class="totals-value">₹${subtotal.toLocaleString('en-IN',{minimumFractionDigits:2})}</td></tr>
          ${gstRowsHTML}
          <tr class="totals-grand-row"><td class="totals-label">GRAND TOTAL</td><td class="totals-value">₹${grandTotal.toLocaleString('en-IN',{minimumFractionDigits:2})}</td></tr>
        </tbody>
      </table>
      <div class="qtp-sig-block">${sigInnerHTML}</div>`;

    const summaryPreviewHTML = `
      <div class="qtp-summary-row">
        <div class="qtp-summary-left">
          <div class="qtp-totals-words">Amount in Words: <strong>${amountInWords}</strong></div>
        </div>
        <div class="qtp-summary-right">
          <table class="qtp-totals-table">
            <tbody>
              <tr><td class="totals-label">Subtotal (excl. GST)</td><td class="totals-value">₹${subtotal.toLocaleString('en-IN',{minimumFractionDigits:2})}</td></tr>
              ${gstRowsHTML}
              <tr class="totals-grand-row"><td class="totals-label">GRAND TOTAL</td><td class="totals-value">₹${grandTotal.toLocaleString('en-IN',{minimumFractionDigits:2})}</td></tr>
            </tbody>
          </table>
        </div>
      </div>`;

    const buildCombinedTail = (stretch) => `
      <div class="qtp-summary-row"${stretch ? ' style="flex:1 1 auto"' : ''}>
        <div class="qtp-summary-left">${summaryLeftHTML}</div>
        <div class="qtp-summary-right">${summaryRightHTML}</div>
      </div>`;

    const combinedTailHTML      = buildCombinedTail(false); 
    const combinedTailHTMLFinal = buildCombinedTail(true);

    const clientInfoBandHTML = `
      <div class="qtp-info-band">
        <div class="qtp-billed-col">
          <div class="qtp-band-label">BILLED TO</div>
          <div class="qtp-billed-name">${(q.client_name || '—').toUpperCase()}</div>
          ${q.site_address ? `<div class="qtp-billed-addr">${q.site_address}</div>` : ''}
          ${q.client_phone ? `<div class="qtp-billed-contact">📞 ${q.client_phone}</div>` : ''}
          ${q.client_email ? `<div class="qtp-billed-contact">✉ ${q.client_email}</div>` : ''}
          ${clientGst     ? `<div class="qtp-billed-gst">GST No.: ${clientGst}</div>` : ''}
        </div>
        <div class="qtp-project-col">
          <div class="qtp-band-label">PROJECT DETAILS</div>
          ${q.project_name ? `<div class="qtp-proj-row"><span class="qtp-proj-key">Project Name</span><span class="qtp-proj-val">${q.project_name}</span></div>` : ''}
          <div class="qtp-proj-row"><span class="qtp-proj-key">Project Type</span><span class="qtp-proj-val">${q.project_type || '—'}</span></div>
          ${q.plot_area ? `<div class="qtp-proj-row"><span class="qtp-proj-key">Plot Area</span><span class="qtp-proj-val">${Number(q.plot_area).toLocaleString('en-IN')} Sq.Ft</span></div>` : ''}
          ${q.start_date ? `<div class="qtp-proj-row"><span class="qtp-proj-key">Start Date</span><span class="qtp-proj-val">${new Date(q.start_date).toLocaleDateString('en-GB')}</span></div>` : ''}
          ${q.completion_date ? `<div class="qtp-proj-row"><span class="qtp-proj-key">Est. Completion</span><span class="qtp-proj-val">${new Date(q.completion_date).toLocaleDateString('en-GB')}</span></div>` : ''}
        </div>
      </div>
      ${q.scope_of_work ? `
      <div class="qtp-scope">
        <div class="qtp-section-head">Scope of Work</div>
        <div class="qtp-scope-text">${q.scope_of_work}</div>
      </div>` : ''}`;

    const itemsTableHTML = (rows) => `
      <div class="qtp-financials">
        <div class="qtp-section-head" style="margin-bottom:12px">Bill of Quantities</div>
        <table class="qtp-items-print-table">
          ${tableHead()}
          <tbody>${rows.join('')}</tbody>
        </table>
      </div>`;

    const contItemsTableHTML = (rows, pageNum, totalPages) => `
      <div class="qtp-financials qtp-financials-cont">
        <div class="qtp-continuation-label">Bill of Quantities <span class="qtp-cont-page">(continued — page ${pageNum} of ${totalPages})</span></div>
        <table class="qtp-items-print-table">
          ${tableHead()}
          <tbody>${rows.join('')}</tbody>
        </table>
      </div>`;

    const summaryContChromeHTML = `<div class="qtp-financials qtp-financials-cont"><div class="qtp-continuation-label">Summary &amp; Authorisation</div></div>`;

    const fullBodyHTMLTest = `${clientInfoBandHTML}${itemsTableHTML(allItemRows)}${combinedTailHTML}`;

    if (!overflowsOnePage(fullBodyHTMLTest, 1, 1)) {
      const fullBodyHTMLFinal = `${clientInfoBandHTML}${itemsTableHTML(allItemRows)}${combinedTailHTMLFinal}`;
      document.body.removeChild(sandbox);
      return `<div class="qt-print-wrapper"><div class="qt-print-doc">
        ${pageHeaderFinal(1,1)}<div class="qtp-page-body">${fullBodyHTMLFinal}</div>${pageFooterHTML}</div></div>`;
    }

    const itemBuckets = [];
    {
      let remaining = allItemRows.slice();
      let pageNum = 1;
      while (remaining.length > 0) {
        const isFirst = pageNum === 1;
        let rows = [];
        for (let i = 0; i < remaining.length; i++) {
          const candidate = [...rows, remaining[i]];
          const candidateBody = isFirst
            ? `${clientInfoBandHTML}${itemsTableHTML(candidate)}`
            : contItemsTableHTML(candidate, pageNum, 99);
          if (rows.length === 0 || !overflowsOnePage(candidateBody, pageNum, 99)) {
            rows = candidate;
          } else {
            break;
          }
        }
        if (rows.length === 0) rows = [remaining[0]]; 
        itemBuckets.push(rows);
        remaining = remaining.slice(rows.length);
        pageNum++;
      }
      if (itemBuckets.length === 0) itemBuckets.push([]);
    }

    const lastBucketIdx = itemBuckets.length - 1;
    const isLastBucketFirstPage = lastBucketIdx === 0;
    const lastPageItemsHTML = isLastBucketFirstPage
      ? `${clientInfoBandHTML}${itemsTableHTML(itemBuckets[lastBucketIdx])}`
      : contItemsTableHTML(itemBuckets[lastBucketIdx], lastBucketIdx + 1, 99);

    const candidateLastPageWithTail = `${lastPageItemsHTML}${combinedTailHTML}`;
    const tailFitsOnItemsPage = !overflowsOnePage(candidateLastPageWithTail, lastBucketIdx + 1, 99);

    let duplicateSummaryOnItemsPage = false;
    if (!tailFitsOnItemsPage) {
      const previewCandidate = `${lastPageItemsHTML}${summaryPreviewHTML}`;
      duplicateSummaryOnItemsPage = !overflowsOnePage(previewCandidate, lastBucketIdx + 1, 99);
    }

    const lastPageTailHTML = tailFitsOnItemsPage
      ? combinedTailHTMLFinal
      : (duplicateSummaryOnItemsPage ? summaryPreviewHTML : '');

    const extraPageTailHTML = tailFitsOnItemsPage
      ? ''
      : combinedTailHTMLFinal;

    const needsExtraPage = !!extraPageTailHTML;

    document.body.removeChild(sandbox);

    const totalPages = itemBuckets.length + (needsExtraPage ? 1 : 0);

    const itemPageDivs = itemBuckets.map((rows, idx) => {
      const pageNum = idx + 1;
      const isFirst = pageNum === 1;
      const isLastItemsPage = pageNum === itemBuckets.length;
      const isLastPageOverall = isLastItemsPage && !needsExtraPage;
      return `<div class="qt-print-doc${isLastPageOverall ? '' : ' qtp-page-break'}">
        ${pageHeaderFinal(pageNum, totalPages)}<div class="qtp-page-body">
        ${isFirst ? `${clientInfoBandHTML}${itemsTableHTML(rows)}` : contItemsTableHTML(rows, pageNum, totalPages)}
        ${isLastItemsPage ? lastPageTailHTML : ''}
        </div>${pageFooterHTML}</div>`;
    });

    const extraTailPageDiv = needsExtraPage ? `<div class="qt-print-doc">
      ${pageHeaderFinal(totalPages, totalPages)}<div class="qtp-page-body">
      ${summaryContChromeHTML}
      ${extraPageTailHTML}
      </div>${pageFooterHTML}</div>` : '';

    return `<div class="qt-print-wrapper">${itemPageDivs.join('')}${extraTailPageDiv}</div>`;
  };

  /* ── Print ── */
  const handlePrint = async (q) => {
    setShareOpen(null);
    let root = document.getElementById('qt-print-root');
    if (!root) { root = document.createElement('div'); root.id = 'qt-print-root'; document.body.appendChild(root); }
    root.innerHTML = await buildInvoiceDocHTML(q);
    setTimeout(() => window.print(), 100);
  };

  /* ── Download PDF ── */
  const handleDownloadPDF = async (q) => {
    setShareOpen(null);
    let root = document.getElementById('qt-pdf-export-root');
    if (!root) { root = document.createElement('div'); root.id = 'qt-pdf-export-root'; document.body.appendChild(root); }
    root.style.width = '794px'; root.style.minWidth = '794px';
    root.innerHTML = await buildInvoiceDocHTML(q);
    const pageDivs = Array.from(root.querySelectorAll('.qt-print-doc'));
    pageDivs.forEach(div => {
      div.style.width = '794px'; div.style.minWidth = '794px';
      div.style.height = '1122px'; div.style.minHeight = '1122px';
      div.style.maxHeight = '1122px'; div.style.overflow = 'hidden';
    });
    const filename = `Invoice-${q.invoice_number || q.quotation_number || q.id}.pdf`;
    const opts = { margin: 0, image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2, useCORS: true, scrollX: 0, scrollY: 0, windowWidth: 794, width: 794, height: 1122 }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' } };
    try {
      if (pageDivs.length === 1) { await html2pdf().set({ ...opts, filename }).from(pageDivs[0]).save(); }
      else {
        const worker = html2pdf().set({ ...opts, filename });
        await worker.from(pageDivs[0]).toImg().toPdf();
        const pdf = worker.prop.pdf;
        for (let i = 1; i < pageDivs.length; i++) {
          const w2 = html2pdf().set(opts); await w2.from(pageDivs[i]).toImg();
          pdf.addPage(); pdf.addImage(w2.prop.img, 'JPEG', 0, 0, 210, 297);
        }
        pdf.save(filename);
      }
    } catch (err) { alert('Failed to generate PDF: ' + err.message); }
    finally { root.innerHTML = ''; root.style.width = ''; root.style.minWidth = ''; }
  };

  /* ── Build PDF blob for sharing ── */
  const buildPdfBlob = async (q) => {
    let root = document.getElementById('qt-pdf-export-root');
    if (!root) { root = document.createElement('div'); root.id = 'qt-pdf-export-root'; document.body.appendChild(root); }
    root.style.width = '794px'; root.style.minWidth = '794px';
    root.innerHTML = await buildInvoiceDocHTML(q);
    const pageDivs = Array.from(root.querySelectorAll('.qt-print-doc'));
    pageDivs.forEach(div => {
      div.style.width = '794px'; div.style.minWidth = '794px';
      div.style.height = '1122px'; div.style.minHeight = '1122px';
      div.style.maxHeight = '1122px'; div.style.overflow = 'hidden';
    });
    const filename = `Invoice-${q.invoice_number || q.quotation_number || q.id}.pdf`;
    const opts = { margin: 0, image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2, useCORS: true, scrollX: 0, scrollY: 0, windowWidth: 794, width: 794, height: 1122 }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' } };
    try {
      if (pageDivs.length === 1) { const blob = await html2pdf().set({ ...opts, filename }).from(pageDivs[0]).outputPdf('blob'); return { blob, filename }; }
      const worker = html2pdf().set(opts); await worker.from(pageDivs[0]).toImg().toPdf();
      const pdf = worker.prop.pdf;
      for (let i = 1; i < pageDivs.length; i++) {
        const w2 = html2pdf().set(opts); await w2.from(pageDivs[i]).toImg();
        pdf.addPage(); pdf.addImage(w2.prop.img, 'JPEG', 0, 0, 210, 297);
      }
      return { blob: pdf.output('blob'), filename };
    } finally { root.innerHTML = ''; root.style.width = ''; root.style.minWidth = ''; }
  };

  /* ── WhatsApp ── */
  const handleWhatsApp = async (q) => {
    setShareOpen(null);
    const gt    = Number(q.total_amount || 0);
    const phone = (q.client_phone || '').replace(/\D/g, '');
    const waText = encodeURIComponent(
      `Hello ${q.client_name},\n\nPlease find the attached invoice from *${COMPANY_CONFIG.name} ${COMPANY_CONFIG.nameSuffix}*.\n\n` +
      `*Invoice No.:* ${q.invoice_number || q.quotation_number}\n` +
      `*Grand Total (incl. GST):* ₹${gt.toLocaleString('en-IN')}\n\n` +
      `Kindly process the payment at your earliest convenience.\n\n` +
      `Warm regards,\n${COMPANY_CONFIG.name} ${COMPANY_CONFIG.nameSuffix}\n${COMPANY_CONFIG.phone}`
    );
    const waUrl = `https://wa.me/${phone ? `91${phone}` : ''}?text=${waText}`;
    try {
      const { blob, filename } = await buildPdfBlob(q);
      const file = new File([blob], filename, { type: 'application/pdf' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: `Invoice ${q.invoice_number || q.quotation_number}` });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
        URL.revokeObjectURL(url);
        setTimeout(() => window.open(waUrl, '_blank'), 400);
      }
    } catch (err) { if (err?.name !== 'AbortError') alert('Failed to share: ' + err.message); }
  };

  /* ── Email ── */
  const handleMail = (q) => {
    setShareOpen(null);
    const subject = encodeURIComponent(`Invoice ${q.invoice_number || q.quotation_number} — ${project.name}`);
    const body    = encodeURIComponent(
      `Dear ${q.client_name},\n\nPlease find below the invoice details for project ${project.name}:\n\n` +
      `Invoice No.  : ${q.invoice_number || q.quotation_number}\n` +
      `Date         : ${q.invoice_date || '—'}\n` +
      `Subtotal     : ₹${Number(q.amount || 0).toLocaleString('en-IN')}\n` +
      `GST Amount   : ₹${Number(q.gst_amount || 0).toLocaleString('en-IN')}\n` +
      `Total Amount : ₹${Number(q.total_amount || 0).toLocaleString('en-IN')}\n\n` +
      `Kindly process the payment at the earliest.\n\nWarm regards,\n${COMPANY_CONFIG.name} ${COMPANY_CONFIG.nameSuffix}\n${COMPANY_CONFIG.email}`
    );
    window.location.href = `mailto:${q.client_email || ''}?subject=${subject}&body=${body}`;
  };

  /* ── Filter ── */
  const filtered = invoices.filter(q =>
    q.client_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    q.invoice_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    q.quotation_number?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalVal = invoices.reduce((s, q) => s + (Number(q.total_amount) || 0), 0);

  /* ══════════════════════════════ RENDER ═══════════════════ */
  return (
    <div className="animate-fade">

      {/* Page head */}
      <div className="qt-page-head">
        <div>
          <h1 className="qt-page-title">Invoices</h1>
          <p className="qt-page-sub">
            Invoices start as a copy of an approved quotation, but can be edited independently from here on.
            {invoices.length === 0 && !loading && ' Approve a quotation to see it here.'}
          </p>
        </div>
        {approvedQuotations.length > 0 && (
          <button className="pj-add-btn" onClick={() => setShowNewModal(true)}>
            <Plus size={15} /> New Invoice
          </button>
        )}
      </div>

      {/* Metrics */}
      <div className="qt-metrics">
        <div className="qt-metric">
          <div className="qt-metric-icon" style={{ background: '#ecfdf5', color: '#10b981' }}>
            <Receipt size={17} />
          </div>
          <div className="qt-metric-body">
            <span className="qt-metric-val">{invoices.length}</span>
            <span className="qt-metric-lbl">Total Invoices</span>
          </div>
        </div>
        <div className="qt-metric">
          <div className="qt-metric-icon" style={{ background: '#ecfdf5', color: '#10b981' }}>
            <CheckCircle size={17} />
          </div>
          <div className="qt-metric-body">
            <span className="qt-metric-val">{invoices.length}</span>
            <span className="qt-metric-lbl">Approved</span>
          </div>
        </div>
        <div className="qt-metric">
          <div className="qt-metric-icon" style={{ background: '#eff6ff', color: '#3b82f6' }}>
            <TrendingUp size={17} />
          </div>
          <div className="qt-metric-body">
            <span className="qt-metric-val">{fmt(totalVal)}</span>
            <span className="qt-metric-lbl">Total Value</span>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="qt-toolbar">
        <div className="qt-search-wrap">
          <Search size={14} className="qt-search-icon" />
          <input
            type="text" value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Search client or quotation no…"
            className="qt-search-input"
          />
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="qt-loading">
          <Loader2 size={28} className="db-spin" style={{ color: '#10b981' }} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="qt-empty">
          <Receipt size={42} style={{ color: '#a7f3d0', marginBottom: '0.75rem' }} />
          <p style={{ fontWeight: 600, color: '#0b3d27', marginBottom: '0.4rem' }}>No invoices yet</p>
          <p style={{ fontSize: '0.84rem', color: '#64748b' }}>
            Go to the <strong>Quotations</strong> tab and set a quotation status to <strong>Approved</strong> — an invoice will be created automatically, and you can edit it here anytime.
          </p>
        </div>
      ) : (
        <div className="qt-grid">
          {filtered.map(q => (
            <div key={q.id} className="qt-card">

              {/* Card head */}
              <div className="qt-card-head">
                <span className="qt-card-num">#{q.invoice_number || q.quotation_number}</span>
                <div className="qt-card-actions">

                  {/* Edit */}
                  <button className="qt-card-action-btn" title="Edit invoice" onClick={() => openEditModal(q)}>
                    <Pencil size={13} />
                  </button>

                  {/* Delete */}
                  <button className="qt-card-action-btn" title="Delete invoice" onClick={() => handleDeleteInvoice(q)}>
                    <Trash2 size={13} />
                  </button>

                  {/* Share dropdown */}
                  <div className="qt-share-wrap" ref={shareOpen === q.id ? shareRef : null}>
                    <button
                      className="qt-card-action-btn"
                      title="Share"
                      onClick={() => setShareOpen(prev => prev === q.id ? null : q.id)}
                    >
                      <Share2 size={13} />
                    </button>
                    {shareOpen === q.id && (
                      <div className="qt-share-dropdown">
                        <button className="qt-share-option pdf-opt" onClick={() => handleDownloadPDF(q)}>
                          <FileDown size={14} /> Download PDF
                        </button>
                        <button className="qt-share-option wa-opt" onClick={() => handleWhatsApp(q)}>
                          <MessageCircle size={14} /> WhatsApp (PDF)
                        </button>
                        <button className="qt-share-option" onClick={() => handleMail(q)}>
                          <Mail size={14} /> Email
                        </button>
                        <button className="qt-share-option" onClick={() => handlePrint(q)}>
                          <Printer size={14} /> Print
                        </button>
                      </div>
                    )}
                  </div>

                </div>
              </div>

              {/* Name + type */}
              <div className="qt-card-name-wrap">
                <h2 className="qt-card-name">{q.client_name}</h2>
                <p className="qt-card-client">{q.project_type} Project</p>
              </div>

              {/* Stats */}
              <div className="qt-card-stats">
                <div className="qt-stat">
                  <span className="qt-stat-lbl">Grand Total</span>
                  <span className="qt-stat-val">{fmt(Number(q.total_amount) || 0)}</span>
                </div>
                <div className="qt-stat">
                  <span className="qt-stat-lbl">GST Amount</span>
                  <span className="qt-stat-val">₹{Number(q.gst_amount || 0).toLocaleString('en-IN')}</span>
                </div>
                <div className="qt-stat">
                  <span className="qt-stat-lbl">Date</span>
                  <span className="qt-stat-val">
                    {q.invoice_date
                      ? new Date(q.invoice_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })
                      : '—'}
                  </span>
                </div>
                <div className="qt-stat">
                  <span className="qt-stat-lbl">Items</span>
                  <span className="qt-stat-val">{getItemCount(q)}</span>
                </div>
              </div>

              {/* Footer */}
              <div className="qt-card-footer">
                <div className="qt-card-address">
                  <MapPin size={11} />
                  <span>{q.site_address || 'No address'}</span>
                </div>
                <span style={{
                  fontSize: '0.7rem', fontWeight: 700, padding: '3px 10px',
                  borderRadius: '6px', background: '#ecfdf5', color: '#10b981',
                  textTransform: 'uppercase', letterSpacing: '0.05em'
                }}>
                  {q.invoice_type || 'Full'}
                </span>
              </div>
              {q.quotation_number && (
                <div style={{ fontSize: '0.68rem', color: '#94a3b8', marginTop: '6px' }}>
                  From quotation #{q.quotation_number}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ══════════ EDIT INVOICE MODAL — fully independent from the quotation ══════════ */}
      {showEditModal && form && createPortal(
        <div style={modalOverlayStyle} onClick={e => { if (e.target === e.currentTarget) closeEditModal(); }}>
          <div style={modalBoxStyle('820px')}>
            <form onSubmit={handleSaveInvoice} style={{ display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1 }}>
              <div style={modalHeadStyle}>
                <h3 style={modalTitleStyle}>Edit Invoice</h3>
                <button type="button" style={modalCloseBtnStyle} onClick={closeEditModal}>&times;</button>
              </div>
              <div style={modalBodyStyle}>
                <p style={{ fontSize: '0.78rem', color: '#94a3b8', margin: '0 0 1rem' }}>
                  Changes here only affect this invoice{form.invoice_type !== 'Full' ? ` (${form.invoice_type})` : ''}. The source quotation is never modified.
                </p>

                <div className="qt-form-grid">

                <div className="qt-section-label" style={{ marginTop: 0 }}>Invoice Details</div>

                <div className="form-group">
                  <label>Invoice Number</label>
                  <input type="text" value={form.invoice_number}
                    onChange={e => f('invoice_number', e.target.value)}
                    className="input-field" required />
                </div>
                <div className="form-group">
                  <label>Invoice Type</label>
                  <select value={form.invoice_type} onChange={e => f('invoice_type', e.target.value)} className="input-field">
                    {INVOICE_TYPES.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Invoice Date</label>
                  <input type="date" lang="en-GB" value={form.invoice_date}
                    onChange={e => f('invoice_date', e.target.value)}
                    className="input-field" style={{ colorScheme: 'light' }} />
                </div>

                <div className="qt-section-label">Client Details</div>

                <div className="form-group">
                  <label>Client Name</label>
                  <input type="text" required value={form.client_name}
                    onChange={e => f('client_name', e.target.value)}
                    className="input-field" />
                </div>
                <div className="form-group">
                  <label>Client Email</label>
                  <input type="email" value={form.client_email}
                    onChange={e => f('client_email', e.target.value)}
                    className="input-field" />
                </div>
                <div className="form-group">
                  <label>Client Phone (WhatsApp)</label>
                  <input type="tel" value={form.client_phone}
                    onChange={e => f('client_phone', e.target.value)}
                    className="input-field" />
                </div>
                <div className="form-group">
                  <label>Client GST Number</label>
                  <input type="text" value={form.client_gst}
                    onChange={e => f('client_gst', e.target.value.toUpperCase())}
                    className="input-field" maxLength={15} />
                </div>
                <div className="form-group qt-full">
                  <label>Site Address</label>
                  <input type="text" value={form.site_address}
                    onChange={e => f('site_address', e.target.value)}
                    className="input-field" />
                </div>

                {/* ── LINE ITEMS ── */}
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
                              <input className="qt-item-input" value={it.name}
                                onChange={e => updateItem(it.id, 'name', e.target.value)}
                                placeholder="e.g. Lawn Turf" required />
                            </td>
                            <td>
                              <input className="qt-item-input" value={it.desc}
                                onChange={e => updateItem(it.id, 'desc', e.target.value)}
                                placeholder="Optional detail…" />
                            </td>
                            <td>
                              <input type="number" min="0" step="0.01" className="qt-item-input narrow"
                                value={it.qty} onChange={e => updateItem(it.id, 'qty', e.target.value)} />
                            </td>
                            <td>
                              <select className="qt-item-input med" value={it.unit}
                                onChange={e => updateItem(it.id, 'unit', e.target.value)}>
                                {UNITS.map(u => <option key={u}>{u}</option>)}
                              </select>
                            </td>
                            <td>
                              <input type="number" min="0" step="0.01" className="qt-item-input med"
                                value={it.rate} onChange={e => updateItem(it.id, 'rate', e.target.value)}
                                placeholder="0" />
                            </td>
                            <td>
                              <div className="qt-gst-toggle">
                                <label className="qt-toggle-switch">
                                  <input type="checkbox" checked={it.hasGst}
                                    onChange={e => updateItem(it.id, 'hasGst', e.target.checked)} />
                                  <span className="qt-toggle-slider" />
                                </label>
                                {it.hasGst && (
                                  <select className="qt-gst-pct-input" value={it.gstPct}
                                    onChange={e => updateItem(it.id, 'gstPct', Number(e.target.value))}>
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
                              <button type="button" className="qt-remove-row" onClick={() => removeItem(it.id)}
                                disabled={items.length === 1} title="Remove row">
                                <X size={11} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  <button type="button" className="qt-add-row-btn" onClick={addItem}>
                    <FileText size={13} /> Add Product / Service
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

                <div className="qt-section-label">Additional Info</div>
                <div className="form-group">
                  <label>Notes</label>
                  <input type="text" value={form.notes}
                    onChange={e => f('notes', e.target.value)}
                    className="input-field" placeholder="Optional notes…" />
                </div>
                <div className="form-group qt-full">
                  <label>Payment Terms <span style={{ fontSize: '.72rem', color: '#94a3b8', fontWeight: 400 }}>(one per line)</span></label>
                  <textarea value={form.payment_terms} onChange={e => f('payment_terms', e.target.value)}
                    className="input-field" rows={3} style={{ resize: 'vertical', lineHeight: 1.6 }} />
                </div>
                <div className="form-group qt-full">
                  <label>Terms &amp; Conditions <span style={{ fontSize: '.72rem', color: '#94a3b8', fontWeight: 400 }}>(one per line)</span></label>
                  <textarea value={form.terms_conditions} onChange={e => f('terms_conditions', e.target.value)}
                    className="input-field" rows={3} style={{ resize: 'vertical', lineHeight: 1.6 }} />
                </div>

                </div>
              </div>
              <div style={modalFootStyle}>
                <button type="button" className="btn-secondary" onClick={closeEditModal}>Cancel</button>
                <button type="submit" className="btn-primary">Save Invoice</button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* ══════════ NEW INVOICE (from an approved quotation) MODAL ══════════ */}
      {showNewModal && createPortal(
        <div style={modalOverlayStyle} onClick={e => { if (e.target === e.currentTarget) setShowNewModal(false); }}>
          <div style={modalBoxStyle('440px')}>
            <div style={modalHeadStyle}>
              <h3 style={modalTitleStyle}>New Invoice</h3>
              <button style={modalCloseBtnStyle} onClick={() => setShowNewModal(false)}>&times;</button>
            </div>
            <div style={modalBodyStyle}>
              <p style={{ fontSize: '0.8rem', color: '#64748b', marginTop: 0 }}>
                Creates a fresh invoice copied from the selected quotation's current values — useful for advance, progress, or final billing against the same quotation.
              </p>
              <div className="form-group qt-full">
                <label>Quotation</label>
                <select value={newQuotationId} onChange={e => setNewQuotationId(e.target.value)} className="input-field">
                  <option value="">Select a quotation…</option>
                  {approvedQuotations.map(q => (
                    <option key={q.id} value={q.id}>
                      {q.quotation_number} — {q.client_name} ({fmt(Number(q.total_amount) || 0)})
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group qt-full">
                <label>Invoice Type</label>
                <select value={newInvoiceType} onChange={e => setNewInvoiceType(e.target.value)} className="input-field">
                  {INVOICE_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
            </div>
            <div style={modalFootStyle}>
              <button type="button" className="btn-secondary" onClick={() => setShowNewModal(false)}>Cancel</button>
              <button type="button" className="btn-primary" onClick={handleCreateInvoice} disabled={!newQuotationId || creating}>
                {creating ? 'Creating…' : 'Create Invoice'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}