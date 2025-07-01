// BBOS Design System Tokens
// A harmonious color palette and design system for professional IoT platform UI

export const colors = {
  // Primary palette - Professional blue-gray
  primary: {
    50: '#f8fafc',   // lightest
    100: '#f1f5f9',
    200: '#e2e8f0',
    300: '#cbd5e1',
    400: '#94a3b8',
    500: '#64748b',  // base
    600: '#475569',
    700: '#334155',
    800: '#1e293b',
    900: '#0f172a'   // darkest
  },

  // Accent colors - Modern blue
  accent: {
    50: '#eff6ff',
    100: '#dbeafe',
    200: '#bfdbfe',
    300: '#93c5fd',
    400: '#60a5fa',
    500: '#3b82f6',  // base
    600: '#2563eb',
    700: '#1d4ed8',
    800: '#1e40af',
    900: '#1e3a8a'
  },

  // Semantic colors
  success: {
    50: '#f0fdf4',
    500: '#22c55e',
    600: '#16a34a',
    700: '#15803d'
  },
  
  warning: {
    50: '#fffbeb',
    500: '#f59e0b',
    600: '#d97706',
    700: '#b45309'
  },
  
  error: {
    50: '#fef2f2',
    500: '#ef4444',
    600: '#dc2626',
    700: '#b91c1c'
  },

  // Neutral grays
  gray: {
    50: '#fafafa',
    100: '#f5f5f5',
    200: '#e5e5e5',
    300: '#d4d4d4',
    400: '#a3a3a3',
    500: '#737373',
    600: '#525252',
    700: '#404040',
    800: '#262626',
    900: '#171717'
  },

  // Special UI colors
  background: {
    primary: '#ffffff',
    secondary: '#f8fafc',
    tertiary: '#f1f5f9',
    dark: '#0f172a'
  },

  text: {
    primary: '#0f172a',
    secondary: '#475569',
    tertiary: '#64748b',
    inverse: '#ffffff',
    muted: '#94a3b8'
  },

  border: {
    light: '#e2e8f0',
    default: '#cbd5e1',
    dark: '#94a3b8'
  }
}

export const typography = {
  fontFamily: {
    sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
    mono: ['JetBrains Mono', 'Menlo', 'Monaco', 'Consolas', 'Liberation Mono', 'Courier New', 'monospace']
  },

  fontSize: {
    xs: '0.75rem',    // 12px
    sm: '0.875rem',   // 14px
    base: '1rem',     // 16px
    lg: '1.125rem',   // 18px
    xl: '1.25rem',    // 20px
    '2xl': '1.5rem',  // 24px
    '3xl': '1.875rem', // 30px
    '4xl': '2.25rem'  // 36px
  },

  fontWeight: {
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700
  },

  lineHeight: {
    tight: 1.25,
    normal: 1.5,
    relaxed: 1.75
  }
}

export const spacing = {
  xs: '0.25rem',   // 4px
  sm: '0.5rem',    // 8px
  md: '0.75rem',   // 12px
  lg: '1rem',      // 16px
  xl: '1.5rem',    // 24px
  '2xl': '2rem',   // 32px
  '3xl': '3rem',   // 48px
  '4xl': '4rem'    // 64px
}

export const borderRadius = {
  none: '0',
  sm: '0.125rem',
  base: '0.375rem',
  md: '0.5rem',
  lg: '0.75rem',
  full: '9999px'
}

export const shadows = {
  sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
  base: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
  md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
  lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
  xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
}

// Component-specific tokens
export const components = {
  button: {
    primary: {
      background: colors.accent[500],
      backgroundHover: colors.accent[600],
      backgroundActive: colors.accent[700],
      text: colors.text.inverse,
      border: colors.accent[500]
    },
    secondary: {
      background: colors.background.primary,
      backgroundHover: colors.gray[50],
      backgroundActive: colors.gray[100],
      text: colors.text.primary,
      border: colors.border.default
    },
    danger: {
      background: colors.error[500],
      backgroundHover: colors.error[600],
      backgroundActive: colors.error[700],
      text: colors.text.inverse,
      border: colors.error[500]
    }
  },

  panel: {
    background: colors.background.primary,
    backgroundSecondary: colors.background.secondary,
    border: colors.border.light,
    shadow: shadows.base
  },

  form: {
    background: colors.background.primary,
    border: colors.border.default,
    borderFocus: colors.accent[500],
    borderError: colors.error[500],
    placeholder: colors.text.muted
  },

  toolbar: {
    background: colors.background.secondary,
    border: colors.border.light,
    text: colors.text.secondary,
    textActive: colors.text.primary
  },

  sidebar: {
    background: colors.background.tertiary,
    border: colors.border.light,
    text: colors.text.secondary,
    textActive: colors.accent[600]
  },

  status: {
    success: {
      background: colors.success[50],
      text: colors.success[700],
      border: colors.success[500]
    },
    warning: {
      background: colors.warning[50],
      text: colors.warning[700],
      border: colors.warning[500]
    },
    error: {
      background: colors.error[50],
      text: colors.error[700],
      border: colors.error[500]
    }
  }
}

