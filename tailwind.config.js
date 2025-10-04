/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,jsx}',
    './components/**/*.{js,jsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      keyframes: {
        fade: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' }
        },
        slide: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(0)' }
        }
      },
      animation: {
        fade: 'fade 0.2s ease-in-out',
        slide: 'slide 0.2s ease-in-out'
      },
      textShadow: {
        'sm': '0 1px 2px rgba(0, 0, 0, 0.6)',
        'md': '0 2px 4px rgba(0, 0, 0, 0.6)',
        'lg': '0 3px 6px rgba(0, 0, 0, 0.6)',
      }
    }
  },
  plugins: [
    function({ addUtilities }) {
      addUtilities({
        '.text-shadow-sm': {
          textShadow: '0 1px 2px rgba(0, 0, 0, 0.6)',
        },
        '.text-shadow-md': {
          textShadow: '0 2px 4px rgba(0, 0, 0, 0.6)',
        },
        '.text-shadow-lg': {
          textShadow: '0 3px 6px rgba(0, 0, 0, 0.6)',
        },
      })
    }
  ],
}
