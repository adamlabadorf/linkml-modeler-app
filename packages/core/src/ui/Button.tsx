import React from 'react';
import './Button.css';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: React.ReactNode;
  iconPosition?: 'leading' | 'trailing';
  loading?: boolean;
}

export function Button({
  variant = 'secondary',
  size = 'md',
  icon,
  iconPosition = 'leading',
  loading = false,
  disabled,
  children,
  className = '',
  type = 'button',
  ...rest
}: ButtonProps) {
  const cls = ['lm-btn', `lm-btn--${variant}`, `lm-btn--${size}`, className]
    .filter(Boolean)
    .join(' ');

  return (
    <button className={cls} type={type} disabled={disabled || loading} {...rest}>
      {loading && <span className="lm-btn__spinner" aria-hidden="true" />}
      {!loading && icon && iconPosition === 'leading' && icon}
      {children}
      {!loading && icon && iconPosition === 'trailing' && icon}
    </button>
  );
}
