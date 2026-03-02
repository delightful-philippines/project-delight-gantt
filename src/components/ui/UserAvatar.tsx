import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface UserAvatarProps {
  email?: string;
  name?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  onClick?: () => void;
  activeColor?: string;
}

export function UserAvatar({ email, name, size = 'md', className = '', onClick, activeColor }: UserAvatarProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 });
  const ref = useRef<HTMLDivElement>(null);
  const identifier = name || email || 'User';
  
  const photoUrl = email 
    ? `https://unavatar.io/microsoft/${encodeURIComponent(email)}?fallback=false`
    : null;

  const sizeMap = {
    xs: 'h-5 w-5',
    sm: 'h-6 w-6',
    md: 'h-8 w-8',
    lg: 'h-10 w-10',
    xl: 'h-24 w-24'
  };

  const selectedSize = sizeMap[size];

  useEffect(() => {
    let animationFrame: number;
    
    const updatePosition = () => {
      if (isHovered && ref.current) {
        const rect = ref.current.getBoundingClientRect();
        setCoords({
          top: rect.top,
          left: rect.left,
          width: rect.width
        });
        animationFrame = requestAnimationFrame(updatePosition);
      }
    };

    if (isHovered) {
      updatePosition();
    }

    return () => cancelAnimationFrame(animationFrame);
  }, [isHovered]);

  return (
    <div 
      className="inline-flex"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div 
        ref={ref}
        onClick={onClick}
        className={`${selectedSize} rounded-full bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center shrink-0 shadow-sm transition-transform hover:scale-110 active:scale-95 cursor-pointer ${className}`}
      >
        {photoUrl ? (
          <img 
            src={photoUrl} 
            className="h-full w-full object-cover" 
            alt={identifier}
            loading="lazy"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
              const fallback = e.currentTarget.nextElementSibling;
              if (fallback) fallback.classList.remove('hidden');
            }}
          />
        ) : null}
        
        <div className={`${photoUrl ? 'hidden' : ''} text-slate-300 w-full h-full flex items-center justify-center bg-slate-50`}>
          <svg className="w-3/5 h-3/5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
          </svg>
        </div>
      </div>

      {/* Premium Portaled Tooltip */}
      {isHovered && createPortal(
        <div 
          style={{ 
            position: 'fixed',
            top: coords.top - 6,
            left: coords.left + coords.width / 2,
            transform: 'translateX(-50%) translateY(-100%)',
            backgroundColor: activeColor || 'rgba(15, 23, 42, 0.95)'
          }}
          className="px-3 py-1.5 text-white text-[10px] font-medium uppercase tracking-[0.15em] rounded-lg z-[99999] whitespace-nowrap shadow-2xl flex items-center gap-2 border border-white/10 pointer-events-none animate-tooltip-up"
        >
          <div className="w-1.5 h-1.5 rounded-full bg-white/30 animate-pulse" />
          <span>{identifier}</span>
          {/* Tooltip Arrow - Centered on bottom */}
          <div 
            style={{ 
              borderTopColor: activeColor || 'rgba(15, 23, 42, 0.95)',
            }}
            className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px]" 
          />
        </div>,
        document.body
      )}
    </div>
  );
}
