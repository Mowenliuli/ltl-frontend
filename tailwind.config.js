/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class', // 通过 <html class="dark"> 切换
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef6ff',
          100: '#d9eaff',
          200: '#bcdbff',
          300: '#8ec2ff',
          400: '#599eff',
          500: '#337bff',
          600: '#1b5cf5',
          700: '#1448e1',
          800: '#173cb6',
          900: '#19398f',
        },
        // 夜晚模式背景层级
        night: {
          900: '#0b1020', // 最深背景
          800: '#111830', // 面板
          700: '#1a2340', // 卡片/输入框
          600: '#2a3558', // 边框/hover
        },
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'pulse-rec': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.4' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.2s ease-out',
        'pulse-rec': 'pulse-rec 1.2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
