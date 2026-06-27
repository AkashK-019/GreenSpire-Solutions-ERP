import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Header  from '../components/Header';
import {
  Plus, Search, MapPin, Loader2, FileText,
  IndianRupee, CheckCircle, Clock, XCircle,
  Pencil, Trash2, Share2, Check,
  FileDown, MessageCircle, TrendingUp, X,
  Crosshair, Calculator, Printer
} from 'lucide-react';
import { supabase } from '../supabase';
import html2pdf from 'html2pdf.js';
import '../styles/quotations.css';

const COMPANY_CONFIG = {
  name:            'GreenSpire',
  nameSuffix:      'Solutions',
  tagline:         'Landscaping | Tree Planting | Garden Development',
  logo: 'https://ik.imagekit.io/greenspire/GreenSpire%20Solutions%20/logo.png?updatedAt=1782207314550',
  address:         'Shop No. 18, Shivkala Arcade, Tarapur Road, Boisar, Palghar - 401501, Maharashtra, India',
  phone:           '808-095-6853',
  email:           'greenspire.solutions23@gmail.com',
  gstNumber:       '27FASPK9418R1ZF',
  bank: {
    bankName:  'ICICI BANK',
    branch:    'ICIC0000063 (Boisar)',
    accountNo: '006305008965',
    vpa:       'greenspiresolutions.ibz@icici',
  },
  paymentTerms: [
    '70% Advance at order confirmation',
    'Remaining 30% on completion of work',
  ],
  termsAndConditions: [
    'Late payments may result in a 2% penalty fee.',
  ],
};

/* ── Constants ─────────────────────────────────────────── */
const PROJECT_TYPES  = ['Residential', 'Commercial', 'Industrial', 'Maintenance', 'Plantation'];
const STATUS_FILTERS = ['All', 'Pending', 'Approved', 'Rejected'];
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

const BLANK_FORM = {
  quotation_number: '', client_name: '', client_email: '', client_phone: '',
  client_gst: '',
  project_name: '', project_type: 'Residential', site_address: '',
  map_location: '', plot_area: '',
  start_date: '', completion_date: '',
  scope_of_work: '',
  validity_days: '30',
  quotation_date: new Date().toISOString().split('T')[0],
  notes: '',
  payment_terms: COMPANY_CONFIG.paymentTerms.join('\n'),
  terms_conditions: COMPANY_CONFIG.termsAndConditions.join('\n'),
};

// Area conversion — base unit: square feet (matches Projects.jsx)
const AREA_UNITS = {
  sqft:   { label: 'Square Feet',  toSqft: 1 },
  sqm:    { label: 'Square Meter', toSqft: 10.7639 },
  acre:   { label: 'Acre',         toSqft: 43560 },
  guntha: { label: 'Guntha',       toSqft: 1089 },
};

/* ── Helpers ────────────────────────────────────────────── */
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
    subtotal  += amount;
    totalGst  += gst;
  });
  return {
    subtotal:    parseFloat(subtotal.toFixed(2)),
    totalGst:    parseFloat(totalGst.toFixed(2)),
    grandTotal:  parseFloat((subtotal + totalGst).toFixed(2)),
  };
};

/* ── Financial year helper ──────────────────────────────── */
// Indian FY: April–March. FY 2025-26 → "2526"
const getCurrentFY = () => {
  const now = new Date();
  const yr  = now.getFullYear();
  const mo  = now.getMonth() + 1; // 1-12
  const fyStart = mo >= 4 ? yr : yr - 1;
  const fyEnd   = fyStart + 1;
  return `${String(fyStart).slice(-2)}${String(fyEnd).slice(-2)}`; // e.g. "2526"
};

/* ── Auto quotation number — sequential within the FY ─── */
// Queries Supabase for the last QT-YYYY-NNN in this FY, then increments.
// Falls back to QT-YYYY-001 if nothing exists yet.
const genQuotationNumber = async (supabaseClient) => {
  const fy     = getCurrentFY();
  const prefix = `QT-${fy}-`;
  try {
    const { data } = await supabaseClient
      .from('quotations')
      .select('quotation_number')
      .like('quotation_number', `${prefix}%`)
      .order('quotation_number', { ascending: false })
      .limit(1);

    if (data && data.length > 0) {
      const last = data[0].quotation_number; // e.g. "QT-2526-007"
      const lastNum = parseInt(last.replace(prefix, ''), 10);
      const next    = isNaN(lastNum) ? 1 : lastNum + 1;
      return `${prefix}${String(next).padStart(3, '0')}`;
    }
  } catch {/* fallthrough */}
  return `${prefix}001`;
};

