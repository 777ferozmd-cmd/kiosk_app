import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ziiwbevepzfibdhkkthk.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_MO-nZfFn3T2XQKZU-FlbXA_zbSe8DNT';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
