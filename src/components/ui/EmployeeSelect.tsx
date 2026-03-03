import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { api, DBEmployee } from "../../lib/api";

interface EmployeeSelectProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
}

export function EmployeeSelect({
  value,
  onChange,
  className = "",
  placeholder = "Search for an employee...",
}: EmployeeSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<DBEmployee[]>([]);
  const [loading, setLoading] = useState(false);
  const [rect, setRect] = useState<{ top: number; left: number; width: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Synchronize internal search query when external value changes
  useEffect(() => {
    setQuery(value);
  }, [value]);

  useEffect(() => {
    if (!isOpen) return;
    
    const timeout = setTimeout(async () => {
      setLoading(true);
      try {
        const results = await api.employees.search(query);
        setOptions(results || []);
      } catch (err) {
        console.error("Failed to fetch employees", err);
      } finally {
        setLoading(false);
      }
    }, 300); // debounce
    return () => clearTimeout(timeout);
  }, [query, isOpen]);

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
        const portal = document.getElementById("employee-select-portal-root");
        if (portal && portal.contains(event.target as Node)) return;
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className={`relative select-none ${className}`}>
      <input
        type="text"
        placeholder={placeholder}
        value={query}
        onFocus={() => {
          setIsOpen(true);
          setQuery("");
        }}
        onChange={(e) => {
          setQuery(e.target.value);
          onChange(e.target.value); // keep parent value in sync with typed text as they type
          setIsOpen(true);
        }}
        className="w-full px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium placeholder:text-slate-300 focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 transition-all outline-none" 
      />

      {isOpen && rect && createPortal(
        <div 
          id="employee-select-portal-root"
          style={{ 
            position: 'fixed', 
            top: `${rect.top + 8}px`, 
            left: `${rect.left}px`,
            width: `${rect.width}px`
          }}
          className="z-[20000] animate-enter overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl max-h-64 overflow-y-auto"
        >
          {loading && (
             <div className="p-3 text-center text-xs text-slate-500 font-medium">Searching...</div>
          )}
          
          {!loading && options.length === 0 && (
             <div className="p-3 text-center text-xs text-slate-500 font-medium">No employees found.</div>
          )}

          {!loading && options.map((emp) => (
            <button
              key={emp.employee_id}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                const email = emp.company_email_add || emp.personal_email_add || "";
                onChange(email);
                setQuery(email);
                setIsOpen(false);
              }}
              className="flex flex-col w-full text-left px-3 py-2 text-sm transition-colors border-b border-slate-50 last:border-0 hover:bg-slate-50"
            >
              <span className="font-medium text-slate-800 text-sm">
                 {emp.first_name} {emp.last_name} 
                 {emp.department && <span className="text-slate-400 font-normal ml-2 text-xs">{emp.department}</span>}
              </span>
              <span className="text-xs text-slate-500">{emp.company_email_add || emp.personal_email_add}</span>
            </button>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
}
