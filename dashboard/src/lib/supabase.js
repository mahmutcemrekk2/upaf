import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://svxujbjbictgsljtkyoi.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_3Il6B9-lM6YG3CmvR4GIZQ_lT9Pjd_t'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

