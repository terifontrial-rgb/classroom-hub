import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

console.log('Supabase 환경변수 확인:', {
  hasUrl: Boolean(url),
  hasKey: Boolean(key),
  isPlaceholder: Boolean(url?.includes('여기에-'))
})

export const isSupabaseConfigured =
  Boolean(url && key && !url.includes('여기에-'))

export const supabase = isSupabaseConfigured
  ? createClient(url, key)
  : null
