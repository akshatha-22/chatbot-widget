import { colors } from './design-tokens'

/**
 * Color Palette
 * Exported CSS variables and utility mappings
 */

export const colorPalette = {
  background: {
    primary: colors.neutral[50],
    secondary: colors.neutral[100],
    tertiary: colors.neutral[200],
  },
  text: {
    primary: colors.neutral[900],
    secondary: colors.neutral[700],
    tertiary: colors.neutral[500],
    inverse: colors.neutral[50],
  },
  action: {
    primary: colors.primary[600],
    hover: colors.primary[700],
    disabled: colors.neutral[200],
  },
  state: {
    success: colors.semantic.success,
    error: colors.semantic.error,
    warning: colors.semantic.warning,
    info: colors.semantic.info,
  },
}

export const getCSSVariables = () => `
:root {
  /* Primary Colors */
  --color-primary: ${colors.primary[600]};
  --color-primary-dark: ${colors.primary[700]};
  --color-primary-light: ${colors.primary[500]};

  /* Neutral Colors */
  --color-neutral-50: ${colors.neutral[50]};
  --color-neutral-100: ${colors.neutral[100]};
  --color-neutral-500: ${colors.neutral[500]};
  --color-neutral-700: ${colors.neutral[700]};
  --color-neutral-900: ${colors.neutral[900]};

  /* Semantic Colors */
  --color-success: ${colors.semantic.success};
  --color-error: ${colors.semantic.error};
  --color-warning: ${colors.semantic.warning};
  --color-info: ${colors.semantic.info};

  /* Background Colors */
  --bg-primary: ${colorPalette.background.primary};
  --bg-secondary: ${colorPalette.background.secondary};

  /* Text Colors */
  --text-primary: ${colorPalette.text.primary};
  --text-secondary: ${colorPalette.text.secondary};
  --text-tertiary: ${colorPalette.text.tertiary};
}
`
