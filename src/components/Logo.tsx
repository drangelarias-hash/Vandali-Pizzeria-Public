import React from 'react';

interface LogoProps {
  className?: string;
  variant?: 'red' | 'white' | 'gold';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showSubtitle?: boolean;
}

export const Logo: React.FC<LogoProps> = ({
  className = '',
  variant = 'red',
  size = 'md',
  showSubtitle = true,
}) => {
  const sizeClasses = {
    sm: {
      text: 'text-2xl',
      sub: 'text-[9px] tracking-[0.25em]',
      gap: '-space-y-1',
    },
    md: {
      text: 'text-3xl sm:text-4xl',
      sub: 'text-[11px] sm:text-xs tracking-[0.28em]',
      gap: '-space-y-1 sm:-space-y-1.5',
    },
    lg: {
      text: 'text-4xl sm:text-5xl',
      sub: 'text-xs sm:text-sm tracking-[0.3em]',
      gap: '-space-y-1.5 sm:-space-y-2',
    },
    xl: {
      text: 'text-5xl sm:text-6xl md:text-7xl',
      sub: 'text-sm sm:text-base tracking-[0.35em]',
      gap: '-space-y-2 sm:-space-y-3',
    },
  };

  const colorConfig = {
    red: {
      title: 'text-[#B71C1C]',
      sub: 'text-[#f4f4f5]',
      accent: '#B71C1C',
    },
    white: {
      title: 'text-white',
      sub: 'text-[#B71C1C]',
      accent: '#ffffff',
    },
    gold: {
      title: 'text-[#D4AF37]',
      sub: 'text-white',
      accent: '#D4AF37',
    },
  };

  const selectedSize = sizeClasses[size];
  const selectedColor = colorConfig[variant];

  return (
    <div className={`flex flex-col items-center select-none ${selectedSize.gap} ${className}`}>
      <div className="relative flex items-center justify-center">
        <span
          className={`font-vandali font-extrabold leading-none ${selectedColor.title} ${selectedSize.text} drop-shadow-[0_2px_12px_rgba(183,28,28,0.25)]`}
          style={{
            fontFamily: "'Permanent Marker', 'Outfit', sans-serif",
            textTransform: 'uppercase',
            transform: 'skew(-2deg)',
          }}
        >
          VANDALI
        </span>
      </div>

      {showSubtitle && (
        <span
          className={`font-outfit font-black uppercase ${selectedColor.sub} ${selectedSize.sub} opacity-95`}
          style={{
            letterSpacing: '0.3em',
          }}
        >
          PIZZERIA
        </span>
      )}
    </div>
  );
};
