/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // HP Electric Blue — the lone CTA signal
        primary: 'var(--color-primary)',
        'primary-bright': '#296ef9',
        'primary-deep': '#0e3191',
        'primary-soft': 'var(--color-primary-soft)',
        // Ink (near-black) — universal text & dark slabs
        ink: 'var(--color-ink)',
        'ink-deep': '#000000',
        'ink-soft': '#292929',
        // Canvas & surface bands
        canvas: 'var(--color-canvas)',
        paper: 'var(--color-canvas)',
        cloud: 'var(--color-cloud)',
        fog: 'var(--color-fog)',
        // Grays
        steel: 'var(--color-steel)',
        graphite: 'var(--color-graphite)',
        charcoal: 'var(--color-charcoal)',
        // Bloom (coral / error / sale)
        'bloom-coral': '#ff5050',
        'bloom-rose': '#f9d4d2',
        'bloom-deep': '#b3262b',
        'bloom-wine': '#5a1313',
        // Storm (status accents)
        'storm-mist': '#8ebdce',
        'storm-sea': '#7fadbe',
        'storm-deep': '#356373',
      },
      borderRadius: {
        none: '0px',
        xs: '2px',
        sm: '3px',
        md: '4px',
        lg: '8px',
        xl: '16px',
        pill: '9999px',
        full: '9999px',
      },
      fontFamily: {
        sans: [
          'SF Pro Text',
          'SF Pro Display',
          'Inter',
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'Helvetica',
          'Arial',
          'sans-serif'
        ],
      },
      boxShadow: {
        'soft-lift': '0 2px 8px rgba(26, 26, 26, 0.08)',
        'float-modal': '0 8px 24px rgba(26, 26, 26, 0.12)',
        'hairline': '0 0 0 1px #e8e8e8',
      },
    },
  },
  plugins: [],
};
