module.exports = {
  content: ['./pages/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      animation: {
        fade: 'fade 0.2s ease-in-out'
      },
      keyframes: {
        fade: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' }
        }
      }
    }
  }
}
