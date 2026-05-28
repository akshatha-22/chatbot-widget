import { typography } from './design-tokens'

/**
 * Typography Utilities
 * Font scales and text utilities
 */

export const textStyles = {
  heading1: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold,
    lineHeight: typography.lineHeight.tight,
  },
  heading2: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.semibold,
    lineHeight: typography.lineHeight.tight,
  },
  heading3: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    lineHeight: typography.lineHeight.normal,
  },
  body: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.normal,
    lineHeight: typography.lineHeight.normal,
  },
  bodySm: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.normal,
    lineHeight: typography.lineHeight.normal,
  },
  label: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    lineHeight: typography.lineHeight.normal,
  },
  caption: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.normal,
    lineHeight: typography.lineHeight.tight,
  },
}

export const fontFamily = typography.fontFamily.sans
export const fontFamilyMono = typography.fontFamily.mono

export const getCSSVariables = () => `
:root {
  --font-sans: ${typography.fontFamily.sans};
  --font-mono: ${typography.fontFamily.mono};
  --font-size-xs: ${typography.fontSize.xs};
  --font-size-sm: ${typography.fontSize.sm};
  --font-size-base: ${typography.fontSize.base};
  --font-size-lg: ${typography.fontSize.lg};
  --font-size-xl: ${typography.fontSize.xl};
  --font-size-2xl: ${typography.fontSize['2xl']};
}
`
