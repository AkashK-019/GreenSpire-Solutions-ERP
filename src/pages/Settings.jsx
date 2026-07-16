import { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import Header  from '../components/Header';
import { supabase } from '../supabase';
import { useCompanySettings } from '../context/CompanySettingsContext';
import {
  Building2, CreditCard, Save, RotateCcw,
  CheckCircle, AlertCircle, Loader2, ImageOff, Clock
} from 'lucide-react';
import '../styles/settings.css';

export default function Settings() {
  const { settings, refreshSettings } = useCompanySettings();

  const [form,   setForm]   = useState({ ...settings });
  const [saving, setSaving] = useState(false);
  const [toast,  setToast]  = useState(null);
  const [imgOk,  setImgOk]  = useState(true);

  /* Sync form whenever context loads fresh data from DB */
  useEffect(() => { setForm({ ...settings }); }, [settings]);

  const f = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const showToast = (type, msg) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3500);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name:           form.name           || '',
        name_suffix:    form.name_suffix    || '',
        tagline:        form.tagline        || '',
        address:        form.address        || '',
        phone:          form.phone          || '',
        email:          form.email          || '',
        gst_number:     form.gst_number     || '',
        logo_url:       form.logo_url       || '',
        bank_name:      form.bank_name      || '',
        bank_branch:    form.bank_branch    || '',
        bank_account_no: form.bank_account_no || '',
        bank_vpa:       form.bank_vpa       || '',
        updated_at:     new Date().toISOString(),
      };

      const { error } = await supabase
        .from('company_settings')
        .update(payload)
        .eq('id', 1);

      if (error) throw error;
      await refreshSettings();
      showToast('success', 'Settings saved successfully!');
    } catch (err) {
      showToast('error', err.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => setForm({ ...settings });

  const lastUpdated = settings.updated_at
    ? new Date(settings.updated_at).toLocaleString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      })
    : null;

  return (
    <div className="st-layout">
      <Sidebar />
      <div className="st-right">
        <Header title="Settings" />
        <main className="st-main animate-fade">

          <div className="st-page-head">
            <h1 className="st-page-title">Company Settings</h1>
          </div>

          <div className="st-content">
            <form onSubmit={handleSave}>
              <div className="st-grid-main">

                {/* ══ COMPANY PROFILE ══ */}
                <div className="st-section">
                  <div className="st-section-head">
                    <div className="st-section-icon" style={{ background: '#ecfdf5', color: '#10b981' }}>
                      <Building2 size={19} />
                    </div>
                    <div className="st-section-info">
                      <p className="st-section-title">Company Profile</p>
                      <p className="st-section-desc">Name, logo, address and contact info printed on every document</p>
                    </div>
                  </div>

                  <div className="st-section-body">
                    <div className="st-grid">

                      {/* Logo */}
                      <div className="st-group st-full">
                        <label className="st-label">Company Logo</label>
                        <div className="st-logo-block">
                          {imgOk && form.logo_url ? (
                            <img
                              src={form.logo_url}
                              alt="Logo preview"
                              className="st-logo-preview"
                              onError={() => setImgOk(false)}
                              onLoad={() => setImgOk(true)}
                            />
                          ) : (
                            <div className="st-logo-fallback"><ImageOff size={22} /></div>
                          )}
                          <div className="st-logo-text">
                            <strong>Live Preview</strong>
                            <p>Paste an image URL below. Recommended: transparent PNG, min 200×200 px.</p>
                          </div>
                        </div>
                        <input
                          type="url"
                          className="st-input st-input-locked"
                          value={form.logo_url || ''}
                          readOnly
                          placeholder="https://example.com/logo.png"
                        />
                      </div>

                      {/* Name */}
                      <div className="st-group">
                        <label className="st-label">Company Name</label>
                        <input type="text" className="st-input st-input-locked"
                          value={form.name || ''}
                          readOnly
                          placeholder="GreenSpire" />
                      </div>

                      <div className="st-group">
                        <label className="st-label">
                          Name Suffix
                          <span className="st-sublabel">e.g. Solutions, Pvt. Ltd.</span>
                        </label>
                        <input type="text" className="st-input st-input-locked"
                          value={form.name_suffix || ''}
                          readOnly
                          placeholder="Solutions" />
                      </div>

                      {/* Tagline */}
                      <div className="st-group st-full">
                        <label className="st-label">Tagline</label>
                        <input type="text" className="st-input st-input-locked"
                          value={form.tagline || ''}
                          readOnly
                          placeholder="Landscaping | Tree Planting | Garden Development" />
                      </div>

                      {/* Address */}
                      <div className="st-group st-full">
                        <label className="st-label">Registered Address</label>
                        <input type="text" className="st-input"
                          value={form.address || ''}
                          onChange={e => f('address', e.target.value)}
                          placeholder="Shop No., Street, City, State — PIN" />
                      </div>

                      {/* Phone */}
                      <div className="st-group">
                        <label className="st-label">Phone / WhatsApp</label>
                        <input type="text" className="st-input"
                          value={form.phone || ''}
                          onChange={e => f('phone', e.target.value)}
                          placeholder="9876543210" />
                      </div>

                      {/* Email */}
                      <div className="st-group">
                        <label className="st-label">Email Address</label>
                        <input type="email" className="st-input"
                          value={form.email || ''}
                          onChange={e => f('email', e.target.value)}
                          placeholder="company@example.com" />
                      </div>

                      {/* GST */}
                      <div className="st-group">
                        <label className="st-label">GST Number</label>
                        <input type="text" className="st-input"
                          value={form.gst_number || ''}
                          onChange={e => f('gst_number', e.target.value.toUpperCase())}
                          placeholder="27XXXXX0000X1ZX"
                          maxLength={15}
                          style={{ fontFamily: 'monospace', letterSpacing: '.06em', fontWeight: 600 }} />
                      </div>

                    </div>
                  </div>
                </div>

                {/* ══ BANK DETAILS ══ */}
                <div className="st-section">
                  <div className="st-section-head">
                    <div className="st-section-icon" style={{ background: '#eff6ff', color: '#3b82f6' }}>
                      <CreditCard size={19} />
                    </div>
                    <div className="st-section-info">
                      <p className="st-section-title">Bank Details</p>
                      <p className="st-section-desc">Shown on Invoices so clients know where to transfer payment</p>
                    </div>
                  </div>

                  <div className="st-section-body">
                    <div className="st-grid">

                      <div className="st-group">
                        <label className="st-label">Bank Name</label>
                        <input type="text" className="st-input"
                          value={form.bank_name || ''}
                          onChange={e => f('bank_name', e.target.value)}
                          placeholder="ICICI BANK" />
                      </div>

                      <div className="st-group">
                        <label className="st-label">Branch / IFSC Code</label>
                        <input type="text" className="st-input"
                          value={form.bank_branch || ''}
                          onChange={e => f('bank_branch', e.target.value)}
                          placeholder="ICIC0000063 (Boisar)"
                          style={{ fontFamily: 'monospace', letterSpacing: '.04em', fontWeight: 600 }} />
                      </div>

                      <div className="st-group">
                        <label className="st-label">Account Number</label>
                        <input type="text" className="st-input st-bank-input"
                          value={form.bank_account_no || ''}
                          onChange={e => f('bank_account_no', e.target.value)}
                          placeholder="006305008965" />
                      </div>

                      <div className="st-group">
                        <label className="st-label">UPI / VPA</label>
                        <input type="text" className="st-input"
                          value={form.bank_vpa || ''}
                          onChange={e => f('bank_vpa', e.target.value)}
                          placeholder="company@icici"
                          style={{ fontFamily: 'monospace', letterSpacing: '.04em', fontWeight: 600, color: '#059669' }} />
                      </div>

                    </div>
                  </div>
                </div>

              </div>

              {/* ══ Actions ══ */}
              <div className="st-actions">
                {lastUpdated && (
                  <span className="st-updated-chip">
                    <Clock size={13} />
                    Last saved: <span>{lastUpdated}</span>
                  </span>
                )}
                <button type="button" className="st-reset-btn" onClick={handleReset}>
                  <RotateCcw size={14} /> Reset Changes
                </button>
                <button type="submit" className="st-save-btn" disabled={saving}>
                  {saving
                    ? <><Loader2 size={15} className="db-spin" /> Saving…</>
                    : <><Save size={15} /> Save Settings</>
                  }
                </button>
              </div>

            </form>
          </div>

        </main>
      </div>

      {/* Toast notification */}
      {toast && (
        <div className={`st-toast ${toast.type}`}>
          {toast.type === 'success'
            ? <CheckCircle size={16} />
            : <AlertCircle size={16} />
          }
          {toast.msg}
        </div>
      )}
    </div>
  );
}