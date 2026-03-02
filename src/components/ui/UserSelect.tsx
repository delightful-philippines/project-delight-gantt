import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { UserAvatar } from "./UserAvatar";
import { DBUser } from "../../lib/api";

interface UserSelectProps {
  users: DBUser[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
}

export function UserSelect({
  users,
  value,
  onChange,
  className = "",
  placeholder = "Select assignee...",
}: UserSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [rect, setRect] = useState<{ top: number; left: number; width: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedUser = users.find((u) => u.email === value);

  useEffect(() => {
    if (isOpen && containerRef.current) {
      const updatePosition = () => {
        const r = containerRef.current?.getBoundingClientRect();
        if (r) setRect({ top: r.bottom, left: r.left, width: r.width });
      };
      updatePosition();
      window.addEventListener('scroll', updatePosition, true);
      window.addEventListener('resize', updatePosition);
      
      // Auto focus search input when opening
      setTimeout(() => {
        inputRef.current?.focus();
      }, 0);

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
        const portal = document.getElementById("user-select-portal");
        if (portal && portal.contains(event.target as Node)) return;
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const getUserDisplayName = (user: DBUser) => {
    let displayName = user.email;
    if (user.first_name && user.last_name) displayName = `${user.first_name} ${user.last_name}`;
    else if (user.first_name) displayName = user.first_name;
    
    // Apply Title Case to whatever display name we ended up with (unless it's an email)
    if (displayName !== user.email && displayName.includes(' ') === false) {
      return displayName.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
    } else if (displayName !== user.email) {
       return displayName.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
    }
    
    return displayName;
  };

  const filteredUsers = users.filter((u) => {
    const searchStr = searchTerm.toLowerCase();
    const fullName = `${u.first_name || ""} ${u.last_name || ""}`.toLowerCase();
    return (
      u.email.toLowerCase().includes(searchStr) ||
      fullName.includes(searchStr)
    );
  });

  return (
    <div ref={containerRef} className={`relative select-none ${className}`}>
      <button
        type="button"
        onClick={() => {
          setIsOpen(!isOpen);
          setSearchTerm("");
        }}
        className="flex h-11 w-full items-center justify-between rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition-all hover:border-slate-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
      >
        <div className="flex items-center gap-2 truncate">
          {selectedUser ? (
            <>
              <UserAvatar email={selectedUser.email} size="xs" />
              <div className="flex flex-col items-start leading-tight truncate">
                <span className="text-slate-900 font-medium truncate">{getUserDisplayName(selectedUser)}</span>
                {selectedUser.first_name && <span className="text-xs text-slate-400 truncate">{selectedUser.email}</span>}
              </div>
            </>
          ) : (
            <span className="text-slate-400">{placeholder}</span>
          )}
        </div>
        <svg
          className={`h-4 w-4 text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && rect && createPortal(
        <div 
          id="user-select-portal"
          style={{ 
            position: 'fixed', 
            top: `${rect.top + 8}px`, 
            left: `${rect.left}px`,
            width: `${rect.width}px`
          }}
          className="z-[20000] animate-enter overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl"
        >
          {/* Search Input */}
          <div className="p-2 border-b border-slate-100 bg-slate-50/50">
            <div className="relative">
              <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                ref={inputRef}
                type="text"
                placeholder="Search users..."
                className="w-full pl-8 pr-3 py-2 bg-white border border-slate-200 rounded-md text-sm font-medium focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 transition-all"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          </div>

          <div className="max-h-64 overflow-y-auto p-1 scroll-premium">
            {filteredUsers.length === 0 ? (
              <div className="px-3 py-4 text-center">
                <p className="text-xs font-medium text-slate-400 uppercase tracking-widest leading-none">No users found</p>
              </div>
            ) : (
              <>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onChange("");
                      setIsOpen(false);
                    }}
                    className="flex w-full items-center px-3 py-2.5 text-sm transition-colors rounded-md text-slate-500 hover:bg-slate-50 italic"
                  >
                    Unassigned
                  </button>
                  {filteredUsers.slice(0, 80).map((user) => (
                    <button
                      key={user.email}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onChange(user.email);
                        setIsOpen(false);
                      }}
                      className={`flex w-full items-center gap-3 px-3 py-2.5 text-sm transition-colors rounded-md ${
                        user.email === value
                          ? "bg-blue-50 text-blue-700 font-medium"
                          : "text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                    <UserAvatar email={user.email} size="sm" />
                    <div className="flex flex-col items-start leading-tight truncate">
                      <span className="font-medium truncate">{getUserDisplayName(user)}</span>
                      {user.first_name && <span className="text-xs text-slate-400 truncate">{user.email}</span>}
                    </div>
                    {user.email === value && (
                      <svg className="ml-auto h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </button>
                ))}
              </>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
