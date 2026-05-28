import React from 'react'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
}

/**
 * Button Component
 * Reusable button with multiple variants and sizes
 */
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={`
          px-4 py-2 rounded-md font-medium
          transition-colors duration-200
          focus:outline-none focus:ring-2 focus:ring-offset-2
          ${variant === 'primary' ? 'bg-blue-600 text-white hover:bg-blue-700' : ''}
          ${variant === 'secondary' ? 'bg-gray-200 text-gray-900 hover:bg-gray-300' : ''}
          ${variant === 'ghost' ? 'bg-transparent text-gray-700 hover:bg-gray-100' : ''}
          ${className}
        `}
        {...props}
      />
    )
  }
)

Button.displayName = 'Button'
