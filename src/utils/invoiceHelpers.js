
import { supabase } from '../supabase';

const getCurrentFY = () => {
  const now = new Date();
  const yr  = now.getFullYear();
  const mo  = now.getMonth() + 1; // 1-12
  const fyStart = mo >= 4 ? yr : yr - 1;
  const fyEnd   = fyStart + 1;
  return `${String(fyStart).slice(-2)}${String(fyEnd).slice(-2)}`;
};

export const genInvoiceNumber = async () => {
  const fy     = getCurrentFY();
  const prefix = `INV-${fy}-`;
  try {
    const { data } = await supabase
      .from('invoices')
      .select('invoice_number')
      .like('invoice_number', `${prefix}%`)
      .order('invoice_number', { ascending: false })
      .limit(1);

    if (data && data.length > 0) {
      const last    = data[0].invoice_number;
      const lastNum = parseInt(last.replace(prefix, ''), 10);
      const next    = isNaN(lastNum) ? 1 : lastNum + 1;
      return `${prefix}${String(next).padStart(3, '0')}`;
    }
  } catch {/* fallthrough */}
  return `${prefix}001`;
};

export const createInvoiceFromQuotation = async (quotation, projectId, invoiceType = 'Full') => {
  const invoice_number = await genInvoiceNumber();

  const payload = {
    quotation_id:     quotation.id,
    project_id:       projectId ?? quotation.project_id ?? null,
    invoice_number,
    invoice_type:     invoiceType,
    invoice_date:     new Date().toISOString().split('T')[0],
    quotation_number: quotation.quotation_number || null,

    client_name:      quotation.client_name  || null,
    client_email:      quotation.client_email || null,
    client_phone:      quotation.client_phone || null,
    client_gst:        quotation.client_gst   || null,

    project_name:      quotation.project_name    || null,
    project_type:      quotation.project_type    || null,
    site_address:      quotation.site_address    || null,
    map_location:      quotation.map_location    || null,
    plot_area:         quotation.plot_area        || null,
    start_date:        quotation.start_date        || null,
    completion_date:   quotation.completion_date  || null,
    scope_of_work:     quotation.scope_of_work    || null,

    line_items:        quotation.line_items || null,
    amount:             quotation.amount       || 0,
    gst_percent:        quotation.gst_percent   || 0,
    gst_amount:          quotation.gst_amount     || 0,
    total_amount:        quotation.total_amount   || 0,

    notes:               quotation.notes             || null,
    payment_terms:        quotation.payment_terms     || null,
    terms_conditions:      quotation.terms_conditions  || null,
  };

  const { data, error } = await supabase.from('invoices').insert([payload]).select().single();
  if (error) throw error;
  return data;
};