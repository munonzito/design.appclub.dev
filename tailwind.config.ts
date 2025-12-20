/** @type {import('tailwindcss').Config} */
export default {
  content: [],
  theme: {
    extend: {
      colors: {
        background: '#0F1113',
        foreground: '#D1FE17',
        brand: {
          black: '#0F1113',
          lime: '#D1FE17',
        }
      },
      boxShadow: {
        'brutal': '4px 4px 0px 0px #0F1113',
        'brutal-lime': '4px 4px 0px 0px #D1FE17',
      },
      borderWidth: {
        '3': '3px',
      }
    },
  },
  plugins: [],
}
