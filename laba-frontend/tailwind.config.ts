import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // J-Track brand: indigo
        brand: {
          50: '#EEF2FF',
          100: '#E0E7FF',
          200: '#C7D2FE',
          300: '#A5B4FC',
          400: '#818CF8',
          500: '#6366F1',
          600: '#4F46E5',
          700: '#4338CA',
          800: '#3730A3',
          900: '#312E81',
        },
        ink: '#0F172A',
        background: '#F4F6FB',
        surface: '#FFFFFF',
        'surface-muted': '#EEF2F7',
        'text-primary': '#0F172A',
        'text-secondary': '#64748B',
        border: '#E2E8F0',
        'border-strong': '#CBD5E1',
        status: {
          success: '#15803D',
          'success-bg': '#F0FDF4',
          error: '#DC2626',
          'error-bg': '#FEF2F2',
          warning: '#D97706',
          'warning-bg': '#FFFBEB',
          info: '#2563EB',
          'info-bg': '#EFF6FF',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;