/* ═══════════════════════════════════════════════════════════
   COMPONENT
═══════════════════════════════════════════════════════════ */
export default function Quotations() {
  const navigate                    = useNavigate();
  const [loading, setLoading]       = useState(true);
  const [quotations, setQuotations] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [showModal, setShowModal]   = useState(false);
  const [editingId, setEditingId]   = useState(null);
  const [form, setForm]             = useState(BLANK_FORM);
  const [items, setItems]           = useState([blankItem()]);
  const [shareOpen, setShareOpen]   = useState(null);
  const [approveTarget, setApproveTarget] = useState(null);
  const [approving, setApproving]   = useState(false);
  const [locating, setLocating]       = useState(false);
  const [showAreaCalc, setShowAreaCalc] = useState(false);
  const [calcValue, setCalcValue]     = useState('');
  const [calcFrom, setCalcFrom]       = useState('sqft');
  const shareRef                    = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (shareRef.current && !shareRef.current.contains(e.target)) setShareOpen(null);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  /* ── Fetch ── */
  useEffect(() => { fetchQuotations(); }, []);

  const fetchQuotations = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('quotations')
        .select('*')
        .is('project_id', null)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setQuotations(data || []);
    } catch (err) {
      console.error('Error fetching quotations:', err);
    } finally {
      setLoading(false);
    }
  };

  /* ── Form helpers ── */
  const f = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  /* ── Item helpers ── */
  const addItem = () => setItems(prev => [...prev, blankItem()]);

  const removeItem = (id) => setItems(prev => prev.filter(it => it.id !== id));

  const updateItem = (id, field, value) =>
    setItems(prev => prev.map(it => it.id === id ? { ...it, [field]: value } : it));

  /* ── Use current location for Google Maps URL ── */
  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        const url = `https://www.google.com/maps?q=${latitude},${longitude}`;
        f('map_location', url);
        setLocating(false);
      },
      (err) => {
        alert('Unable to get location: ' + err.message);
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  /* ── Plot area unit converter ── */
  const getConvertedAreas = () => {
    const val = Number(calcValue) || 0;
    const sqft = val * AREA_UNITS[calcFrom].toSqft;
    return {
      sqft:   sqft,
      sqm:    sqft / AREA_UNITS.sqm.toSqft,
      acre:   sqft / AREA_UNITS.acre.toSqft,
      guntha: sqft / AREA_UNITS.guntha.toSqft,
    };
  };

  const applyCalculatedArea = () => {
    const sqft = getConvertedAreas().sqft;
    f('plot_area', Math.round(sqft));
    setShowAreaCalc(false);
    setCalcValue('');
  };

  const openAddModal = async () => {
    const qtNum = await genQuotationNumber(supabase);
    setForm({ ...BLANK_FORM, quotation_number: qtNum });
    setItems([blankItem()]);
    setEditingId(null);
    setShowModal(true);
  };

  const openEditModal = (q) => {
    setForm({
      quotation_number: q.quotation_number || '',
      client_name:      q.client_name      || '',
      client_email:     q.client_email     || '',
      client_phone:     q.client_phone     || '',
      client_gst:       q.client_gst       || '',
      project_name:     q.project_name     || '',
      project_type:     q.project_type     || 'Residential',
      site_address:     q.site_address     || '',
      map_location:     q.map_location     || '',
      plot_area:        q.plot_area        || '',
      start_date:       q.start_date       || '',
      completion_date:  q.completion_date  || '',
      scope_of_work:    q.scope_of_work    || '',
      validity_days:    q.validity_days    ?? '30',
      quotation_date:   q.quotation_date   || new Date().toISOString().split('T')[0],
      notes:            q.notes            || '',
      payment_terms:    q.payment_terms    || COMPANY_CONFIG.paymentTerms.join('\n'),
      terms_conditions: q.terms_conditions || COMPANY_CONFIG.termsAndConditions.join('\n'),
    });
    // Parse saved line items if available
    try {
      const parsed = q.line_items ? JSON.parse(q.line_items) : null;
      let savedItems = null;
      if (parsed && !Array.isArray(parsed) && parsed.items) {
        savedItems = parsed.items; // new format
      } else if (Array.isArray(parsed)) {
        savedItems = parsed; // legacy format
      }
      setItems(savedItems && savedItems.length > 0 ? savedItems.map(i => ({ ...i, id: Date.now() + Math.random() })) : [blankItem()]);
    } catch {
      setItems([blankItem()]);
    }
    setEditingId(q.id);
    setShowModal(true);
  };

  const closeModal = () => { setShowModal(false); setEditingId(null); setForm(BLANK_FORM); setItems([blankItem()]); };

  /* ── Live totals ── */
  const totals = calcTotals(items);

  /* ── Save ── */
  const handleSave = async (e) => {
    e.preventDefault();

    const { subtotal, totalGst, grandTotal } = totals;

    const payload = {
      quotation_number: form.quotation_number,
      client_name:      form.client_name,
      client_email:     form.client_email  || null,
      client_phone:     form.client_phone  || null,
      client_gst:       form.client_gst    || null,
      project_name:     form.project_name  || null,
      project_type:     form.project_type,
      site_address:     form.site_address  || null,
      map_location:     form.map_location  || null,
      plot_area:        form.plot_area     ? Number(form.plot_area) : null,
      start_date:       form.start_date    || null,
      completion_date:  form.completion_date || null,
      scope_of_work:    form.scope_of_work || null,
      amount:           subtotal,
      gst_percent:      items.some(i => i.hasGst) ? (items.find(i => i.hasGst)?.gstPct || 0) : 0,
      gst_amount:       totalGst,
      total_amount:     grandTotal,
      validity_days:    Number(form.validity_days) || 30,
      quotation_date:   form.quotation_date || null,
      notes:            form.notes || null,
      payment_terms:    form.payment_terms || null,
      terms_conditions: form.terms_conditions || null,
      status:           'Pending',
      project_id:       null,
      line_items:       JSON.stringify({ __meta: { client_gst: form.client_gst || null }, items }),
    };

    try {
      if (editingId) {
        delete payload.status;
        const { error } = await supabase.from('quotations').update(payload).eq('id', editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('quotations').insert([payload]);
        if (error) throw error;
      }
      closeModal();
      fetchQuotations();
    } catch (err) {
      alert(err.message || 'Failed to save quotation');
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

  /* ── Approve → Convert to Project ── */
  const handleApprove = async () => {
    if (!approveTarget) return;
    setApproving(true);
    const q = approveTarget;
    try {
      const { data: proj, error: projErr } = await supabase
        .from('projects')
        .insert([{
          name:         q.project_name || `${q.client_name} — ${q.project_type} Project`,
          client_name:  q.client_name,
          client_email: q.client_email || null,
          client_phone: q.client_phone || null,
          type:         q.project_type || 'Residential',
          site_address: q.site_address || null,
          map_location: q.map_location || null,
          plot_area:    q.plot_area || null,
          start_date:   q.start_date || null,
          completion_date: q.completion_date || null,
          budget:       q.total_amount || q.amount || 0,
          status:       'Pending',
        }])
        .select()
        .single();
      if (projErr) throw projErr;

      const { error: qErr } = await supabase
        .from('quotations')
        .update({ status: 'Approved', converted_project_id: proj.id })
        .eq('id', q.id);
      if (qErr) throw qErr;

      setApproveTarget(null);
      setApproving(false);
      fetchQuotations();
      navigate('/projects');
    } catch (err) {
      setApproving(false);
      alert('Failed to approve: ' + err.message);
    }
  };

  /* ── Build print items from saved line_items or legacy amount ── */
  const getPrintItems = (q) => {
    try {
      if (q.line_items) {
        const parsed = JSON.parse(q.line_items);
        // New format: { __meta: {...}, items: [...] }
        if (parsed && !Array.isArray(parsed) && parsed.items) {
          return { items: parsed.items, meta: parsed.__meta || {} };
        }
        // Legacy format: plain array
        if (Array.isArray(parsed)) {
          return { items: parsed, meta: {} };
        }
      }
    } catch {}
    return { items: null, meta: {} };
  };

  /* ── Shared document builder — used by Print, Download PDF, and Share ──
     Builds one explicit A4 <div> per page in JavaScript so html2pdf never
     has to guess where to slice.  Every page carries:
       • full header  (logo + QUOTATION title + meta)
       • a table with thead repeated
     Page 1 additionally has: client info band + scope of work
     Last page additionally has: totals + payment terms + signature + footer
  ── */
  const buildQuotationDocHTML = async (q) => {
    const { items: lineItems, meta } = getPrintItems(q);
    // client_gst: prefer DB column, fall back to embedded meta (for DBs missing the column)
    const clientGst = q.client_gst || meta.client_gst || null;

    const { subtotal, totalGst, grandTotal } = lineItems
      ? calcTotals(lineItems)
      : { subtotal: Number(q.amount || 0), totalGst: Number(q.gst_amount || 0), grandTotal: Number(q.total_amount || 0) };

    const dateStr = q.quotation_date
      ? new Date(q.quotation_date).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
      : '—';

    // Validity date
    const validUntilStr = (() => {
      const d = new Date(q.quotation_date || Date.now());
      d.setDate(d.getDate() + Number(q.validity_days || 30));
      return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    })();

    // ── Amount in words ──
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

    // ── Build all item rows as HTML strings ──
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

    // ── Reusable snippet builders ──
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

    // ── Page footer HTML (appears on ALL pages) ──
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

    // ── Dynamic height-based pagination ──
    // A4 at 96dpi = 1122px. We subtract a generous safety margin (48px)
    // to account for sub-pixel rendering differences in html2pdf / chrome.
    const A4_PX = 1122 - 48;   // 1074px effective page height
    const ROW_SAFETY_PX = 8;   // extra pad per row

    const sandbox = document.createElement('div');
    sandbox.style.cssText = [
      'position:fixed', 'top:0', 'left:-9999px', 'z-index:-1',
      'width:794px',
      'visibility:hidden', 'pointer-events:none',
      'font-family:Inter,Arial,sans-serif', 'font-size:12.5pt',
    ].join(';');
    document.body.appendChild(sandbox);

    const measureHTML = (html) => {
      sandbox.innerHTML = html;
      const el = sandbox.firstElementChild;
      if (!el) return 0;
      return el.getBoundingClientRect().height;
    };

    const realHeaderH = measureHTML(`<div style="width:794px"><div class="qtp-header" style="height:100px"></div></div>`);

    const realInfoBandH = q.client_name || q.site_address || q.client_phone || q.client_email || clientGst || q.project_name || q.plot_area || q.start_date || q.completion_date
      ? measureHTML(`<div>
          <div class="qtp-info-band">
            <div class="qtp-billed-col">
              <div class="qtp-band-label">BILLED TO</div>
              <div class="qtp-billed-name">${(q.client_name||'—').toUpperCase()}</div>
              ${q.site_address?`<div class="qtp-billed-addr">${q.site_address}</div>`:''}
              ${q.client_phone?`<div class="qtp-billed-contact">📞 ${q.client_phone}</div>`:''}
              ${q.client_email?`<div class="qtp-billed-contact">✉ ${q.client_email}</div>`:''}
              ${clientGst?`<div class="qtp-billed-gst">GST No.: ${clientGst}</div>`:''}
            </div>
            <div class="qtp-project-col">
              <div class="qtp-band-label">PROJECT DETAILS</div>
              ${q.project_name?`<div class="qtp-proj-row"><span class="qtp-proj-key">Project Name</span><span class="qtp-proj-val">${q.project_name}</span></div>`:''}
              <div class="qtp-proj-row"><span class="qtp-proj-key">Project Type</span><span class="qtp-proj-val">${q.project_type||'—'}</span></div>
              ${q.plot_area?`<div class="qtp-proj-row"><span class="qtp-proj-key">Plot Area</span><span class="qtp-proj-val">${Number(q.plot_area).toLocaleString('en-IN')} Sq.Ft</span></div>`:''}
              ${q.start_date?`<div class="qtp-proj-row"><span class="qtp-proj-key">Start Date</span><span class="qtp-proj-val">${new Date(q.start_date).toLocaleDateString('en-GB')}</span></div>`:''}
              ${q.completion_date?`<div class="qtp-proj-row"><span class="qtp-proj-key">Est. Completion</span><span class="qtp-proj-val">${new Date(q.completion_date).toLocaleDateString('en-GB')}</span></div>`:''}
              ${q.validity_days?`<div class="qtp-proj-row"><span class="qtp-proj-key">Valid Until</span><span class="qtp-proj-val">${validUntilStr}</span></div>`:''}
            </div>
          </div>
        </div>`)
      : 0;

    const scopeH = q.scope_of_work
      ? measureHTML(`<div class="qtp-scope"><div class="qtp-section-head">Scope of Work</div><div class="qtp-scope-text">${q.scope_of_work}</div></div>`)
      : 0;

    const tableHeadH = measureHTML(`<table class="qtp-items-print-table" style="width:746px">${tableHead()}</table>`);
    const sectionLabelH = measureHTML(`<div class="qtp-section-head" style="margin-bottom:12px">Bill of Quantities</div>`);

    // Measure totals band (last page only — reserved together with bottomGridH as lastPageExtra)
    const totalsBlockH = measureHTML(`
      <div>
        <div class="qtp-totals-band" style="margin:0 24px;">
          <div class="qtp-amount-words"><span class="qtp-words-label">Amount in Words:</span><span class="qtp-words-text">${amountInWords}</span></div>
          <table class="qtp-fin-table">
            <tr><td class="fin-label">Subtotal</td><td class="fin-value">₹0.00</td></tr>
            <tr><td class="fin-label">CGST</td><td class="fin-value">₹0.00</td></tr>
            <tr><td class="fin-label">SGST</td><td class="fin-value">₹0.00</td></tr>
            <tr class="qtp-fin-total"><td class="fin-label">GRAND TOTAL</td><td class="fin-value">₹0.00</td></tr>
          </table>
        </div>
      </div>`);

    // Bottom grid (payment terms + signature + T&C + validity + optional notes) — last page only
    const bottomGridH = measureHTML(`
      <div>
        ${q.notes ? `<div class="qtp-notes-block"><div class="qtp-section-head">Notes</div><ul class="qtp-notes-list"><li>${q.notes}</li></ul></div>` : ''}
        <div class="qtp-bottom-grid">
          <div class="qtp-terms-left">
            <div class="qtp-terms-section">
              <div class="qtp-terms-head">Payment Terms</div>
              ${(q.payment_terms || COMPANY_CONFIG.paymentTerms.join('\n'))
                  .split('\n').filter(t => t.trim())
                  .map((t, i) => `<div class="qtp-pay-term"><span class="qtp-term-num">${i + 1}</span><span>${t.trim()}</span></div>`).join('')}
            </div>
            <div class="qtp-terms-section">
              <div class="qtp-terms-head">Terms &amp; Conditions</div>
              ${(q.terms_conditions || COMPANY_CONFIG.termsAndConditions.join('\n'))
                  .split('\n').filter(t => t.trim())
                  .map(t => `<div class="qtp-tc-item">• ${t.trim()}</div>`).join('')}
            </div>
          </div>
          <div class="qtp-sig-block">
            <div class="qtp-sig-space"></div>
            <div class="qtp-sig-bottom">
              <div class="qtp-sig-line"></div>
              <div class="qtp-sig-label-row">
                <div class="qtp-sig-label">Authorised Signatory</div>
                <div class="qtp-sig-company-name">${COMPANY_CONFIG.name} ${COMPANY_CONFIG.nameSuffix}</div>
              </div>
            </div>
          </div>
        </div>
        <div class="qtp-validity-strip">Validity strip text goes here for measurement purposes</div>
      </div>`) + 8; // +8px safety

    // Footer is position:absolute — it doesn't take flow space, but qtp-page-body has
    // padding-bottom:56px to prevent content sliding under it. Use 56px as the reserved height.
    const pageFooterH = 56;
    const contLabelH = measureHTML(`<div class="qtp-continuation-label">Bill of Quantities (continued)</div>`);

    // Measure each item row individually
    const itemRowHeights = allItemRows.map(rowHTML =>
      measureHTML(`<table class="qtp-items-print-table" style="width:746px"><tbody>${rowHTML}</tbody></table>`) + ROW_SAFETY_PX
    );

    document.body.removeChild(sandbox);

    // ── Pre-compute totals ──
    const totalItemsH      = itemRowHeights.reduce((s, h) => s + h, 0);

    // Chrome heights (fixed content per page type)
    const p1Chrome         = realHeaderH + realInfoBandH + scopeH + sectionLabelH + tableHeadH + pageFooterH;
    const contChrome       = realHeaderH + contLabelH + tableHeadH + pageFooterH;
    const sigPageChrome    = realHeaderH + pageFooterH; // signature page has no items

    // What fits on page 1 with totals included?
    const p1WithTotals     = p1Chrome + totalItemsH + totalsBlockH;
    // Does everything including signature fit on one page?
    const everythingFits   = p1Chrome + totalItemsH + totalsBlockH + bottomGridH <= A4_PX;
    // Do items+totals fit on page 1, but signature doesn't?
    const totalsOnP1       = !everythingFits && p1WithTotals <= A4_PX;

    // ── Reusable HTML snippets ──

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
          <div class="qtp-doc-title">QUOTATION</div>
          <table class="qtp-meta-table">
            <tr><td class="qtp-meta-key">Quot. No.</td><td class="qtp-meta-val"><strong>${q.quotation_number || '—'}</strong></td></tr>
            <tr><td class="qtp-meta-key">Date</td><td class="qtp-meta-val"><strong>${dateStr}</strong></td></tr>
            <tr><td class="qtp-meta-key">GST No.</td><td class="qtp-meta-val"><strong>${COMPANY_CONFIG.gstNumber}</strong></td></tr>
            ${total > 1 ? `<tr><td class="qtp-meta-key">Page</td><td class="qtp-meta-val"><strong>${pageNum} / ${total}</strong></td></tr>` : ''}
          </table>
        </div>
      </div>`;

    const totalsBandHTML = `
      <div class="qtp-totals-band">
        <div class="qtp-amount-words">
          <span class="qtp-words-label">Amount in Words</span>
          <span class="qtp-words-text">${amountInWords}</span>
        </div>
        <table class="qtp-fin-table">
          <tr><td class="fin-label">Subtotal (excl. GST)</td><td class="fin-value">₹${subtotal.toLocaleString('en-IN', {minimumFractionDigits:2})}</td></tr>
          <tr><td class="fin-label">CGST</td><td class="fin-value">₹${(totalGst / 2).toLocaleString('en-IN', {minimumFractionDigits:2})}</td></tr>
          <tr><td class="fin-label">SGST</td><td class="fin-value">₹${(totalGst / 2).toLocaleString('en-IN', {minimumFractionDigits:2})}</td></tr>
          <tr class="qtp-fin-total"><td class="fin-label">GRAND TOTAL</td><td class="fin-value">₹${grandTotal.toLocaleString('en-IN', {minimumFractionDigits:2})}</td></tr>
        </table>
      </div>`;

    const signatureSectionHTML = `
      ${q.notes ? `
      <div class="qtp-notes-block">
        <div class="qtp-section-head">Notes</div>
        <ul class="qtp-notes-list"><li>${q.notes.replace(/\n/g, '</li><li>')}</li></ul>
      </div>` : ''}
      <div class="qtp-bottom-grid">
        <div class="qtp-terms-left">
          <div class="qtp-terms-section">
            <div class="qtp-terms-head">Payment Terms</div>
            ${(q.payment_terms || COMPANY_CONFIG.paymentTerms.join('\n'))
                .split('\n').filter(t => t.trim())
                .map((t, i) => `<div class="qtp-pay-term"><span class="qtp-term-num">${i + 1}</span><span>${t.trim()}</span></div>`).join('')}
          </div>
          <div class="qtp-terms-section">
            <div class="qtp-terms-head">Terms &amp; Conditions</div>
            ${(q.terms_conditions || COMPANY_CONFIG.termsAndConditions.join('\n'))
                .split('\n').filter(t => t.trim())
                .map(t => `<div class="qtp-tc-item">• ${t.trim()}</div>`).join('')}
          </div>
        </div>
        <div class="qtp-sig-block">
          <div class="qtp-sig-space"></div>
          <div class="qtp-sig-bottom">
            <div class="qtp-sig-line"></div>
            <div class="qtp-sig-label-row">
              <div class="qtp-sig-label">Authorised Signatory</div>
              <div class="qtp-sig-company-name">${COMPANY_CONFIG.name} ${COMPANY_CONFIG.nameSuffix}</div>
            </div>
          </div>
        </div>
      </div>
      <div class="qtp-validity-strip">
        This quotation is valid until <strong>${validUntilStr}</strong>. Prices are subject to change after the validity period.
      </div>`;

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
          ${q.validity_days ? `<div class="qtp-proj-row"><span class="qtp-proj-key">Valid Until</span><span class="qtp-proj-val">${validUntilStr}</span></div>` : ''}
        </div>
      </div>
      ${q.scope_of_work ? `
      <div class="qtp-scope">
        <div class="qtp-section-head">Scope of Work</div>
        <div class="qtp-scope-text">${q.scope_of_work}</div>
      </div>` : ''}`;

    // ════════════════════════════════════════════════════
    // SCENARIO 2 — everything (items + totals + signature) fits on page 1
    // ════════════════════════════════════════════════════
    if (everythingFits) {
      return `<div class="qt-print-wrapper">
        <div class="qt-print-doc">
          ${pageHeaderFinal(1, 1)}
          <div class="qtp-page-body">
            ${clientInfoBandHTML}
            <div class="qtp-financials">
              <div class="qtp-section-head" style="margin-bottom:12px">Bill of Quantities</div>
              <table class="qtp-items-print-table">
                ${tableHead()}
                <tbody>${allItemRows.join('')}</tbody>
              </table>
            </div>
            ${totalsBandHTML}
            ${signatureSectionHTML}
          </div>
          ${pageFooterHTML}
        </div>
      </div>`;
    }

    // ════════════════════════════════════════════════════
    // SCENARIO 1 — items + totals fit on page 1, signature needs page 2
    // ════════════════════════════════════════════════════
    if (totalsOnP1) {
      return `<div class="qt-print-wrapper">
        <div class="qt-print-doc qtp-page-break">
          ${pageHeaderFinal(1, 2)}
          <div class="qtp-page-body">
            ${clientInfoBandHTML}
            <div class="qtp-financials">
              <div class="qtp-section-head" style="margin-bottom:12px">Bill of Quantities</div>
              <table class="qtp-items-print-table">
                ${tableHead()}
                <tbody>${allItemRows.join('')}</tbody>
              </table>
            </div>
            ${totalsBandHTML}
          </div>
          ${pageFooterHTML}
        </div>
        <div class="qt-print-doc">
          ${pageHeaderFinal(2, 2)}
          <div class="qtp-page-body">
            <div class="qtp-financials qtp-financials-cont">
              <div class="qtp-continuation-label">Summary &amp; Authorisation</div>
            </div>
            ${totalsBandHTML}
            ${signatureSectionHTML}
          </div>
          ${pageFooterHTML}
        </div>
      </div>`;
    }

    // ════════════════════════════════════════════════════
    // SCENARIO 3 — items overflow across multiple pages
    //
    // Packing strategy (two-pass):
    //
    // Pass 1 — try to fit items + totals + signature all on the last item page.
    //   • For each row, if it's the last row, reserve totalsBlockH + bottomGridH.
    //   • If that fits → no extra page needed (sigFitsOnLastPage = true).
    //
    // Pass 2 — if signature didn't fit alongside totals, fall back: reserve
    //   only totalsBlockH on the last item page, and add a dedicated sig page.
    // ════════════════════════════════════════════════════

    const packRows = (reserveOnLastRow) => {
      const buckets = [];
      let   bucket  = [];
      let   used    = p1Chrome;

      for (let i = 0; i < itemRowHeights.length; i++) {
        const rowH      = itemRowHeights[i];
        const isLastRow = i === itemRowHeights.length - 1;
        const needed    = isLastRow ? rowH + reserveOnLastRow : rowH;

        if (used + needed <= A4_PX || bucket.length === 0) {
          bucket.push(allItemRows[i]);
          used += rowH;
        } else {
          buckets.push({ rows: bucket, usedPx: used });
          bucket = [allItemRows[i]];
          used   = contChrome + rowH;
        }
      }
      if (bucket.length > 0) buckets.push({ rows: bucket, usedPx: used });
      if (buckets.length === 0) buckets.push({ rows: [], usedPx: p1Chrome });
      return buckets;
    };

    // Pass 1 — attempt to place totals + signature on the last item page
    const bucketsWithSig = packRows(totalsBlockH + bottomGridH);
    const lastBucketWithSig = bucketsWithSig[bucketsWithSig.length - 1];
    const sigFitsOnLastPage =
      lastBucketWithSig.usedPx + totalsBlockH + bottomGridH <= A4_PX;

    // Use the appropriate pack based on whether sig fits
    const itemPageBuckets = sigFitsOnLastPage
      ? bucketsWithSig.map(b => b.rows)
      : packRows(totalsBlockH).map(b => b.rows);

    const needsSigPage  = !sigFitsOnLastPage;
    const totalPages    = itemPageBuckets.length + (needsSigPage ? 1 : 0);

    const itemPageDivs = itemPageBuckets.map((rows, idx) => {
      const pageNum  = idx + 1;
      const isFirst  = pageNum === 1;
      const isLastIP = pageNum === itemPageBuckets.length; // last item page gets totals

      const contLabel = !isFirst
        ? `<div class="qtp-continuation-label">Bill of Quantities <span class="qtp-cont-page">(continued — page ${pageNum} of ${totalPages})</span></div>`
        : '';

      // Last item page: always show totals.
      // Also show signature here if it fits (sigFitsOnLastPage).
      return `
        <div class="qt-print-doc${needsSigPage || !isLastIP ? ' qtp-page-break' : ''}">
          ${pageHeaderFinal(pageNum, totalPages)}
          <div class="qtp-page-body">
            ${isFirst ? clientInfoBandHTML : ''}
            <div class="qtp-financials${isFirst ? '' : ' qtp-financials-cont'}">
              ${isFirst ? '<div class="qtp-section-head" style="margin-bottom:12px">Bill of Quantities</div>' : contLabel}
              <table class="qtp-items-print-table">
                ${tableHead()}
                <tbody>${rows.join('')}</tbody>
              </table>
            </div>
            ${isLastIP ? totalsBandHTML : ''}
            ${isLastIP && sigFitsOnLastPage ? signatureSectionHTML : ''}
          </div>
          ${pageFooterHTML}
        </div>`;
    });

    // Only add a dedicated signature page when signature didn't fit on the last item page
    const signaturePage = needsSigPage ? `
      <div class="qt-print-doc">
        ${pageHeaderFinal(totalPages, totalPages)}
        <div class="qtp-page-body">
          <div class="qtp-financials qtp-financials-cont">
            <div class="qtp-continuation-label">Summary &amp; Authorisation</div>
          </div>
          ${totalsBandHTML}
          ${signatureSectionHTML}
        </div>
        ${pageFooterHTML}
      </div>` : '';

    return `<div class="qt-print-wrapper">${itemPageDivs.join('')}${signaturePage}</div>`;
  };

  /* ── Share: Print → Save as PDF (browser dialog, no extra deps) ── */
  const handlePrint = async (q) => {
    setShareOpen(null);
    let root = document.getElementById('qt-print-root');
    if (!root) { root = document.createElement('div'); root.id = 'qt-print-root'; document.body.appendChild(root); }
    root.innerHTML = await buildQuotationDocHTML(q);
    setTimeout(() => window.print(), 100);
  };

  /* ── Download an actual PDF file (html2pdf) — one click, no print dialog ── */
  const handleDownloadPDF = async (q) => {
    setShareOpen(null);
    let root = document.getElementById('qt-pdf-export-root');
    if (!root) { root = document.createElement('div'); root.id = 'qt-pdf-export-root'; document.body.appendChild(root); }
    root.innerHTML = await buildQuotationDocHTML(q);

    const pageDivs = Array.from(root.querySelectorAll('.qt-print-doc'));
    // Force exact integer px — 297mm @ 96dpi = 1122.52px (fractional causes blank pages)
    pageDivs.forEach(div => {
      div.style.height    = '1122px';
      div.style.minHeight = '1122px';
      div.style.maxHeight = '1122px';
    });

    const filename = `Quotation-${q.quotation_number || q.id}.pdf`;
    const opts = {
      margin: 0,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, scrollX: 0, scrollY: 0 },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
    };

    try {
      if (pageDivs.length === 1) {
        // Single page — straightforward
        await html2pdf().set({ ...opts, filename }).from(pageDivs[0]).save();
      } else {
        // Multi-page — render each div to a data-URI then combine into one PDF
        // html2pdf bundles jsPDF; get it from the worker's internal pdf object
        const worker = html2pdf().set(opts);
        // Get first page as PDF instance
        await worker.from(pageDivs[0]).toImg().toPdf();
        const pdfInstance = worker.prop.pdf;
        // Add remaining pages
        for (let i = 1; i < pageDivs.length; i++) {
          const w2 = html2pdf().set(opts);
          await w2.from(pageDivs[i]).toImg();
          const imgData = w2.prop.img;
          pdfInstance.addPage();
          pdfInstance.addImage(imgData, 'JPEG', 0, 0, 210, 297);
        }
        pdfInstance.save(filename);
      }
    } catch (err) {
      alert('Failed to generate PDF: ' + err.message);
    } finally {
      root.innerHTML = '';
    }
  };

  /* ── PDF blob builder — shared by WhatsApp and Mail ── */
  const buildPdfBlob = async (q) => {
    let root = document.getElementById('qt-pdf-export-root');
    if (!root) { root = document.createElement('div'); root.id = 'qt-pdf-export-root'; document.body.appendChild(root); }
    root.innerHTML = await buildQuotationDocHTML(q);

    const pageDivs = Array.from(root.querySelectorAll('.qt-print-doc'));
    pageDivs.forEach(div => {
      div.style.height    = '1122px';
      div.style.minHeight = '1122px';
      div.style.maxHeight = '1122px';
    });

    const filename = `Quotation-${q.quotation_number || q.id}.pdf`;
    const opts = {
      margin: 0,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, scrollX: 0, scrollY: 0 },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
    };

    try {
      if (pageDivs.length === 1) {
        const blob = await html2pdf().set({ ...opts, filename }).from(pageDivs[0]).outputPdf('blob');
        return { blob, filename };
      }
      const worker = html2pdf().set(opts);
      await worker.from(pageDivs[0]).toImg().toPdf();
      const pdfInstance = worker.prop.pdf;
      for (let i = 1; i < pageDivs.length; i++) {
        const w2 = html2pdf().set(opts);
        await w2.from(pageDivs[i]).toImg();
        const imgData = w2.prop.img;
        pdfInstance.addPage();
        pdfInstance.addImage(imgData, 'JPEG', 0, 0, 210, 297);
      }
      const blob = pdfInstance.output('blob');
      return { blob, filename };
    } finally {
      root.innerHTML = '';
    }
  };

  /* ── Share: WhatsApp ──
     If the browser supports file sharing (Web Share API with files) — which
     includes Chrome/Edge on Android, iOS Safari, and Chrome on some desktops —
     we share the PDF file directly so it lands in WhatsApp with one tap.
     Fallback: open WhatsApp Web pre-filled with the client's number and message;
     the user selects the chat and presses Send. ── */
  const handleWhatsApp = async (q) => {
    setShareOpen(null);
    const gt    = Number(q.total_amount || 0);
    const phone = (q.client_phone || '').replace(/\D/g, '');
    const waText = encodeURIComponent(
      `Hello ${q.client_name},\n\nPlease find the attached quotation from *${COMPANY_CONFIG.name} ${COMPANY_CONFIG.nameSuffix}*.\n\n` +
      `*Quotation No.:* ${q.quotation_number}\n` +
      `*Grand Total (incl. GST):* ₹${gt.toLocaleString('en-IN')}\n\n` +
      `Kindly review the quotation at your earliest convenience and confirm to proceed.\n\n` +
      `Should you have any questions or require further clarification, please do not hesitate to reach out.\n\n` +
      `Warm regards,\n${COMPANY_CONFIG.name} ${COMPANY_CONFIG.nameSuffix}\n${COMPANY_CONFIG.phone}`
    );
    const waUrl = `https://wa.me/${phone ? `91${phone}` : ''}?text=${waText}`;

    try {
      const { blob, filename } = await buildPdfBlob(q);
      const file = new File([blob], filename, { type: 'application/pdf' });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        // Browser supports file sharing — PDF goes directly into WhatsApp
        await navigator.share({ files: [file], title: `Quotation ${q.quotation_number}` });
      } else {
        // Fallback: open WhatsApp Web with phone + message pre-filled,
        // and silently download the PDF so the user can attach it there
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = filename; a.click();
        URL.revokeObjectURL(url);
        setTimeout(() => window.open(waUrl, '_blank'), 400);
      }
    } catch (err) {
      if (err?.name !== 'AbortError') alert('Failed to share via WhatsApp: ' + err.message);
    }
  };


  /* ── Filter ── */
  const filtered = quotations.filter(q => {
    const matchSearch = q.client_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        q.quotation_number?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchStatus = statusFilter === 'All' || q.status === statusFilter;
    return matchSearch && matchStatus;
  });

  /* ── Metrics ── */
  const totalVal = quotations.reduce((s, q) => s + (Number(q.total_amount) || 0), 0);

  /* ══════════════════════════════ RENDER ═══════════════════ */
  return (
    <div className="qt-layout">
      <Sidebar />
      <div className="qt-right">
        <Header title="Quotations" />

        <main className="qt-main animate-fade">

          {/* Page head */}
          <div className="qt-page-head">
            <div>
              <h1 className="qt-page-title">Quotation Management</h1>
              <p className="qt-page-sub">Create itemised quotations with per-product GST and convert them into projects.</p>
            </div>
            <button className="qt-add-btn" onClick={openAddModal}>
              <Plus size={15} /> New Quotation
            </button>
          </div>

          {/* Metrics */}
          <div className="qt-metrics">
            <div className="qt-metric">
              <div className="qt-metric-icon" style={{ background: '#fffbeb', color: '#f59e0b' }}>
                <FileText size={17} />
              </div>
              <div className="qt-metric-body">
                <span className="qt-metric-val">{quotations.length}</span>
                <span className="qt-metric-lbl">Total Quotations</span>
              </div>
            </div>
            <div className="qt-metric">
              <div className="qt-metric-icon" style={{ background: '#fffbeb', color: '#f59e0b' }}>
                <Clock size={17} />
              </div>
              <div className="qt-metric-body">
                <span className="qt-metric-val">{quotations.filter(q => q.status === 'Pending').length}</span>
                <span className="qt-metric-lbl">Pending</span>
              </div>
            </div>
            <div className="qt-metric">
              <div className="qt-metric-icon" style={{ background: '#ecfdf5', color: '#10b981' }}>
                <CheckCircle size={17} />
              </div>
              <div className="qt-metric-body">
                <span className="qt-metric-val">{quotations.filter(q => q.status === 'Approved').length}</span>
                <span className="qt-metric-lbl">Approved</span>
              </div>
            </div>
            <div className="qt-metric">
              <div className="qt-metric-icon" style={{ background: '#fef2f2', color: '#ef4444' }}>
                <XCircle size={17} />
              </div>
              <div className="qt-metric-body">
                <span className="qt-metric-val">{quotations.filter(q => q.status === 'Rejected').length}</span>
                <span className="qt-metric-lbl">Rejected</span>
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

          {/* Toolbar */}
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
            <div className="qt-filters">
              {STATUS_FILTERS.map(s => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`qt-filter-btn ${statusFilter === s ? 'active' : ''}`}
                >{s}</button>
              ))}
            </div>
          </div>

          {/* Grid */}
          {loading ? (
            <div className="qt-loading">
              <Loader2 size={28} className="db-spin" style={{ color: '#f59e0b' }} />
            </div>
          ) : filtered.length === 0 ? (
            <div className="qt-empty">
              <FileText size={42} style={{ color: '#fcd34d', marginBottom: '0.75rem' }} />
              <p>No quotations found. Create your first one!</p>
              <button className="qt-add-btn" onClick={openAddModal} style={{ marginTop: '1rem' }}>
                <Plus size={14} /> New Quotation
              </button>
            </div>
          ) : (
            <div className="qt-grid">
              {filtered.map(q => {
                const sc = STATUS_CONFIG[q.status] || STATUS_CONFIG.Pending;
                const isApproved = q.status === 'Approved';
                return (
                  <div key={q.id} className="qt-card">

                    {/* Card head */}
                    <div className="qt-card-head">
                      <span className="qt-card-num">#{q.quotation_number}</span>
                      <div className="qt-card-actions">

                        {/* Approve */}
                        {!isApproved && (
                          <button
                            className="qt-card-action-btn approve-btn"
                            title="Approve & Convert to Project"
                            onClick={() => setApproveTarget(q)}
                          >
                            <Check size={13} />
                          </button>
                        )}

                        {/* Edit */}
                        <button
                          className="qt-card-action-btn"
                          title="Edit"
                          onClick={() => openEditModal(q)}
                        >
                          <Pencil size={13} />
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
                              
                              <button className="qt-share-option" onClick={() => handlePrint(q)}>
                                <Printer size={14} /> Print
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Delete */}
                        <button
                          className="qt-card-action-btn delete-btn"
                          title="Delete"
                          onClick={() => handleDelete(q.id)}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>

                    {/* Name + client */}
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
                          {q.quotation_date
                            ? new Date(q.quotation_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })
                            : '—'}
                        </span>
                      </div>
                      <div className="qt-stat">
                        <span className="qt-stat-lbl">Items</span>
                        <span className="qt-stat-val">
                          {q.line_items ? (() => { try { return JSON.parse(q.line_items).length; } catch { return 1; } })() : 1}
                        </span>
                      </div>
                    </div>

                    {/* Footer */}
                    <div className="qt-card-footer">
                      <div className="qt-card-address">
                        <MapPin size={11} />
                        <span>{q.site_address || 'No address'}</span>
                      </div>
                      <div
                        className="qt-card-status"
                        style={{ color: sc.color, background: sc.bg }}
                      >
                        {q.status}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </main>
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
                  <div className="qt-section-label">Client Details</div>

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
                    <input type="date" lang="en-GB" value={form.quotation_date}
                      onChange={e => f('quotation_date', e.target.value)}
                      className="input-field" style={{ colorScheme: 'light' }} />
                  </div>

                  {/* Project Name */}
                  <div className="form-group">
                    <label>Project Name</label>
                    <input type="text" value={form.project_name}
                      onChange={e => f('project_name', e.target.value)}
                      className="input-field" placeholder="e.g. Nitesh Woodland Complex" />
                  </div>

                  {/* Client Name */}
                  <div className="form-group">
                    <label>Client Name</label>
                    <input type="text" required value={form.client_name}
                      onChange={e => f('client_name', e.target.value)}
                      className="input-field" placeholder="e.g. Nitesh Estates Ltd." />
                  </div>

                  {/* Project Type */}
                  <div className="form-group">
                    <label>Project Type</label>
                    <select value={form.project_type}
                      onChange={e => f('project_type', e.target.value)}
                      className="input-field">
                      {PROJECT_TYPES.map(t => <option key={t}>{t}</option>)}
                    </select>
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

                  {/* Client GST */}
                  <div className="form-group">
                    <label>Client GST Number <span style={{ fontSize: '.72rem', color: '#94a3b8', fontWeight: 400 }}>(optional)</span></label>
                    <input type="text" value={form.client_gst}
                      onChange={e => f('client_gst', e.target.value.toUpperCase())}
                      className="input-field" placeholder="e.g. 27XXXXX0000X1ZX" maxLength={15} />
                  </div>
                  <div className="form-group qt-full">
                    <label>Site Address</label>
                    <input type="text" value={form.site_address}
                      onChange={e => f('site_address', e.target.value)}
                      className="input-field" placeholder="e.g. Devanahalli, Bangalore, KA" />
                  </div>

                  {/* Google Maps URL */}
                  <div className="form-group qt-full">
                    <label>Google Maps URL</label>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <input type="url" value={form.map_location}
                        onChange={e => f('map_location', e.target.value)}
                        className="input-field" placeholder="https://maps.google.com/..." style={{ flex: 1 }} />
                      <button type="button" className="qt-locate-btn" onClick={handleUseCurrentLocation} title="Use current location">
                        <Crosshair size={15} />
                      </button>
                    </div>
                    {locating && <div style={{ fontSize: '0.75rem', color: '#10b981', marginTop: '4px' }}>Getting your location...</div>}
                  </div>

                  {/* Plot Area */}
                  <div className="form-group">
                    <label>Plot Area (Sq.Ft)</label>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <input type="number" value={form.plot_area}
                        onChange={e => f('plot_area', e.target.value)}
                        className="input-field" placeholder="e.g. 5000" style={{ flex: 1 }} />
                      <button type="button" className="qt-locate-btn" onClick={() => setShowAreaCalc(true)} title="Area unit converter">
                        <Calculator size={15} />
                      </button>
                    </div>
                  </div>

                  {/* Expected Start Date */}
                  <div className="form-group">
                    <label>Expected Start Date</label>
                    <input type="date" lang="en-GB" value={form.start_date}
                      onChange={e => f('start_date', e.target.value)}
                      className="input-field" style={{ colorScheme: 'light' }} />
                  </div>

                  {/* Estimated Completion */}
                  <div className="form-group">
                    <label>Estimated Completion</label>
                    <input type="date" lang="en-GB" value={form.completion_date}
                      min={form.start_date}
                      onChange={e => f('completion_date', e.target.value)}
                      className="input-field" style={{ colorScheme: 'light' }} />
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
                    <label>Additional Notes</label>
                    <input type="text" value={form.notes}
                      onChange={e => f('notes', e.target.value)}
                      className="input-field" placeholder="Optional notes…" />
                  </div>

                  {/* Payment Terms */}
                  <div className="form-group qt-full">
                    <label>Payment Terms <span style={{ fontSize: '.72rem', color: '#94a3b8', fontWeight: 400 }}>(one per line — appears on quotation)</span></label>
                    <textarea
                      value={form.payment_terms}
                      onChange={e => f('payment_terms', e.target.value)}
                      className="input-field"
                      rows={3}
                      placeholder={"70% Advance at order confirmation\nRemaining 30% on completion of work"}
                      style={{ resize: 'vertical', lineHeight: 1.6 }}
                    />
                  </div>

                  {/* Terms & Conditions */}
                  <div className="form-group qt-full">
                    <label>Terms &amp; Conditions <span style={{ fontSize: '.72rem', color: '#94a3b8', fontWeight: 400 }}>(one per line — appears on quotation)</span></label>
                    <textarea
                      value={form.terms_conditions}
                      onChange={e => f('terms_conditions', e.target.value)}
                      className="input-field"
                      rows={3}
                      placeholder={"Late payments may result in a 2% penalty fee.\nAll disputes subject to Palghar jurisdiction."}
                      style={{ resize: 'vertical', lineHeight: 1.6 }}
                    />
                  </div>

                </div>
              </div>
              <div className="qt-modal-foot">
                <button type="button" className="btn-secondary" onClick={closeModal}>Cancel</button>
                <button type="submit" className="btn-primary">
                  {editingId ? 'Save Changes' : 'Create Quotation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════ APPROVE CONFIRM MODAL ══════════ */}
      {approveTarget && (
        <div className="qt-modal-overlay">
          <div className="qt-approve-modal">
            <div className="qt-approve-icon">
              <CheckCircle size={26} color="#10b981" />
            </div>
            <h3 className="qt-approve-title">Approve Quotation?</h3>
            <p className="qt-approve-sub">
              This will mark <strong>{approveTarget.quotation_number}</strong> as <strong>Approved</strong>
              {' '}and automatically create a new project for <strong>{approveTarget.client_name}</strong>.
              You'll be redirected to the Projects page.
            </p>
            <div className="qt-approve-btns">
              <button className="btn-secondary" style={{ flex: 1 }} onClick={() => setApproveTarget(null)} disabled={approving}>
                Cancel
              </button>
              <button className="btn-approve" onClick={handleApprove} disabled={approving}>
                {approving ? 'Converting…' : 'Yes, Approve & Convert'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════ PLOT AREA CONVERTER MODAL ══════════ */}
      {showAreaCalc && (
        <div className="qt-modal-overlay">
          <div className="qt-modal" style={{ maxWidth: '380px' }}>
            <div className="qt-modal-head">
              <h3 className="qt-modal-title">Land Area Converter</h3>
              <button className="qt-modal-close" onClick={() => setShowAreaCalc(false)}>&times;</button>
            </div>
            <div className="qt-modal-body">
              <div className="form-group">
                <label>Enter Value</label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input type="number" value={calcValue} onChange={e => setCalcValue(e.target.value)}
                    className="input-field" placeholder="e.g. 1" style={{ flex: 1 }} />
                  <select value={calcFrom} onChange={e => setCalcFrom(e.target.value)} className="input-field" style={{ width: '130px' }}>
                    {Object.entries(AREA_UNITS).map(([key, u]) => <option key={key} value={key}>{u.label}</option>)}
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '1rem' }}>
                {Object.entries(AREA_UNITS).map(([key, u]) => (
                  <div key={key} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.6rem 0.85rem', background: key === calcFrom ? '#ecfdf5' : '#f8fafc', borderRadius: '8px', border: key === calcFrom ? '1px solid #6ee7b7' : '1px solid #f1f5f9' }}>
                    <span style={{ fontSize: '0.82rem', color: '#64748b' }}>{u.label}</span>
                    <strong style={{ fontSize: '0.85rem', color: '#0b3d27' }}>
                      {getConvertedAreas()[key].toLocaleString('en-IN', { maximumFractionDigits: 3 })}
                    </strong>
                  </div>
                ))}
              </div>
            </div>
            <div className="qt-modal-foot">
              <button type="button" className="btn-secondary" onClick={() => setShowAreaCalc(false)}>Close</button>
              <button type="button" className="btn-primary" onClick={applyCalculatedArea} disabled={!calcValue}>Use Sq.Ft Value</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}