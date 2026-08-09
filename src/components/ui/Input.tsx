import React, { forwardRef, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  rightElement?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, rightElement, className = '', type, ...props }, ref) => {
    const [showPassword, setShowPassword] = useState(false);
    const isPassword = type === 'password';
    const inputType = isPassword ? (showPassword ? 'text' : 'password') : type;

    return (
      <div className="w-full">
        {label && (
          <label
            className="block text-xs font-semibold text-[#3D4F6B] uppercase tracking-wider mb-1.5"
            htmlFor={props.id}
          >
            {label}
          </label>
        )}
        <div className="relative">
          <input
            ref={ref}
            type={inputType}
            aria-describedby={error ? `${props.id}-error` : hint ? `${props.id}-hint` : undefined}
            aria-invalid={Boolean(error)}
            {...props}
            className={`
              w-full h-10 px-3.5 text-sm
              bg-white text-[#1A2B4A] placeholder:text-[#94A3B8]
              border-2 rounded-lg outline-none
              transition-all duration-150
              ${error
                ? 'border-[#EF4444] focus:border-[#EF4444] focus:ring-2 focus:ring-[#EF4444]/20'
                : 'border-[#C8D8EB] focus:border-[#0072CE] focus:ring-2 focus:ring-[#0072CE]/15'
              }
              disabled:bg-[#F8FAFC] disabled:text-[#94A3B8] disabled:cursor-not-allowed
              ${isPassword || rightElement ? 'pr-10' : ''}
              ${className}
            `}
          />
          {isPassword && (
            <button
              type="button"
              onClick={() => setShowPassword(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8499B5] hover:text-[#5A6A85] transition-colors"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              tabIndex={-1}
            >
              {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          )}
          {!isPassword && rightElement && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">{rightElement}</div>
          )}
        </div>
        {error && (
          <p id={`${props.id}-error`} className="mt-1.5 text-xs text-[#DC2626] flex items-center gap-1" role="alert">
            {error}
          </p>
        )}
        {hint && !error && (
          <p id={`${props.id}-hint`} className="mt-1.5 text-xs text-[#8499B5]">{hint}</p>
        )}
      </div>
    );
  }
);
Input.displayName = 'Input';
