import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { projectId, publicAnonKey } from '../../../utils/supabase/info';

// Check if we have valid credentials
const hasSupabaseCredentials = !!(projectId && publicAnonKey);

// Create the appropriate Supabase client
const supabase: SupabaseClient = hasSupabaseCredentials 
  ? createClient(`https://${projectId}.supabase.co`, publicAnonKey)
  : createClient('https://dummy.supabase.co', 'dummy_key');

export const API_URL = hasSupabaseCredentials 
  ? `https://${projectId}.supabase.co/functions/v1`
  : '';

export { supabase, hasSupabaseCredentials };