// Ant Design theme configuration
export const antdTheme = {
  token: {
    // Colors
    colorPrimary: colors.accent[500],
    colorSuccess: colors.success[500],
    colorWarning: colors.warning[500],
    colorError: colors.error[500],
    
    // Typography
    fontFamily: typography.fontFamily.sans.join(', '),
    fontSize: 14,
    fontSizeSM: 12,
    fontSizeLG: 16,
    fontSizeXL: 20,
    
    // Layout
    borderRadius: 6,
    borderRadiusSM: 4,
    borderRadiusLG: 8,
    
    // Colors - detailed
    colorBgBase: colors.background.primary,
    colorBgContainer: colors.background.primary,
    colorBgElevated: colors.background.primary,
    colorBgLayout: colors.background.secondary,
    colorBorder: colors.border.light,
    colorBorderSecondary: colors.border.light,
    colorText: colors.text.primary,
    colorTextSecondary: colors.text.secondary,
    colorTextTertiary: colors.text.tertiary,
    colorTextQuaternary: colors.text.muted,
    
    // Interactive
    colorPrimaryBg: colors.accent[50],
    colorPrimaryBgHover: colors.accent[100],
    colorPrimaryBorder: colors.accent[300],
    colorPrimaryBorderHover: colors.accent[400],
    colorPrimaryHover: colors.accent[400],
    colorPrimaryActive: colors.accent[700],
    colorPrimaryTextHover: colors.accent[400],
    colorPrimaryText: colors.accent[600],
    colorPrimaryTextActive: colors.accent[700],
    
    // Form controls
    controlHeight: 32,
    controlHeightSM: 24,
    controlHeightLG: 40,
    controlHeightXS: 20,
    
    // Shadows
    boxShadow: shadows.base,
    boxShadowSecondary: shadows.sm,
    boxShadowTertiary: shadows.lg
  },
  
  components: {
    Button: {
      primaryShadow: 'none',
      defaultShadow: 'none',
      dangerShadow: 'none',
      borderRadius: 6,
      fontWeight: typography.fontWeight.medium
    },
    
    Input: {
      borderRadius: 6,
      paddingInline: 12,
      activeBorderColor: colors.accent[500],
      hoverBorderColor: colors.accent[400]
    },
    
    Select: {
      borderRadius: 6,
      optionActiveBg: colors.accent[50],
      optionSelectedBg: colors.accent[100]
    },
    
    Card: {
      borderRadius: 8,
      headerBg: colors.background.secondary,
      boxShadow: shadows.sm,
      borderColor: colors.border.light
    },
    
    Layout: {
      headerBg: colors.background.primary,
      siderBg: colors.background.tertiary,
      bodyBg: colors.background.secondary,
      headerColor: colors.text.primary,
      triggerBg: colors.background.tertiary,
      triggerColor: colors.text.secondary
    },
    
    Menu: {
      itemBg: 'transparent',
      itemSelectedBg: colors.accent[50],
      itemActiveBg: colors.accent[50],
      itemSelectedColor: colors.accent[600],
      itemHoverBg: colors.gray[50],
      itemHoverColor: colors.text.primary,
      horizontalItemSelectedBg: colors.accent[50],
      subMenuItemBg: colors.background.primary
    },
    
    Tabs: {
      itemColor: colors.text.secondary,
      itemSelectedColor: colors.accent[600],
      itemHoverColor: colors.accent[500],
      inkBarColor: colors.accent[500],
      cardBg: colors.background.secondary
    },
    
    Tree: {
      nodeHoverBg: colors.gray[50],
      nodeSelectedBg: colors.accent[50],
      titleColor: colors.text.primary
    },
    
    Notification: {
      borderRadius: 8,
      boxShadow: shadows.lg
    },
    
    Modal: {
      borderRadius: 12,
      headerBg: colors.background.primary,
      boxShadow: shadows.xl
    },
    
    Tooltip: {
      borderRadius: 6,
      boxShadow: shadows.md
    },
    
    Badge: {
      borderRadius: borderRadius.full,
      fontWeight: typography.fontWeight.medium
    },
    
    Alert: {
      borderRadius: 8,
      fontSizeLG: typography.fontSize.sm
    }
  }
}

// CSS Custom Properties for easy theming
export const cssVariables = `
  :root {
    /* Colors */
    --color-primary-50: ${colors.primary[50]};
    --color-primary-500: ${colors.primary[500]};
    --color-primary-900: ${colors.primary[900]};
    --color-accent-50: ${colors.accent[50]};
    --color-accent-500: ${colors.accent[500]};
    --color-accent-600: ${colors.accent[600]};
    
    --color-success: ${colors.success[500]};
    --color-warning: ${colors.warning[500]};
    --color-error: ${colors.error[500]};
    
    --color-bg-primary: ${colors.background.primary};
    --color-bg-secondary: ${colors.background.secondary};
    --color-bg-tertiary: ${colors.background.tertiary};
    
    --color-text-primary: ${colors.text.primary};
    --color-text-secondary: ${colors.text.secondary};
    --color-text-muted: ${colors.text.muted};
    
    --color-border-light: ${colors.border.light};
    --color-border-default: ${colors.border.default};
    
    /* Typography */
    --font-family-sans: ${typography.fontFamily.sans.join(', ')};
    --font-family-mono: ${typography.fontFamily.mono.join(', ')};
    
    --font-size-xs: ${typography.fontSize.xs};
    --font-size-sm: ${typography.fontSize.sm};
    --font-size-base: ${typography.fontSize.base};
    --font-size-lg: ${typography.fontSize.lg};
    --font-size-xl: ${typography.fontSize.xl};
    
    /* Spacing */
    --spacing-xs: ${spacing.xs};
    --spacing-sm: ${spacing.sm};
    --spacing-md: ${spacing.md};
    --spacing-lg: ${spacing.lg};
    --spacing-xl: ${spacing.xl};
    --spacing-2xl: ${spacing['2xl']};
    
    /* Shadows */
    --shadow-sm: ${shadows.sm};
    --shadow-base: ${shadows.base};
    --shadow-md: ${shadows.md};
    --shadow-lg: ${shadows.lg};
    
    /* Border radius */
    --radius-sm: ${borderRadius.sm};
    --radius-base: ${borderRadius.base};
    --radius-md: ${borderRadius.md};
    --radius-lg: ${borderRadius.lg};
  }
` 