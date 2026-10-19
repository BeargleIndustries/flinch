/** @param {string} name */
const token = (name) => `rgb(var(--${name}) / <alpha-value>)`;

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{html,js,svelte,ts}'],
  darkMode: 'class',
  theme: {
    extend: {
      // Tokens live in src/app.css (brief 5.1); components never write hex.
      colors: {
        bg: token('bg'),
        surface: token('surface'),
        surface2: token('surface-2'),
        border: token('border'),
        borderStrong: token('border-strong'),
        text: token('text'),
        text2: token('text-2'),
        text3: token('text-3'),
        text4: token('text-4'),
        accent: token('accent'),
        accentHover: token('accent-hover'),
        accentSoft: token('accent-soft'),
        accentText: token('accent-text'),
        brandDot: token('brand-dot'),
        danger: token('danger'),
        dangerSoft: token('danger-soft'),
        ok: token('ok'),
        warn: token('warn'),
        clsRefused: token('cls-refused'),
        clsCollapsed: token('cls-collapsed'),
        clsNegotiated: token('cls-negotiated'),
        clsComplied: token('cls-complied'),
        clsUnknown: token('cls-unknown'),
      },
      fontFamily: {
        sans: ['system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['ui-monospace', 'Cascadia Mono', 'Consolas', 'Menlo', 'monospace'],
      },
    },
  },
  plugins: [],
};
