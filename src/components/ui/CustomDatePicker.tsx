import { useState, useRef, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { ISODateString } from "../../types";
import { parseISO, toISO, startOfMonth, daysInMonth, formatDate } from "../../utils/date";

interface Props {
  value: ISODateString;
  onChange: (val: ISODateString) => void;
  disabled?: boolean;
  min?: ISODateString;
  max?: ISODateString;
}

export function CustomDatePicker({ value, onChange, disabled, min, max }: Props): JSX.Element {
  const [isOpen, setIsOpen] = useState(false);
  const [viewDate, setViewDate] = useState(() => parseISO(value));
  const [rect, setRect] = useState<{ top: number; left: number; width: number } | null>(null);
  const [openUpward, setOpenUpward] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const selectedDate = useMemo(() => parseISO(value), [value]);

  useEffect(() => {
    if (isOpen && containerRef.current) {
      const updatePosition = () => {
        const r = containerRef.current?.getBoundingClientRect();
        if (r) {
          const spaceBelow = window.innerHeight - r.bottom;
          const CALENDAR_HEIGHT = 420; // Approx height including margin
          const shouldOpenUp = spaceBelow < CALENDAR_HEIGHT && r.top > CALENDAR_HEIGHT;
          setOpenUpward(shouldOpenUp);
          setRect({ 
            top: shouldOpenUp ? r.top - 8 : r.bottom + 8, 
            left: r.left, 
            width: r.width 
          });
        }
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
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        // Also check if clicking inside the portal
        const portal = document.getElementById("datepicker-portal-root");
        if (portal && portal.contains(event.target as Node)) return;
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const days = useMemo(() => {
    const start = startOfMonth(viewDate);
    const count = daysInMonth(viewDate);
    const startingDay = start.getUTCDay(); // 0 is Sunday
    
    const result = [];
    const prevMonthLastDay = daysInMonth(new Date(Date.UTC(viewDate.getUTCFullYear(), viewDate.getUTCMonth() - 1, 1)));
    for (let i = startingDay - 1; i >= 0; i--) {
      result.push({ 
        day: prevMonthLastDay - i, 
        currentMonth: false, 
        date: new Date(Date.UTC(viewDate.getUTCFullYear(), viewDate.getUTCMonth() - 1, prevMonthLastDay - i)) 
      });
    }
    for (let i = 1; i <= count; i++) {
      result.push({ 
        day: i, 
        currentMonth: true, 
        date: new Date(Date.UTC(viewDate.getUTCFullYear(), viewDate.getUTCMonth(), i)) 
      });
    }
    const remaining = 42 - result.length;
    for (let i = 1; i <= remaining; i++) {
      result.push({ 
        day: i, 
        currentMonth: false, 
        date: new Date(Date.UTC(viewDate.getUTCFullYear(), viewDate.getUTCMonth() + 1, i)) 
      });
    }
    return result;
  }, [viewDate]);

  const changeMonth = (delta: number) => {
    setViewDate(new Date(Date.UTC(viewDate.getUTCFullYear(), viewDate.getUTCMonth() + delta, 1)));
  };

  const currentMonthName = viewDate.toLocaleDateString(undefined, { month: "long" });
  const currentYear = viewDate.getUTCFullYear();

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={`input-premium flex w-full items-center justify-between text-left transition-all ${
          disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:border-blue-400 group"
        } ${isOpen ? "ring-2 ring-blue-500/10 border-blue-500 shadow-sm" : ""}`}
      >
        <span className={disabled ? "text-slate-400" : "text-slate-600 font-medium font-mono text-sm"}>
          {formatDate(selectedDate)}
        </span>
        <svg 
          className={`w-4 h-4 text-slate-400 transition-colors ${isOpen ? "text-blue-500" : "group-hover:text-slate-600"}`} 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2-2v12a2 2 0 002 2z" />
        </svg>
      </button>

      {isOpen && !disabled && rect && createPortal(
        <div 
          id="datepicker-portal-root"
          style={{ 
            position: 'fixed', 
            top: `${rect.top}px`, 
            left: `${rect.left}px`,
            width: '280px',
            transform: openUpward ? 'translateY(-100%)' : 'none'
          }}
          className="z-[20000] animate-enter rounded-xl border border-slate-200 bg-white p-4 shadow-2xl backdrop-blur-xl"
        >
          <div className="mb-4 flex items-center justify-between">
            <button 
              type="button"
              onClick={(e) => { e.stopPropagation(); changeMonth(-1); }} 
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-all"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div className="text-base font-medium text-slate-800">
              {currentMonthName} <span className="text-slate-400 font-medium ml-0.5">{currentYear}</span>
            </div>
            <button 
              type="button"
              onClick={(e) => { e.stopPropagation(); changeMonth(1); }} 
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-all"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1">
            {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map(d => (
              <div key={d} className="py-2 text-center text-xs font-medium uppercase tracking-wider text-slate-400">
                {d}
              </div>
            ))}
            {days.map((d, i) => {
              const iso = toISO(d.date);
              const isSelected = iso === value;
              const isToday = iso === new Date().toISOString().slice(0, 10);
              const isBeforeMin = min ? iso < min : false;
              const isAfterMax = max ? iso > max : false;
              const isDateDisabled = isBeforeMin || isAfterMax;

              return (
                <button
                  key={i}
                  type="button"
                  disabled={isDateDisabled}
                  onClick={(e) => {
                    e.stopPropagation();
                    onChange(iso);
                    setIsOpen(false);
                  }}
                  className={`relative h-9 w-9 rounded-lg text-sm font-medium transition-all ${
                    isDateDisabled 
                      ? "text-slate-200 cursor-not-allowed bg-slate-50/50" 
                      : !d.currentMonth 
                        ? "text-slate-300" 
                        : isSelected 
                          ? "bg-blue-600 text-white shadow-lg shadow-blue-500/30" 
                          : "text-slate-600 hover:bg-slate-100 hover:scale-110 active:scale-95"
                  }`}
                >
                  {d.day}
                  {isToday && !isSelected && !isDateDisabled && (
                    <div className="absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-blue-500" />
                  )}
                </button>
              );
            })}
          </div>
          
          <div className="mt-4 pt-4 border-t border-slate-50 flex justify-between">
            <button 
              type="button"
              disabled={min ? new Date().toISOString().slice(0, 10) < min : false}
              onClick={(e) => {
                e.stopPropagation();
                onChange(new Date().toISOString().slice(0, 10));
                setIsOpen(false);
              }}
              className="text-xs font-medium uppercase tracking-widest text-blue-500 hover:text-blue-600 disabled:opacity-30 disabled:cursor-not-allowed px-2 py-1 transition-colors"
            >
              Today
            </button>
            <button 
              type="button"
              onClick={(e) => { e.stopPropagation(); setIsOpen(false); }}
              className="text-xs font-medium uppercase tracking-widest text-slate-400 hover:text-slate-500 px-2 py-1 transition-colors"
            >
              Close
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

