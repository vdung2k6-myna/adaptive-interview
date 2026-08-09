import { createClient } from '@supabase/supabase-js';

// Ensure a single Supabase client instance across browser contexts to avoid GoTrueClient warnings
// Using globalThis handles hot-reload in development as well.

function createSupabaseClient() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

    if (!supabaseUrl || !supabaseAnonKey || supabaseUrl === 'your-supabase-url') {
        throw new Error('Missing or invalid Supabase configuration. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local');
    }

    return createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
            flowType: 'pkce',
            autoRefreshToken: true,
            detectSessionInUrl: true,
            persistSession: true
        }
    });
}

// In the browser we attach the client to globalThis to persist across module reloads
const globalWithSupabase = globalThis as unknown as { supabase?: ReturnType<typeof createSupabaseClient> };

export const getSupabase = () => {
    if (globalWithSupabase.supabase) {
        return globalWithSupabase.supabase;
    }

    globalWithSupabase.supabase = createSupabaseClient();
    return globalWithSupabase.supabase;
};
