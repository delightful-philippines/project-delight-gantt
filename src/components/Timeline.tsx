import React, { useEffect, useRef } from "react";
import { Baseline, ProjectSheet, ZoomLevel } from "../types";
import { addDays, diffDays, parseISO, minDate, maxDate } from "../utils/date";

const ROW_HEIGHT = 48;
const HEADER_HEIGHT = 48;

interface Props {
  sheet: ProjectSheet;
  rowIds: string[];
  scrollTop: number;
  onScrollTop: (value: number) => void;
  viewportHeight: number;
  zoom: ZoomLevel;
  onEditTask: (task: any) => void; 
  showCriticalPath?: boolean;
  baseline?: Baseline;
  userRole: 'super_admin' | 'editor' | 'viewer';
}

function pxPerDay(zoom: ZoomLevel): number {
  if (zoom === "day") return 32;
  if (zoom === "week") return 10;
  return 3;
}

function stepByZoom(zoom: ZoomLevel): number {
  if (zoom === "day") return 1;
  if (zoom === "week") return 7;
  return 30;
}

const SVG_OFFSET_X = 24;

export const Timeline = React.memo(function Timeline({ 
  sheet, 
  rowIds, 
  scrollTop, 
  onScrollTop, 
  viewportHeight, 
  zoom, 
  onEditTask,
  showCriticalPath = false,
  baseline,
  userRole
}: Props): JSX.Element {
  const ref = useRef<HTMLDivElement>(null);
  const scale = pxPerDay(zoom);
  const step = stepByZoom(zoom);
  const labelStep = Math.max(step, Math.ceil(120 / (scale * step)) * step);

  const taskList = Object.values(sheet.tasksById);
  const taskStarts = taskList.map(t => t.start_date);
  const taskEnds = taskList.map(t => t.end_date);
  
  const minStart = minDate(sheet.project.start_date, ...taskStarts);
  const maxEnd = maxDate(sheet.project.end_date || addDays(minStart, 45), ...taskEnds);
  // Reduce buffer to 15 days to keep the timeline tight
  const totalDays = Math.max(60, diffDays(minStart, addDays(maxEnd, 15)));
  const width = totalDays * scale + 50 + SVG_OFFSET_X;
  const chartWidth = Math.max(width, 1000);
  const totalHeight = rowIds.length * ROW_HEIGHT + HEADER_HEIGHT;
  const startIndex = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - 8);
  const endIndex = Math.min(rowIds.length, startIndex + Math.ceil(viewportHeight / ROW_HEIGHT) + 16);
  const visible = rowIds.slice(startIndex, endIndex);
  const todayX = diffDays(minStart, new Date().toISOString().slice(0, 10)) * scale;

  const scrollToToday = () => {
    if (ref.current) {
      ref.current.scrollTo({ left: Math.max(0, todayX - ref.current.clientWidth / 2), behavior: 'smooth' });
    }
  };

  return (
    <section className="min-h-full min-w-0 bg-white shadow-inner flex flex-col relative">
      <div className="scroll-premium flex-1 overflow-x-auto overflow-y-visible" ref={ref}>
        <div className="sticky top-0 z-[110] bg-white w-max">
          <svg width={chartWidth} height={HEADER_HEIGHT} className="select-none block">
            <g transform={`translate(${SVG_OFFSET_X}, 0)`}>
              {/* Header Background */}
              <rect x={-SVG_OFFSET_X} y={0} width={chartWidth} height={HEADER_HEIGHT} fill="#f8fafc" />
              <line x1={-SVG_OFFSET_X} x2={chartWidth - SVG_OFFSET_X} y1={HEADER_HEIGHT} y2={HEADER_HEIGHT} stroke="#e2e8f0" strokeWidth="1" />

              {/* Today Indicator (Top Part) */}
              <g>
                <line x1={todayX} x2={todayX} y1={0} y2={HEADER_HEIGHT} stroke="#3b82f6" strokeWidth="1.5" strokeDasharray="3 3" opacity="0.6" />
                <circle cx={todayX} cy={HEADER_HEIGHT / 2} r="3" fill="#3b82f6" />
                <circle cx={todayX} cy={HEADER_HEIGHT / 2} r="6" fill="#3b82f6" opacity="0.15" />
              </g>

              {/* Time Rulers */}
              {Array.from({ length: Math.ceil(totalDays / step) }).map((_, idx) => {
                const day = idx * step;
                const x = day * scale;
                const date = parseISO(addDays(minStart, day));
                const monthLabel = date.toLocaleDateString(undefined, { month: "short", year: "2-digit" });
                const dayLabel = date.toLocaleDateString(undefined, { weekday: "short" }).slice(0, 1);
                const dayNum = date.toLocaleDateString(undefined, { day: "numeric" });
                const prevMonth = day > 0 ? parseISO(addDays(minStart, day - step)).getMonth() : -1;
                const isNewMonth = date.getMonth() !== prevMonth;

                return (
                  <g key={`tick_h_${idx}`}>
                    {isNewMonth && (
                      <>
                        <line x1={x} x2={x} y1={0} y2={HEADER_HEIGHT} stroke="#f1f5f9" strokeWidth="1" />
                        <text x={x + 8} y={18} className="fill-slate-400 text-xs font-medium uppercase tracking-wider">{monthLabel}</text>
                      </>
                    )}
                    {day % labelStep === 0 && (
                      <g>
                        <text x={x + 4} y={HEADER_HEIGHT - 12} className="fill-slate-400 font-mono text-xs font-medium">
                          <tspan className="fill-slate-300 font-normal">{dayLabel}</tspan> {dayNum}
                        </text>
                      </g>
                    )}
                  </g>
                );
              })}
            </g>
          </svg>
        </div>

        <svg width={chartWidth} height={totalHeight} className="select-none block" style={{ marginTop: -HEADER_HEIGHT }}>
          <g transform={`translate(${SVG_OFFSET_X}, 0)`}>
            <defs>
              <linearGradient id="barGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="rgba(255,255,255,0.1)" />
                <stop offset="100%" stopColor="rgba(255,255,255,0)" />
              </linearGradient>
              <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="1" stdDeviation="2" floodOpacity="0.1" />
              </filter>
              <marker
                id="arrowhead"
                markerWidth="8"
                markerHeight="6"
                refX="7"
                refY="3"
                orient="auto"
              >
                <path d="M 0 0 L 8 3 L 0 6 Z" fill="#cbd5e1" />
              </marker>
              <marker
                id="arrowhead-critical"
                markerWidth="8"
                markerHeight="6"
                refX="7"
                refY="3"
                orient="auto"
              >
                <path d="M 0 0 L 8 3 L 0 6 Z" fill="#f87171" />
              </marker>
            </defs>

            {/* Header Background */}
            <rect x={-SVG_OFFSET_X} y={0} width={chartWidth} height={HEADER_HEIGHT} fill="#f8fafc" />
            <line x1={-SVG_OFFSET_X} x2={chartWidth - SVG_OFFSET_X} y1={HEADER_HEIGHT} y2={HEADER_HEIGHT} stroke="#e2e8f0" strokeWidth="1" />

            {/* Grid Columns */}
            {Array.from({ length: totalDays }).map((_, i) => (
              <g key={`grid_${i}`}>
                {i % 7 >= 5 && <rect x={i * scale} y={HEADER_HEIGHT} width={scale} height={totalHeight - HEADER_HEIGHT} fill="#f1f5f9" opacity="0.4" />}
                <line x1={i * scale} x2={i * scale} y1={HEADER_HEIGHT} y2={totalHeight} stroke="#f1f5f9" strokeWidth="1" />
              </g>
            ))}

            {/* Time Rulers (Vertical Lines only) */}
            {Array.from({ length: Math.ceil(totalDays / step) }).map((_, idx) => {
              const day = idx * step;
              const x = day * scale;
              const date = parseISO(addDays(minStart, day));
              const prevMonth = day > 0 ? parseISO(addDays(minStart, day - step)).getMonth() : -1;
              const isNewMonth = date.getMonth() !== prevMonth;
              if (!isNewMonth) return null;
              return <line key={`v_tick_${idx}`} x1={x} x2={x} y1={HEADER_HEIGHT} y2={totalHeight} stroke="#f1f5f9" strokeWidth="1" />;
            })}

            {/* Today Indicator */}
            <g>
              <rect x={todayX - 1} y={HEADER_HEIGHT} width="2" height={totalHeight - HEADER_HEIGHT} fill="#3b82f6" opacity="0.1" />
              <line x1={todayX} x2={todayX} y1={HEADER_HEIGHT} y2={totalHeight} stroke="#3b82f6" strokeWidth="1.5" strokeDasharray="3 3" opacity="0.6" />
            </g>

            {/* Parent-Subtask Connector Lines */}
            <g className="parent-subtask-connectors">
              {(() => {
                const rowIndexMap = new Map<string, number>();
                rowIds.forEach((id, idx) => rowIndexMap.set(id, idx));

                return rowIds.map((taskId) => {
                  const parent = sheet.tasksById[taskId];
                  const childrenIds = sheet.childrenByParentId[taskId] || [];
                  
                  // Only render if there are visible (expanded) children
                  const visibleChildren = childrenIds.filter(id => rowIndexMap.has(id));
                  if (visibleChildren.length === 0) return null;

                  const parentRow = rowIndexMap.get(taskId)!;
                  const parentX = diffDays(minStart, parent.start_date) * scale;
                  const parentY = HEADER_HEIGHT + parentRow * ROW_HEIGHT + ROW_HEIGHT / 2;

                  // Find vertical extent
                  const childRows = visibleChildren.map(id => rowIndexMap.get(id)!);
                  const minChildRow = Math.min(...childRows);
                  const maxChildRow = Math.max(...childRows);
                  const lastChildY = HEADER_HEIGHT + maxChildRow * ROW_HEIGHT + ROW_HEIGHT / 2;

                  // Connector logic: 
                  // 1. Horizontal stub left from parent start
                  // 2. Vertical line down to last child level
                  // 3. Horizontal stubs right to each child start
                  const offset = 12; // Pixels to the left of the parent bar
                  const connectorX = parentX - offset;

                  // Create paths
                  return (
                    <g key={`connectors-${taskId}`}>
                      {/* Parent Horizontal Stub */}
                      <path 
                        d={`M ${parentX} ${parentY} L ${connectorX} ${parentY}`} 
                        stroke="#e2e8f0" 
                        strokeWidth="1" 
                        fill="none" 
                      />
                      {/* Main Vertical Spine */}
                      <path 
                        d={`M ${connectorX} ${parentY} L ${connectorX} ${lastChildY}`} 
                        stroke="#e2e8f0" 
                        strokeWidth="1" 
                        fill="none" 
                      />
                      {/* Individual Child Stubs */}
                      {visibleChildren.map(childId => {
                        const child = sheet.tasksById[childId];
                        const childRow = rowIndexMap.get(childId)!;
                        const childX = diffDays(minStart, child.start_date) * scale;
                        const childY = HEADER_HEIGHT + childRow * ROW_HEIGHT + ROW_HEIGHT / 2;
                        return (
                          <path 
                            key={`stub-${taskId}-${childId}`}
                            d={`M ${connectorX} ${childY} L ${childX} ${childY}`}
                            stroke="#e2e8f0"
                            strokeWidth="1"
                            fill="none"
                          />
                        );
                      })}
                    </g>
                  );
                });
              })()}
            </g>

            {/* Dependency Lines */}
            <g className="dependency-lines">
              {(() => {
                const rowIndexMap = new Map<string, number>();
                rowIds.forEach((id, idx) => rowIndexMap.set(id, idx));

                return rowIds.flatMap((taskId) => {
                  const task = sheet.tasksById[taskId];
                  if (!task.dependencies?.length) return [];

                  const targetRow = rowIndexMap.get(taskId) ?? -1;
                  if (targetRow === -1) return [];

                  const targetX = diffDays(minStart, task.start_date) * scale;
                  const targetY = HEADER_HEIGHT + targetRow * ROW_HEIGHT + ROW_HEIGHT / 2;

                  return task.dependencies.map(predId => {
                    const pred = sheet.tasksById[predId];
                    if (!pred) return null;

                    const predRow = rowIndexMap.get(predId) ?? -1;
                    if (predRow === -1) return null;

                    const predEndX = (diffDays(minStart, pred.start_date) + (pred.is_milestone ? 0 : pred.duration)) * scale;
                    const predY = HEADER_HEIGHT + predRow * ROW_HEIGHT + ROW_HEIGHT / 2;

                    // Elbow logic: Finish-to-Start
                    // 1. Draw out from end of predecessor
                    // 2. Vertical to target row
                    // 3. Horizontal to start of target task
                    const exitX = predEndX + 12; // Small exit tail
                    const entryX = targetX - 8;  // Small entry tail
                    
                    // If predecessor is after successor (negative lag), adjust
                    const isBackwards = predEndX > targetX - 20;
                    const pathX = isBackwards ? Math.max(predEndX, targetX) + 20 : (predEndX + targetX) / 2;

                    let d = "";
                    if (!isBackwards) {
                      // Standard s-curve elbow
                      d = `M ${predEndX} ${predY} L ${pathX} ${predY} L ${pathX} ${targetY} L ${targetX} ${targetY}`;
                    } else {
                      // Loop-around elbow for backwards dependencies
                      d = `M ${predEndX} ${predY} L ${exitX} ${predY} L ${exitX} ${(predY + targetY) / 2} L ${entryX} ${(predY + targetY) / 2} L ${entryX} ${targetY} L ${targetX} ${targetY}`;
                    }

                    return (
                      <path
                        key={`${predId}-${taskId}`}
                        d={d}
                        fill="none"
                        stroke={showCriticalPath && task.is_critical && pred.is_critical ? "#f87171" : "#cbd5e1"}
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        opacity={showCriticalPath && task.is_critical && pred.is_critical ? "0.8" : "0.5"}
                        markerEnd={`url(#${showCriticalPath && task.is_critical && pred.is_critical ? "arrowhead-critical" : "arrowhead"})`}
                        className="transition-all duration-300"
                      />
                    );
                  });
                });
              })()}
            </g>

            {/* Task Bars */}
            {visible.map((taskId, i) => {
              const row = startIndex + i;
              const task = sheet.tasksById[taskId];
              const x = diffDays(minStart, task.start_date) * scale;
              const w = Math.max(scale, task.duration * scale);
              const progressW = w * (task.progress / 100);
              
              const barHeight = 24;
              const y = HEADER_HEIGHT + row * ROW_HEIGHT + (ROW_HEIGHT - barHeight) / 2;
              const rx = 6;
              const fill = task.bg_color;

              // Helper for sharp left corners
              const getBarPath = (bx: number, by: number, bw: number, bh: number, br: number) => {
                const r = Math.min(br, bw / 2);
                return `M ${bx} ${by} L ${bx + bw - r} ${by} Q ${bx + bw} ${by} ${bx + bw} ${by + r} L ${bx + bw} ${by + bh - r} Q ${bx + bw} ${by + bh} ${bx + bw - r} ${by + bh} L ${bx} ${by + bh} Z`;
              };

              if (task.is_milestone) {
                // ... (Diamond logic remains same)
                const midY = y + barHeight / 2;
                return (
                  <g 
                    key={task.id} 
                    className="cursor-pointer transition-transform hover:scale-110 group"
                    onClick={() => onEditTask(task)}
                  >
                    <path
                      d={`M ${x} ${midY - 8} L ${x + 8} ${midY} L ${x} ${midY + 8} L ${x - 8} ${midY} Z`}
                      fill={fill}
                      stroke={showCriticalPath && task.is_critical ? "#ff4757" : "none"}
                      strokeWidth={showCriticalPath && task.is_critical ? 2 : 0}
                      className="shadow-sm"
                    />
                    <text 
                      x={x + 12} 
                      y={midY + 4} 
                      fill="#64748b" 
                      className="pointer-events-none text-xs font-medium"
                    >
                      {task.progress}%
                    </text>
                  </g>
                );
              }

              return (
                <g 
                  key={task.id} 
                  className="cursor-pointer transition-opacity hover:opacity-100 opacity-90 group"
                  onClick={() => onEditTask(task)}
                >
                  {/* Baseline Comparison (Ghost Bar) */}
                  {baseline && baseline.tasksById[task.id] && (
                    <rect
                      x={diffDays(minStart, baseline.tasksById[task.id].start_date) * scale}
                      y={y + barHeight - 4}
                      width={Math.max(2, (baseline.tasksById[task.id].duration || 0.5) * scale)}
                      height={4}
                      rx={1}
                      fill="#cbd5e1"
                      className="opacity-40"
                    />
                  )}

                  {/* Background Track (Total Duration) */}
                  <path
                    d={getBarPath(x, y, w, barHeight, rx)}
                    fill={fill}
                    className="opacity-20 group-hover:opacity-30 transition-opacity"
                  />
                  
                  {/* Critical Path Border */}
                  {showCriticalPath && task.is_critical && (
                    <path
                      d={getBarPath(x, y, w, barHeight, rx)}
                      fill="none"
                      stroke="#ff4757"
                      strokeWidth={2}
                    />
                  )}

                  {/* Progress Overlay (Done) */}
                  {progressW > 0 && (
                    <path
                      d={getBarPath(x, y, progressW, barHeight, rx)}
                      fill={fill}
                      className={task.is_summary ? "opacity-90" : "opacity-100"}
                      filter="url(#shadow)"
                    />
                  )}
                  
                  {/* Task Label on Right */}
                  <text 
                    x={x + w + 12} 
                    y={y + barHeight / 2 + 3.5} 
                    fill={fill} 
                    className={`pointer-events-none text-xs ${task.is_summary ? "font-bold" : "font-medium"} opacity-80`}
                  >
                    {task.progress}%
                  </text>

                  {/* Task Name INSIDE Bar */}
                  {!task.is_milestone && w > 40 && (
                    <foreignObject 
                      x={x + 8} 
                      y={y} 
                      width={w - 16} 
                      height={barHeight}
                      className="pointer-events-none"
                    >
                      <div className="flex h-full w-full items-center overflow-hidden">
                        <span className="w-full truncate text-[9px] font-bold uppercase tracking-wider text-white mix-blend-overlay opacity-90">
                          {task.title}
                        </span>
                      </div>
                    </foreignObject>
                  )}
                </g>
              );
            })}
          </g>
        </svg>
      </div>
    </section>
  );
});
