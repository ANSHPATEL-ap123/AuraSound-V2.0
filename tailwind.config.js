/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            animation: {
                'scan': 'scan 3s ease-in-out infinite',
            }
        },
    },
    plugins: [],
}