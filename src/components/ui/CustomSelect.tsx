import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";

interface Option {
  value: string;
  label: string;
}

interface CustomSelectProps {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
}

export function CustomSelect({
  options,
  value,
  onChange,
  className = "",
  placeholder = "Select...",
}: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [rect, setRect] = useState<{ top: number; left: number; width: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);

  useEffect(() => {
    if (isOpen && containerRef.current) {
      const updatePosition = () => {
        const r = containerRef.current?.getBoundingClientRect();
        if (r) setRect({ top: r.bottom, left: r.left, width: r.width });
      };
      updatePosition();
      window.addEventListener('scroll', updatePosition, true);
      window.addEventListener('resize', updatePosition);
      return () => {
        window.removeEventListener('scroll', updatePosition, true);
        window.removeEventListener('resize', updatePosition);
      };
    }
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        // Also check portal
        const portal = document.getElementById("select-portal-root");
        if (portal && portal.contains(event.target as Node)) return;
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className={`relative select-none ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex h-10 w-full items-center justify-between rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition-all hover:border-slate-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
      >
        <span className={`whitespace-nowrap truncate ${selectedOption ? "text-slate-900" : "text-slate-400"}`}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <svg
          className={`h-4 w-4 text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {isOpen && rect && createPortal(
        <div 
          id="select-portal-root"
          style={{ 
            position: 'fixed', 
            top: `${rect.top + 8}px`, 
            left: `${rect.left}px`,
            width: `${rect.width}px`
          }}
          className="z-[20000] animate-enter overflow-hidden rounded-lg border border-slate-200 bg-white p-1 shadow-xl"
        >
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onChange(option.value);
                setIsOpen(false);
              }}
              className={`flex w-full items-center px-3 py-2 text-sm transition-colors rounded-md ${
                option.value === value
                  ? "bg-blue-50 text-blue-700 font-medium"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              {option.label}
              {option.value === value && (
                <svg
                  className="ml-auto h-3.5 w-3.5"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              )}
            </button>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
}

