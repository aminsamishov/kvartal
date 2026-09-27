import type { Config } from 'tailwindcss'

// Цвета живут в CSS-переменных (их же читают inline-стили и SVG-атрибуты).
// Плоская строка 'var(--ink)' ломает модификаторы прозрачности: Tailwind
// подставляет её в rgb(... / .4), получается невалидное значение, объявление
// отбрасывается — и bg-ink/40 у модалки просто ничего не красит.
// Поэтому цвет задаём функцией: без модификатора отдаём var(), с модификатором
// смешиваем через color-mix. Так и bg-ink/40, и style="background: var(--ink)"
// работают от одних и тех же токенов.
function v(name: string) {
  return ({ opacityValue }: { opacityValue?: string | number }) =>
    opacityValue === undefined || opacityValue === 1 || opacityValue === '1'
      ? `var(${name})`
      : `color-mix(in srgb, var(${name}) calc(${opacityValue} * 100%), transparent)`
}

export default <Partial<Config>>{
  darkMode: ['class', '[data-theme="dark"]'],
  content: [
    './app/components/**/*.{vue,js,ts}',
    './app/layouts/**/*.vue',
    './app/pages/**/*.vue',
    './app/app.vue',
    './app/error.vue',
  ],
  theme: {
    extend: {
      colors: {
        bg: v('--bg'),
        panel: v('--panel'),
        ink: v('--ink'),
        muted: v('--muted'),
        line: v('--line'),
        soft: v('--soft'),
        side: v('--side'),
        'side-panel': v('--side-panel'),
        'side-ink': v('--side-ink'),
        'side-line': v('--side-line'),
        plum: { DEFAULT: v('--plum'), dark: v('--plum-d'), soft: v('--plum-bg') },
        rose: v('--rose'),
        ok: { DEFAULT: v('--ok'), bg: v('--ok-bg') },
        warn: { DEFAULT: v('--warn'), bg: v('--warn-bg') },
        bad: { DEFAULT: v('--bad'), bg: v('--bad-bg') },
        info: { DEFAULT: v('--info'), bg: v('--info-bg') },
        free: v('--free'),
        reserve: { DEFAULT: v('--reserve'), bg: v('--reserve-bg') },
        inst: { DEFAULT: v('--inst'), bg: v('--inst-bg') },
        sold: { DEFAULT: v('--sold'), bg: v('--sold-bg') },
        board: {
          reserve: v('--board-reserve'), 'reserve-ink': v('--board-reserve-ink'),
          inst: v('--board-inst'), 'inst-ink': v('--board-inst-ink'),
          sold: v('--board-sold'), 'sold-ink': v('--board-sold-ink'),
          ok: v('--board-ok'), 'ok-ink': v('--board-ok-ink'),
          warn: v('--board-warn'), 'warn-ink': v('--board-warn-ink'),
          bad: v('--board-bad'), 'bad-ink': v('--board-bad-ink'),
        },
        chart: {
          sold: v('--c-sold'), inst: v('--c-inst'), reserve: v('--c-reserve'),
          free: v('--c-free'), closed: v('--c-closed'),
          grid: v('--c-grid'), accent: v('--c-accent'),
          'step-1': v('--c-step-1'), 'step-2': v('--c-step-2'), 'step-3': v('--c-step-3'),
          'step-4': v('--c-step-4'), 'step-5': v('--c-step-5'),
        },
        fill: {
          plum: { DEFAULT: v('--fill-plum'), dark: v('--fill-plum-d') },
          ok: { DEFAULT: v('--fill-ok'), dark: v('--fill-ok-d') },
          bad: { DEFAULT: v('--fill-bad'), dark: v('--fill-bad-d') },
        },
      },
      fontFamily: {
        ui: ['Onest', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        disp: ['Unbounded', 'Onest', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        xl2: 'var(--r)',
        card: 'var(--r-card)',
      },
      boxShadow: {
        card: 'var(--shadow-card)',
        rise: 'var(--shadow-card-hover)',
        pop: 'var(--shadow-pop)',
      },
      keyframes: {
        'toast-in': { from: { opacity: '0', transform: 'translateY(10px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'pop-in': { from: { opacity: '0', transform: 'scale(.97) translateY(4px)' }, to: { opacity: '1', transform: 'scale(1) translateY(0)' } },
      },
      animation: {
        'toast-in': 'toast-in .22s ease-out',
        'fade-in': 'fade-in .18s ease-out',
        'pop-in': 'pop-in .16s ease-out',
      },
    },
  },
  plugins: [],
}
