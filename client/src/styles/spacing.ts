import { spacing } from './design-tokens'

/**
 * Spacing Utilities
 * Consistent spacing scale
 */

export const spaceScale = {
  xs: spacing.xs,
  sm: spacing.sm,
  md: spacing.md,
  lg: spacing.lg,
  xl: spacing.xl,
  '2xl': spacing['2xl'],
}

export const getCSSVariables = () => `
:root {
  --space-xs: ${spacing.xs};
  --space-sm: ${spacing.sm};
  --space-md: ${spacing.md};
  --space-lg: ${spacing.lg};
  --space-xl: ${spacing.xl};
  --space-2xl: ${spacing['2xl']};
}
`

/**
 * Helper functions for spacing
 */
export const getSpacing = (multiplier: number) => {
  const baseUnit = 4 // 4px base unit
  return `${baseUnit * multiplier}px`
}

export const getPaddingShorthand = (vertical: number, horizontal: number) => {
  return `${getSpacing(vertical)} ${getSpacing(horizontal)}`
}

export const getMarginShorthand = (vertical: number, horizontal: number) => {
  return `${getSpacing(vertical)} ${getSpacing(horizontal)}`
}
