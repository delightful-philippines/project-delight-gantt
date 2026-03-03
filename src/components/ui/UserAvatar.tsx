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

export function UserAvatar({ email, name, size = 'md', className = '', onClick }: UserAvatarProps) {
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

  return (
    <div 
      className={`inline-flex ${onClick ? 'cursor-pointer' : ''}`}
      onClick={onClick}
    >
      <div 
        className={`${selectedSize} rounded-full bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center shrink-0 shadow-sm transition-transform hover:scale-110 active:scale-95 ${className}`}
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
    </div>
  );
}
