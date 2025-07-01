/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // VS Code inspired color scheme
        'vscode-bg': '#1e1e1e',
        'vscode-sidebar': '#252526',
        'vscode-editor': '#1e1e1e',
        'vscode-panel': '#2d2d30',
        'vscode-border': '#3c3c3c',
        'vscode-text': '#cccccc',
        'vscode-text-secondary': '#969696',
        'vscode-accent': '#007acc',
        'vscode-accent-hover': '#1177bb',
        'vscode-success': '#89d185',
        'vscode-warning': '#d7ba7d',
        'vscode-error': '#f48771',
        'vscode-info': '#75beff',
        
        // BBOS Brand Colors
        'bbos-primary': '#0066cc',
        'bbos-secondary': '#4d79a4',
        'bbos-accent': '#ff6b35',
        'bbos-success': '#28a745',
        'bbos-warning': '#ffc107',
        'bbos-error': '#dc3545',
        'bbos-info': '#17a2b8',
        
        // Dark theme variations
        'dark-bg': '#0d1117',
        'dark-surface': '#161b22',
        'dark-surface-hover': '#21262d',
        'dark-border': '#30363d',
        'dark-text': '#f0f6fc',
        'dark-text-secondary': '#8b949e',
      },
      fontFamily: {
        'mono': ['Cascadia Code', 'Fira Code', 'Monaco', 'Consolas', 'monospace'],
        'sans': ['Inter', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      fontSize: {
        'xs': '0.75rem',
        'sm': '0.875rem',
        'base': '1rem',
        'lg': '1.125rem',
        'xl': '1.25rem',
        '2xl': '1.5rem',
        '3xl': '1.875rem',
        '4xl': '2.25rem',
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
        '128': '32rem',
      },
      borderRadius: {
        'none': '0',
        'sm': '0.125rem',
        'md': '0.375rem',
        'lg': '0.5rem',
        'xl': '0.75rem',
        '2xl': '1rem',
        'full': '9999px',
      },
      boxShadow: {
        'vscode': '0 2px 8px rgba(0, 0, 0, 0.3)',
        'vscode-panel': '0 1px 3px rgba(0, 0, 0, 0.4)',
        'bbos': '0 4px 12px rgba(0, 102, 204, 0.15)',
      },
      backdropBlur: {
        'xs': '2px',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'spin-slow': 'spin 2s linear infinite',
        'bounce-subtle': 'bounce 2s infinite',
      },
      transitionProperty: {
        'height': 'height',
        'spacing': 'margin, padding',
      },
    },
  },
  darkMode: 'class',
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/typography'),
    require('@tailwindcss/aspect-ratio'),
  ],
} 