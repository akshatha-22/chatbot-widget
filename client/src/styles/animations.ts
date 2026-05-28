/**
 * Animation Definitions
 * Reusable animation keyframes and utilities
 */

export const animations = {
  fadeIn: `
    @keyframes fadeIn {
      from {
        opacity: 0;
      }
      to {
        opacity: 1;
      }
    }
  `,
  fadeOut: `
    @keyframes fadeOut {
      from {
        opacity: 1;
      }
      to {
        opacity: 0;
      }
    }
  `,
  slideInUp: `
    @keyframes slideInUp {
      from {
        transform: translateY(10px);
        opacity: 0;
      }
      to {
        transform: translateY(0);
        opacity: 1;
      }
    }
  `,
  slideInDown: `
    @keyframes slideInDown {
      from {
        transform: translateY(-10px);
        opacity: 0;
      }
      to {
        transform: translateY(0);
        opacity: 1;
      }
    }
  `,
  slideOutUp: `
    @keyframes slideOutUp {
      from {
        transform: translateY(0);
        opacity: 1;
      }
      to {
        transform: translateY(-10px);
        opacity: 0;
      }
    }
  `,
  scaleIn: `
    @keyframes scaleIn {
      from {
        transform: scale(0.95);
        opacity: 0;
      }
      to {
        transform: scale(1);
        opacity: 1;
      }
    }
  `,
  scaleOut: `
    @keyframes scaleOut {
      from {
        transform: scale(1);
        opacity: 1;
      }
      to {
        transform: scale(0.95);
        opacity: 0;
      }
    }
  `,
  spin: `
    @keyframes spin {
      from {
        transform: rotate(0deg);
      }
      to {
        transform: rotate(360deg);
      }
    }
  `,
  pulse: `
    @keyframes pulse {
      0%, 100% {
        opacity: 1;
      }
      50% {
        opacity: 0.5;
      }
    }
  `,
}

export const animationClasses = {
  fadeIn: 'fadeIn 300ms ease-in-out',
  fadeOut: 'fadeOut 300ms ease-in-out',
  slideInUp: 'slideInUp 300ms ease-out',
  slideInDown: 'slideInDown 300ms ease-out',
  slideOutUp: 'slideOutUp 300ms ease-in',
  scaleIn: 'scaleIn 250ms ease-out',
  scaleOut: 'scaleOut 250ms ease-in',
  spin: 'spin 1s linear infinite',
  pulse: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
}

export const getAnimationCSS = () => `
  ${animations.fadeIn}
  ${animations.fadeOut}
  ${animations.slideInUp}
  ${animations.slideInDown}
  ${animations.slideOutUp}
  ${animations.scaleIn}
  ${animations.scaleOut}
  ${animations.spin}
  ${animations.pulse}
`

export const prefersReducedMotion = () => {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}
