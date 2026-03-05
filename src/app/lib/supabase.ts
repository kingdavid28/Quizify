import { createClient } from '@supabase/supabase-js';
import { projectId, publicAnonKey } from '../../../utils/supabase/info';

// Check if we have valid credentials
const hasSupabaseCredentials = !!(projectId && publicAnonKey);

// Create a dummy client for type compatibility
const dummyClient = {
  auth: {
    signUp: async () => ({ data: { user: null, session: null }, error: new Error('No Supabase credentials') }),
    signInWithPassword: async () => ({ data: { user: null, session: null }, error: new Error('No Supabase credentials') }),
    signOut: async () => ({ error: new Error('No Supabase credentials') }),
    getSession: async () => ({ data: { session: null }, error: new Error('No Supabase credentials') }),
    getUser: async () => ({ data: { user: null }, error: new Error('No Supabase credentials') }),
  },
  from: () => ({
    select: () => ({ data: null, error: new Error('No Supabase credentials') }),
    insert: () => ({ data: null, error: new Error('No Supabase credentials') }),
    update: () => ({ data: null, error: new Error('No Supabase credentials') }),
    delete: () => ({ error: new Error('No Supabase credentials') }),
  }),
} as any;

export const supabase = hasSupabaseCredentials 
  ? createClient(`https://${projectId}.supabase.co`, publicAnonKey)
  : dummyClient;

export const API_URL = hasSupabaseCredentials 
  ? `https://${projectId}.supabase.co/functions/v1/make-server-a728d49f`
  : '';

export { hasSupabaseCredentials };
