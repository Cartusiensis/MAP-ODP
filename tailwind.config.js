/** @type {import('tailwindcss').Config} */
export default {
    // Classes are also built inside JS template strings, so scan src/ too
    content: ['./index.html', './src/**/*.js'],
    theme: {
        extend: {
            colors: {
                bg: '#0D1117', sidebar: '#131921', card: '#1A2233',
                surface: '#243044', border: '#2A3A50', fg: '#E6EDF3',
                muted: '#7D8CA3', accent: '#F0883E', 'accent-h': '#D97B35',
            },
            fontFamily: {
                display: ['"Space Grotesk"', 'sans-serif'],
                body: ['"DM Sans"', 'sans-serif'],
            }
        }
    },
    plugins: [],
};
