import React from 'react';

type Variant = 'primary' | 'outline' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  children: React.ReactNode;
}

const variantClasses: Record<Variant, string> = {
  primary: 'cs-btn-primary',
  outline: 'cs-btn-outline',
  ghost:   'cs-btn-ghost',
  danger:  'cs-btn-danger',
};

const sizeClasses: Record<Size, string> = {
  sm: 'cs-btn-sm',
  md: '',
  lg: 'cs-btn-lg',
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  children,
  className = '',
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={`cs-btn ${variantClasses[variant]} ${sizeClasses[size]} ${loading ? 'is-loading' : ''} ${className}`}
    >
      {loading && (
        <span
          style={{
            display: 'inline-block',
            width: '14px',
            height: '14px',
            border: '2px solid rgba(255,255,255,0.4)',
            borderTopColor: '#fff',
            borderRadius: '50%',
            animation: 'cs-spin 0.6s linear infinite',
            flexShrink: 0,
          }}
        />
      )}
      {children}
    </button>
  );
}
