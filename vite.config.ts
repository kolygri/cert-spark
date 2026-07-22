import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '')
  const supabaseUrl = env.VITE_SUPABASE_URL ?? env.SUPABASE_URL ?? ''
  const supabasePublishableKey =
    env.VITE_SUPABASE_PUBLISHABLE_KEY ?? env.SUPABASE_PUBLISHABLE_KEY ?? env.SUPABASE_ANON_KEY ?? ''

  return {
    base: mode === 'github-pages' ? '/cert-spark/' : '/',
    plugins: [react()],
    define: {
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(supabaseUrl),
      'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify(supabasePublishableKey),
    },
  }
})
