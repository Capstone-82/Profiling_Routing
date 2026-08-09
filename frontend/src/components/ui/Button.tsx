import React from 'react';

type Variant = 'primary' | 'outline' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  children: React.ReactNode;
}

const base = `
  inline-flex items-center justify-center gap-2
  font-semibold rounded-[999px] border-2
  transition-all duration-150 cursor-pointer
  focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2
  disabled:cursor-not-allowed select-none
`.replace(/\s+/g, ' ').trim();

const variants: Record<Variant, string> = {
  primary: `
    bg-[#0072CE] border-[#0072CE] text-white
    hover:bg-[#0058A3] hover:border-[#0058A3]
    hover:shadow-[0_4px_14px_rgba(0,114,206,0.30)]
    active:scale-[0.98]
    disabled:bg-[#94A3B8] disabled:border-[#94A3B8] disabled:shadow-none
  `,
  outline: `
    bg-transparent border-[#0072CE] text-[#0072CE]
    hover:bg-[#0072CE] hover:text-white
    hover:shadow-[0_4px_14px_rgba(0,114,206,0.20)]
    active:scale-[0.98]
    disabled:border-[#CBD5E1] disabled:text-[#94A3B8] disabled:shadow-none
  `,
  ghost: `
    bg-transparent border-transparent text-[#5A6A85]
    hover:bg-[#F1F5F9] hover:text-[#1A2B4A]
    disabled:text-[#CBD5E1]
  `,
  danger: `
    bg-[#DC2626] border-[#DC2626] text-white
    hover:bg-[#B91C1C] hover:border-[#B91C1C]
    disabled:bg-[#FCA5A5] disabled:border-[#FCA5A5]
  `,
};

const sizes: Record<Size, string> = {
  sm: 'text-xs px-4 py-1.5 h-8',
  md: 'text-sm px-5 py-2.5 h-10',
  lg: 'text-sm px-7 py-3 h-11',
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
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
    >
      {loading && (
        <svg
          className="animate-spin w-4 h-4 shrink-0"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden
        >
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity=".3" />
          <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        </svg>
      )}
      {children}
    </button>
  );
}
