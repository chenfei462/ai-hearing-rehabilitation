/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      // ── 老年友好字号体系（PRD: ≥18px） ──
      fontSize: {
        'elderly-sm': '16px',
        'elderly-base': '18px',
        'elderly-lg': '20px',
        'elderly-xl': '24px',
        'elderly-2xl': '28px',
        'elderly-3xl': '32px',
        'elderly-4xl': '40px',
      },

      // ── 触控目标最小尺寸（PRD: ≥48px） ──
      spacing: {
        'touch-min': '48px',
        'touch-lg': '56px',
      },
      minWidth: {
        touch: '48px',
        'touch-lg': '56px',
      },
      minHeight: {
        touch: '48px',
        'touch-lg': '56px',
      },

      // ── 行高 ──
      lineHeight: {
        elderly: '1.7',
        'elderly-loose': '2.0',
      },

      // ── 圆角 ──
      borderRadius: {
        elderly: '12px',
      },
    },
  },
  plugins: [],
};
