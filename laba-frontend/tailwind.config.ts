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
        background: '#F7F6F2',
        surface: '#FFFFFF',
        'surface-muted': '#F0EFEB',
        'text-primary': '#171717',
        'text-secondary': '#737373',
        border: '#E5E5E5',
        'border-strong': '#D4D4D4',
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

