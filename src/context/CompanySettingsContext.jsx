import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../supabase';

/* ── Default fallback (mirrors what was previously hardcoded) ── */
export const DEFAULT_SETTINGS = {
  name:                     'GreenSpire',
  name_suffix:              'Solutions',
  tagline:                  'Landscaping | Tree Planting | Garden Development',
  address:                  'Shop No. 18, Shivkala Arcade, Tarapur Road, Boisar, Palghar - 401501, Maharashtra, India',
  phone:                    '808-095-6853',
  email:                    'greenspire.solutions23@gmail.com',
  gst_number:               '27FASPK9418R1ZF',
  logo_url:                 'https://ik.imagekit.io/greenspire/GreenSpire%20Solutions%20/logo.png?updatedAt=1782207314550',
  bank_name:                'ICICI BANK',
  bank_branch:              'ICIC0000063 (Boisar)',
  bank_account_no:          '006305008965',
  bank_vpa:                 'greenspiresolutions.ibz@icici',
  default_payment_terms:    '70% Advance at order confirmation\nRemaining 30% on completion of work',
  default_terms_conditions: 'Late payments may result in a 2% penalty fee.',
};

const CompanySettingsContext = createContext(null);

/* ── Shape converter: DB row  →  legacy COMPANY_CONFIG shape ── */
const toCompanyConfig = (s) => ({
  name:       s.name       || DEFAULT_SETTINGS.name,
  nameSuffix: s.name_suffix || DEFAULT_SETTINGS.name_suffix,
  tagline:    s.tagline     || DEFAULT_SETTINGS.tagline,
  logo:       s.logo_url    || DEFAULT_SETTINGS.logo_url,
  address:    s.address     || DEFAULT_SETTINGS.address,
  phone:      s.phone       || DEFAULT_SETTINGS.phone,
  email:      s.email       || DEFAULT_SETTINGS.email,
  gstNumber:  s.gst_number  || DEFAULT_SETTINGS.gst_number,
  bank: {
    bankName:  s.bank_name       || DEFAULT_SETTINGS.bank_name,
    branch:    s.bank_branch     || DEFAULT_SETTINGS.bank_branch,
    accountNo: s.bank_account_no || DEFAULT_SETTINGS.bank_account_no,
    vpa:       s.bank_vpa        || DEFAULT_SETTINGS.bank_vpa,
  },
  paymentTerms: (s.default_payment_terms || DEFAULT_SETTINGS.default_payment_terms)
    .split('\n').filter(t => t.trim()),
  termsAndConditions: (s.default_terms_conditions || DEFAULT_SETTINGS.default_terms_conditions)
    .split('\n').filter(t => t.trim()),
});

/* ── Provider ── */
export function CompanySettingsProvider({ children }) {
  const [settings, setSettings]   = useState(DEFAULT_SETTINGS);
  const [loading,  setLoading]    = useState(true);

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('company_settings')
        .select('*')
        .eq('id', 1)
        .single();
      if (!error && data) setSettings({ ...DEFAULT_SETTINGS, ...data });
    } catch { /* keep defaults */ }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchSettings(); }, []);

  const value = {
    settings,
    companyConfig: toCompanyConfig(settings),
    loading,
    refreshSettings: fetchSettings,
  };

  return (
    <CompanySettingsContext.Provider value={value}>
      {children}
    </CompanySettingsContext.Provider>
  );
}

/* ── Hooks ── */
export const useCompanySettings = () => useContext(CompanySettingsContext);

/** Returns the legacy COMPANY_CONFIG-shaped object — drop-in replacement */
export const useCompanyConfig = () => {
  const ctx = useContext(CompanySettingsContext);
  return ctx ? ctx.companyConfig : toCompanyConfig(DEFAULT_SETTINGS);
};
