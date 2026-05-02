import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jlegxzvcuzwtbgfdvpbf.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_KwF_MMJQsdPs-m6zU62AZw_k7BdHilk';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
