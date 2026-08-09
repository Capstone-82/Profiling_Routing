import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  style?: React.CSSProperties;
}


export function Card({ children, className = '', hover = false, padding = 'md', style }: CardProps) {
  const pads = { none: '', sm: 'p-4', md: 'p-6', lg: 'p-8' };
  return (
    <div
      style={style}
      className={`
        bg-white rounded-xl border border-[#D9E4F0]
        shadow-[0_2px_12px_rgba(13,32,69,0.07)]
        ${hover ? 'transition-all duration-200 hover:border-[#0072CE] hover:shadow-[0_6px_24px_rgba(13,32,69,0.11)]' : ''}
        ${pads[padding]}
        ${className}
      `}
    >
      {children}
    </div>
  );
}

// Divider
export function Divider({ className = '' }: { className?: string }) {
  return <hr className={`border-0 border-t border-[#E8EFF7] ${className}`} />;
}
