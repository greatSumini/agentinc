import { ButtonHTMLAttributes, ReactNode } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary'
  children: ReactNode
}

export function Button({
  variant = 'primary',
  children,
  className = '',
  disabled,
  ...props
}: ButtonProps) {
  const baseStyles = 'px-4 py-2 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
  const variantStyles =
    variant === 'primary'
      ? 'bg-gray-900 text-white hover:bg-gray-800'
      : 'border border-gray-300 text-gray-700 hover:bg-gray-50'

  return (
    <button
      className={`${baseStyles} ${variantStyles} ${className}`}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  )
}
