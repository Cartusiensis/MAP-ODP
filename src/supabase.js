import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Copy .env.example to .env.');
}

export const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
