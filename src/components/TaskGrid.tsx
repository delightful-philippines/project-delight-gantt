import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ProjectSheet, Task } from "../types";
import { UserAvatar } from './ui/UserAvatar';
import { DBUser } from "../lib/api";

const ROW_HEIGHT = 48;
const GRID_COLUMNS = "minmax(180px, 1.4fr) 100px 100px 70px 70px 100px 42px";

interface Props {
  sheet: ProjectSheet;
  rowIds: string[];
  scrollTop: number;
  onScrollTop: (value: number) => void;
  onViewportHeight: (value: number) => void;
  viewportHeight: number;
  onAddSubtask: (parentTask: Task) => void;
  onEditTask: (task: Task) => void;
  onDeleteTask: (task: Task) => void;
  userRole: 'super_admin' | 'editor' | 'viewer';
  systemUsers?: DBUser[];
  collapsedTaskIds?: Set<string>;
  onToggleCollapse?: (taskId: string) => void;
}

function DotsVerticalIcon(): JSX.Element {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="1.2" />
      <circle cx="12" cy="5" r="1.2" />
      <circle cx="12" cy="19" r="1.2" />
    </svg>
  );
}

export const TaskGrid = React.memo(function TaskGrid({
  sheet,
  rowIds,
  scrollTop,
  onScrollTop,
  onViewportHeight,
  viewportHeight,
  onAddSubtask,
  onEditTask,
  onDeleteTask,
  userRole,
  systemUsers = [],
  collapsedTaskIds = new Set(),
  onToggleCollapse,
}: Props): JSX.Element {
  const ref = useRef<HTMLDivElement>(null);
  const [openMenuTaskId, setOpenMenuTaskId] = useState<string | null>(null);
  const [rect, setRect] = useState<{ top: number; left: number; width: number } | null>(null);

  useEffect(() => {
    const onDocDown = (e: MouseEvent): void => {
      if ((e.target as HTMLElement).closest('.task-menu-dropdown')) return;
      setOpenMenuTaskId(null);
    };
    document.addEventListener("mousedown", onDocDown);
    return () => document.removeEventListener("mousedown", onDocDown);
  }, []);

  // Start/End indices for virtualization
  const [startIndex, endIndex] = useMemo(() => {
    const buffer = 10;
    const from = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - buffer);
    const to = Math.min(rowIds.length, from + Math.ceil((viewportHeight || 620) / ROW_HEIGHT) + buffer * 2);
    return [from, to];
  }, [rowIds.length, scrollTop, viewportHeight]);
  const visible = rowIds.slice(startIndex, endIndex);

  return (
    <section className="min-h-full min-w-0 border-r border-slate-200 bg-white flex flex-col">
      <div className="min-h-0 flex-1">
        <div
          className="sticky top-0 z-100 grid h-12 items-center border-b border-slate-200 bg-white/95 backdrop-blur-sm text-xs font-medium uppercase tracking-wider text-slate-400"
          style={{ gridTemplateColumns: GRID_COLUMNS, width: 'max-content', minWidth: '100%' }}
        >
          <div className="px-4">Task</div>
          <div className="px-4">Start</div>
          <div className="px-4">End</div>
          <div className="px-4">Days</div>
          <div className="px-4" />
          <div className="px-4">Progress</div>
          <div className="sticky right-0 bg-white/95 border-l border-slate-100 h-full" />
        </div>
        
        <div style={{ height: rowIds.length * ROW_HEIGHT, position: "relative", width: '100%' }}>
          {rowIds.length === 0 && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-slate-300 py-12">
              <svg className="w-10 h-10 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <p className="text-xs font-medium uppercase tracking-widest">No tasks yet</p>
            </div>
          )}
          {visible.map((taskId, i) => {
            const row = startIndex + i;
            const task = sheet.tasksById[taskId];
            const progress = task.progress;
            const isSelected = openMenuTaskId === task.id;
            
            return (
              <div
                key={task.id}
                className={`group absolute left-0 grid items-center border-b border-slate-50/80 transition-all duration-200 hover:bg-slate-50/80 hover:shadow-[0_2px_12px_-4px_rgba(0,0,0,0.05)] ${task.is_summary ? "bg-slate-50/20" : "bg-white"}`}
                style={{ 
                  top: row * ROW_HEIGHT, 
                  height: ROW_HEIGHT, 
                  gridTemplateColumns: GRID_COLUMNS, 
                  width: '100%',
                  zIndex: isSelected ? 90 : 30
                }}
              >
                <div className="flex items-center gap-2 overflow-hidden px-4" style={{ paddingLeft: `${task.level * 16 + 16}px` }}>
                  {/* Collapse/Expand chevron — shown for tasks that have children */
                  (() => {
                    const hasChildren = !!(sheet.childrenByParentId[task.id]?.length);
                    const isCollapsed = collapsedTaskIds.has(task.id);
                    if (hasChildren) {
                      return (
                        <button
                          type="button"
                          onClick={e => { e.stopPropagation(); onToggleCollapse?.(task.id); }}
                          className="shrink-0 text-slate-400 hover:text-slate-700 transition-all"
                          title={isCollapsed ? "Expand" : "Collapse"}
                        >
                          <svg
                            className={`w-3 h-3 transition-transform duration-200 ${isCollapsed ? "" : "rotate-90"}`}
                            fill="none" stroke="currentColor" viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </button>
                      );
                    }
                    // Subtask indent indicator (no children)
                    if (task.level > 0) {
                      return (
                        <span className="shrink-0 w-3 h-3 flex items-center justify-center text-slate-200">
                          <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </span>
                      );
                    }
                    return null;
                  })()}
                  <span 
                    className="h-2 w-2 flex-none rounded-full ring-2 ring-white shadow-sm" 
                    style={{ backgroundColor: task.bg_color }}
                  />
                  <span className="truncate text-sm tracking-tight text-slate-700 font-medium">{task.title}</span>
                </div>

                <div className="px-4 text-xs tabular-nums text-slate-400 font-medium font-mono truncate">
                  {task.start_date.slice(5)}
                </div>
                
                <div className="px-4 text-xs tabular-nums text-slate-400 font-medium font-mono truncate">
                  {task.end_date.slice(5)}
                </div>
                
                <div className="px-4 text-xs font-medium text-slate-400 font-mono">
                  {task.duration}
                </div>
                
                <div className="px-4 overflow-visible flex items-center">
                  {(() => {
                    const assignee = task.assignee;
                    if (!assignee) return <span className="text-xs font-bold text-slate-300 uppercase tracking-tighter">None</span>;
                    
                    const user = systemUsers.find(u => u.email === assignee);
                    const formattedName = user?.first_name 
                      ? `${user.first_name} ${user.last_name || ''}`.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')
                      : assignee;

                    return (
                      <div className="group/assignee relative">
                        <UserAvatar 
                          email={assignee.includes('@') ? assignee : undefined} 
                          name={formattedName} 
                          size="xs" 
                          activeColor={task.bg_color}
                          className="hover:scale-125 transition-transform cursor-pointer ring-2 ring-white shadow-sm"
                        />
                      </div>
                    );
                  })()}
                </div>
                
                <div className="flex items-center gap-3 px-4 mr-4">
                  <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden flex-1 max-w-15 shadow-[inset_0_1px_2px_rgba(0,0,0,0.05)]">
                    <div 
                      className="h-full rounded-full transition-all duration-500 shadow-[inset_0_-1px_1px_rgba(0,0,0,0.1)] relative overflow-hidden" 
                      style={{ width: `${progress}%`, backgroundColor: task.bg_color }} 
                    >
                      <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent" />
                    </div>
                  </div>
                  <span 
                    className="text-xs font-semibold w-7 text-right tracking-tight" 
                    style={{ color: task.bg_color }}
                  >
                    {progress}%
                  </span>
                </div>
                
                <div className={`sticky right-0 h-full border-l border-slate-50 bg-inherit px-2 ${isSelected ? "z-95" : "z-80"}`}>
                  <div className="flex h-full items-center justify-center relative">
                    <button
                      className={`inline-flex h-7 w-7 items-center justify-center rounded-lg transition-all ${isSelected ? "bg-slate-800 text-white" : "text-slate-300 hover:bg-slate-100 hover:text-slate-600"}`}
                      ref={(el) => {
                        if (isSelected && el) {
                          const r = el.getBoundingClientRect();
                          if (!rect || rect.top !== r.top || rect.left !== r.left) {
                            setRect({ top: r.top, left: r.left, width: r.width });
                          }
                        }
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenMenuTaskId((cur: string | null) => (cur === task.id ? null : task.id));
                      }}
                    >
                      <DotsVerticalIcon />
                    </button>
                    
                    {isSelected && rect && createPortal(
                      <div 
                        id="task-menu-portal"
                        style={{ position: "fixed", top: `${rect.top}px`, left: `${rect.left - 164}px` }}
                        className="task-menu-dropdown z-9999 w-40 animate-enter rounded-lg border border-slate-200 bg-white p-1 shadow-xl"
                      >
                        {[
                          { label: "Subtask", icon: <path d="M12 4v16m8-8H4" />, onClick: () => onAddSubtask(task) },
                          { label: "Edit", icon: <path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />, onClick: () => onEditTask(task) },
                          { label: "Remove", icon: <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />, onClick: () => onDeleteTask(task), danger: true }
                        ].map(item => (
                          <button
                            key={item.label}
                            className={`flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-sm font-medium transition-colors ${item.danger ? "text-red-500 hover:bg-red-50" : "text-slate-600 hover:bg-slate-50"}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              item.onClick();
                              setOpenMenuTaskId(null);
                            }}
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">{item.icon}</svg>
                            {item.label}
                          </button>
                        ))}
                      </div>,
                      document.body
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
});

