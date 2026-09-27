// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  // Фронтенд-прототип без бэкенда: сессия и мок-данные живут в браузере,
  // поэтому рендерим как SPA — проще и без гонки гидратации на авторизации.
  ssr: false,

  modules: [
    '@pinia/nuxt',
    '@nuxtjs/tailwindcss',
    '@nuxt/icon',
    '@vueuse/nuxt',
  ],

  css: ['~/assets/css/main.css'],

  components: [
    { path: '~/components/ui', pathPrefix: false },
    { path: '~/components/layout', pathPrefix: false },
    { path: '~/components/units', pathPrefix: false },
    { path: '~/components/pricing', pathPrefix: false },
    { path: '~/components/documents', pathPrefix: false },
    { path: '~/components/dashboard', pathPrefix: false },
    { path: '~/components/charts', pathPrefix: false },
    { path: '~/components/leads', pathPrefix: false },
    { path: '~/components/settings', pathPrefix: false },
  ],

  icon: {
    mode: 'svg',
    collections: ['ph'],
  },

  app: {
    head: {
      title: 'Kvartal — платформа продаж застройщика',
      htmlAttrs: { lang: 'ru' },
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'theme-color', content: '#18161B' },
      ],
      link: [
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Onest:wght@400;500;600;700;800&family=Unbounded:wght@400;500;600;700&display=swap' },
      ],
    },
  },

  typescript: { strict: true },
})
