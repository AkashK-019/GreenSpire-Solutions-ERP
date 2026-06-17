import { createClient } from '@supabase/supabase-js';

const supabaseUrl     = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const isConfigured =
  supabaseUrl &&
  supabaseUrl.startsWith('http') &&
  supabaseAnonKey &&
  supabaseAnonKey.length > 20;

if (!isConfigured) {
  console.warn(
    '⚠️  Supabase is not configured yet.\n' +
    '    Open the .env file and set:\n' +
    '      VITE_SUPABASE_URL=https://your-project-id.supabase.co\n' +
    '      VITE_SUPABASE_ANON_KEY=your_anon_key\n' +
    '    Then restart the dev server.'
  );
}

export const supabase = createClient(
  isConfigured ? supabaseUrl : 'https://placeholder.supabase.co',
  isConfigured ? supabaseAnonKey : 'placeholder-anon-key-placeholder-anon-key-00',
  {
    auth: {
      persistSession: false
    }
  }
);

export const isSupabaseConfigured = isConfigured;