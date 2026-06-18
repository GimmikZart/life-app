// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  modules: ['@nuxtjs/supabase', '@vite-pwa/nuxt'],
  runtimeConfig: {
    databaseUrl: process.env.DATABASE_URL,
    googleCalendar: {
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      redirectUri: process.env.GOOGLE_REDIRECT_URI
    },
    microsoftGraph: {
      clientId: process.env.MICROSOFT_CLIENT_ID,
      clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
      tenantId: process.env.MICROSOFT_TENANT_ID,
      redirectUri: process.env.MICROSOFT_REDIRECT_URI
    },
    public: {
      supabase: {
        url: process.env.NUXT_PUBLIC_SUPABASE_URL,
        key: process.env.NUXT_PUBLIC_SUPABASE_KEY
      }
    }
  },
  supabase: {
    redirect: false
  },
  pwa: {
    registerType: 'autoUpdate',
    manifest: {
      name: 'Life App',
      short_name: 'Life App',
      description: 'Personal operating system for actions, skills, properties, objectives and calendar planning.',
      theme_color: '#111827',
      background_color: '#ffffff',
      display: 'standalone',
      icons: [
        {
          src: '/pwa-icon.svg',
          sizes: '512x512',
          type: 'image/svg+xml',
          purpose: 'any maskable'
        }
      ]
    }
  }
})
