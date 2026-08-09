import React from 'react';

type BadgeVariant = 'default' | 'blue' | 'success' | 'warning' | 'error' | 'gray';

const styles: Record<BadgeVariant, string> = {
  default: 'bg-[#E8F3FC] text-[#0072CE] border-[#B8D9F2]',
  blue:    'bg-[#E8F3FC] text-[#0072CE] border-[#B8D9F2]',
  success: 'bg-[#F0FDF4] text-[#16A34A] border-[#BBF7D0]',
  warning: 'bg-[#FFFBEB] text-[#D97706] border-[#FDE68A]',
  error:   'bg-[#FEF2F2] text-[#DC2626] border-[#FECACA]',
  gray:    'bg-[#F1F5F9] text-[#64748B] border-[#CBD5E1]',
};

interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  className?: string;
  dot?: boolean;
}

export function Badge({ variant = 'default', children, className = '', dot = false }: BadgeProps) {
  return (
    <span
      className={`
        inline-flex items-center gap-1.5
        text-[11px] font-semibold uppercase tracking-wider
        px-2.5 py-0.5 rounded-full border
        ${styles[variant]} ${className}
      `}
    >
      {dot && (
        <span className={`w-1.5 h-1.5 rounded-full ${
          variant === 'success' ? 'bg-[#16A34A]' :
          variant === 'warning' ? 'bg-[#D97706] animate-pulse' :
          variant === 'error' ? 'bg-[#DC2626]' :
          variant === 'blue' ? 'bg-[#0072CE]' : 'bg-current'
        }`} />
      )}
      {children}
    </span>
  );
}

// Chip with X button (for selected models)
interface ChipProps {
  children: React.ReactNode;
  onRemove?: () => void;
}

export function Chip({ children, onRemove }: ChipProps) {
  return (
    <span className="inline-flex items-center gap-1.5 bg-[#E8F3FC] text-[#0072CE] border border-[#B8D9F2] text-xs font-medium px-2.5 py-1 rounded-full">
      {children}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="w-3.5 h-3.5 rounded-full flex items-center justify-center hover:bg-[#0072CE] hover:text-white transition-colors"
          aria-label="Remove"
        >
          ×
        </button>
      )}
    </span>
  );
}
