interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  showSubtext?: boolean;
}

export function CoreStackLogo({ size = 'md', showSubtext = true }: LogoProps) {
  const dimensions = {
    sm: { width: 34, height: 18, fontSize: '15px', subtext: '8px' },
    md: { width: 44, height: 23, fontSize: '18px', subtext: '9px' },
    lg: { width: 54, height: 28, fontSize: '22px', subtext: '10px' },
  }[size];

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', textDecoration: 'none' }}>
      {/* Official CoreStack Angled Hexagon Badge */}
      <svg
        width={dimensions.width}
        height={dimensions.height}
        viewBox="0 0 72 36"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="CoreStack Logo Mark"
      >
        {/* Left Cyan/Blue Wing */}
        <path d="M14 2L2 18L14 34H25L13 18L25 2H14Z" fill="#0096D6" />
        
        {/* Center Top Red/Orange Slant */}
        <path d="M28 2L18.5 17.5H35L44.5 2H28Z" fill="#EE4336" />
        
        {/* Center Bottom Magenta Slant */}
        <path d="M26.5 18.5L17 34H33.5L43 18.5H26.5Z" fill="#D81B60" />
        
        {/* Right Deep Blue Wing */}
        <path d="M46 2L58 18L46 34H57L69 18L57 2H46Z" fill="#0072CE" />
      </svg>

      {/* Wordmark */}
      <div style={{ lineHeight: 1 }}>
        <div style={{ fontSize: dimensions.fontSize, fontWeight: 800, color: '#0B1F3A', letterSpacing: '-0.3px', fontFamily: "'Inter', sans-serif" }}>
          CORESTACK
        </div>
        {showSubtext && (
          <div style={{ fontSize: dimensions.subtext, fontWeight: 700, color: '#0072CE', letterSpacing: '0.09em', textTransform: 'uppercase', marginTop: '3px' }}>
            AI GOVERNANCE OS
          </div>
        )}
      </div>
    </div>
  );
}
