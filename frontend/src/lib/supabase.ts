import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured =
  Boolean(supabaseUrl && supabaseAnonKey) &&
  supabaseUrl.startsWith('https://') &&
  !supabaseUrl.includes('placeholder');

// Returns a real client when configured, or a stub client for demo mode
export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : createClient(
      'https://demo-placeholder.supabase.co',
      'demo-placeholder-key'
    );
