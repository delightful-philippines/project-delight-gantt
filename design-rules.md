# Design Rules — Project Delight Gantt

Design system reference for maintaining visual consistency across all components.

---

## Typography

### Font Families
| Role | Family | Import |
|------|--------|--------|
| **Sans (default)** | `Inter` → system fallback stack | Google Fonts, weights 400/500/600 |
| **Mono** | `Space Mono` | Google Fonts, weights 400/500 |

```css
--font-sans: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
--font-mono: "Space Mono", monospace;
```

### Text Sizes (custom overrides)
| Token | Value | Use |
|-------|-------|-----|
| `text-xs` | **11px** | Labels, tags, meta, uppercase captions |
| `text-sm` | **13px** | Body copy, form fields, secondary content |
| `text-base` | Tailwind default (16px) | Page headings |
| `text-lg` | Tailwind default (18px) | Card titles, section headers |
| `text-xl` | Tailwind default (20px) | Large headings, access-denied screens |

### Text Style Patterns
| Pattern | Classes | Use |
|---------|---------|-----|
| Page title | `text-base lg:text-lg font-medium tracking-tight text-slate-800` | Shell header |
| Card title | `text-lg font-medium tracking-tight text-slate-900` | Project card names |
| Section heading | `text-xl font-medium text-slate-900` | Page-level headings |
| Body / description | `text-sm text-slate-500 font-medium leading-relaxed` | Descriptive body text |
| Muted meta | `text-xs text-slate-400 font-medium` | Dates, counts, placeholders |
| Uppercase label | `text-xs font-bold uppercase tracking-widest text-slate-400` | Section labels, role badges |
| Uppercase tag (colored) | `text-xs font-medium uppercase tracking-widest text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md` | BU / context badges in header |

---

## Color Palette

### Brand Colors
| Token | Hex | Tailwind |
|-------|-----|---------|
| `--color-brand-primary` | `#3b82f6` | `blue-500` / `blue-600` |
| `--color-brand-secondary` | `#6366f1` | `indigo-500` |
| `--color-accent` | `#f43f5e` | `rose-500` |

### Semantic / State Colors
| State | Background | Border | Text / Icon |
|-------|-----------|--------|-------------|
| **Info / Primary** | `bg-blue-50` | `border-blue-100` | `text-blue-600` |
| **Success** | `bg-emerald-50` | — | `text-emerald-600` / `text-emerald-500` |
| **Warning** | `bg-amber-50` | — | `text-amber-600` / `text-amber-500` |
| **Danger** | `bg-red-50` | `border-red-100` | `text-red-600` / `text-red-500` |

### Surface Colors
| Surface | Classes |
|---------|---------|
| Page background | `bg-slate-100` / `bg-slate-50` |
| Card / panel | `bg-white` |
| Input background | `bg-slate-100/30` (default) → `bg-white` (focused) |
| Subtle chip / badge | `bg-slate-50 border border-slate-100` |
| Active tab pill | `bg-white shadow-sm` inside `bg-slate-100` container |
| Sidebar | `bg-white/80 backdrop-blur-3xl` |
| Header | `bg-white/70 backdrop-blur-2xl` |
| Modal backdrop | `bg-slate-900/60 backdrop-blur-md` |
| Dialog backdrop | `bg-slate-900/50 backdrop-blur-sm` |

### Text Colors (semantic)
| Use | Class |
|-----|-------|
| Primary text | `text-slate-900` |
| Strong secondary | `text-slate-800` |
| Secondary / label | `text-slate-700` |
| Muted body | `text-slate-500` |
| Placeholder / hint | `text-slate-400` |
| Disabled / decorative | `text-slate-300` |
| On dark / toast title | `text-white` |

### Border Colors
| Use | Class |
|-----|-------|
| Default divider | `border-slate-200` |
| Subtle divider | `border-slate-100` |
| Semi-transparent card border | `border-slate-200/60` |
| Glass border | `border-white/40` |

---

## Border Radius

| Size | Tailwind | Use |
|------|---------|-----|
| **`rounded-3xl`** | 24px | `.card-premium` — project cards, major panels |
| **`rounded-2xl`** | 16px | Modals, dialogs, toasts |
| **`rounded-xl`** | 12px | Buttons (`.btn-premium`), inputs, icon containers, sidebar nav buttons |
| **`rounded-lg`** | 8px | Smaller buttons, dropdown menus, contextual panels, tooltips |
| **`rounded-md`** | 6px | Inline close buttons, micro chips |
| **`rounded-full`** | 9999px | Avatars, progress bars, scrollbar thumbs, pill toggles |

---

## Spacing & Sizing

### Component Heights
| Component | Class |
|-----------|-------|
| Standard button (`.btn-premium`) | `h-11` (44px) |
| Smaller button | `h-10` (40px) |
| Icon-only button | `h-9 w-9` (36px) |
| Micro icon button | `h-6 w-6` (24px) |
| Sidebar icon button | `h-10 w-10` (40px) |
| Header | `h-[65px]` |
| Icon container (dialog) | `h-12 w-12` (48px) |
| Avatar (large) | `h-16 w-16` |

### Layout
| Area | Classes |
|------|---------|
| Sidebar width | `w-18` (72px), fixed left |
| Main content offset | `pl-0 lg:pl-18` |
| Content padding | `p-4 lg:p-10` |
| Card grid | `grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6` |
| Card internal padding | `p-6` |

---

## Shadows

| Context | Value |
|---------|-------|
| Card (resting) | `box-shadow: 0 4px 20px -2px rgba(0,0,0,0.04), 0 0 1px rgba(0,0,0,0.01)` |
| Card (hover) | `shadow-[0_12px_40px_rgba(0,0,0,0.08)]` |
| Header | `shadow-[0_4px_24px_-10px_rgba(0,0,0,0.05)]` |
| Sidebar | `shadow-[4px_0_24px_-10px_rgba(0,0,0,0.05)]` |
| Glass panel | `shadow-[0_8px_30px_rgb(0,0,0,0.04)]` |
| Dialog / Modal | `shadow-2xl` |
| Toast / Notification | `shadow-xl` |
| Active nav item | `shadow-lg shadow-blue-200` |
| Tooltip | `shadow-xl` |

---

## Buttons

### Variants

```
.btn-premium   h-11 rounded-xl px-5 text-sm font-medium inline-flex items-center gap-2
               active:scale-[0.98] transition-all

.btn-primary   bg-blue-600 text-white hover:bg-blue-700
.btn-secondary border border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50
.btn-danger    border border-red-100 bg-red-50 text-red-600 hover:border-red-200 hover:bg-red-100
.btn-ghost     text-slate-500 hover:bg-slate-100 hover:text-slate-700
```

### Interaction Pattern
- **Active feedback**: `active:scale-95` (inline) or `active:scale-[0.98]` (subtle for larger elements)
- **Focus ring**: `focus:ring-4 focus:ring-blue-500/10` (or variant-matched color at `/20`)
- **Transition**: `transition-all` on all interactive elements

---

## Inputs

```
.input-premium
  h-11 rounded-xl border border-slate-200
  bg-slate-100/30 px-4 text-sm text-slate-700
  outline-none transition-all placeholder:text-slate-400
  focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10
```

Inline search inputs (smaller, inside headers):
```
bg-slate-50 border border-slate-200 rounded-lg
text-xs font-medium focus:bg-white focus:ring-4 focus:ring-blue-500/10
pl-10 (with leading icon)
```

---

## Glass / Panel Classes

```css
.glass
  border border-white/40 bg-white/60
  backdrop-blur-xl
  shadow-[0_8px_30px_rgb(0,0,0,0.04)]

.glass-panel
  border border-slate-200/40 bg-slate-50/80
  backdrop-blur-2xl
  shadow-[0_8px_30px_rgb(0,0,0,0.04)]
  ring-1 ring-white/50

.card-premium
  rounded-3xl border border-slate-200/60 bg-white
  transition-all duration-500
  hover:shadow-[0_12px_40px_rgba(0,0,0,0.08)] hover:-translate-y-1
  active:scale-[0.98]
```

---

## Animation

### Named Animations
| Class | Description | Timing |
|-------|-------------|--------|
| `.animate-enter` | Fade + slide up 12px + blur-in from `blur(4px)` | 0.4s `cubic-bezier(0.16, 1, 0.3, 1)` |
| `.animate-fade-in` | Opacity 0 → 1 only | 0.3s `ease-out` |
| `.animate-tooltip-up` | Tooltip slides up from −90% → −100% | 0.2s `ease-out` |
| `.animate-tooltip-down` | Tooltip slides down from −4px → 0 | 0.2s `ease-out` |

### Hover Transitions
| Pattern | Classes | Where |
|---------|---------|-------|
| Card lift | `hover:-translate-y-1 transition-all duration-500` | `.card-premium` |
| Icon color swap | `group-hover:bg-blue-50 group-hover:text-blue-600 transition-all duration-300` | Card icon container |
| Text color swap | `group-hover:text-blue-600 transition-colors duration-300` | Card title, lead name |
| Scale press | `active:scale-95` / `active:scale-[0.98]` | Buttons, cards |

---

## Sidebar Navigation

| State | Classes |
|-------|---------|
| Active item (blue) | `bg-blue-600 text-white shadow-lg shadow-blue-200 rounded-xl` |
| Active item (amber — admin) | `bg-amber-600 text-white shadow-lg shadow-amber-200 rounded-xl` |
| Inactive item | `text-slate-400 hover:bg-slate-50 hover:text-blue-600 rounded-xl` |
| Tooltip label | `rounded-lg bg-slate-800 px-2 py-1 text-xs font-bold text-white uppercase tracking-wider shadow-xl` |

---

## Progress Bar

```html
<!-- Track -->
<div class="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
  <!-- Fill: blue-600 normally, emerald-500 at 100% -->
  <div class="h-full rounded-full transition-all duration-700 ease-out bg-blue-600"
       style="width: 72%"></div>
</div>
```

---

## Status / Variant System (Dialogs, Toasts, Icons)

| Variant | Icon bg | Icon color | Confirm button | Toast icon |
|---------|---------|-----------|---------------|-----------|
| `info` | `bg-blue-50` | `text-blue-600` | `bg-blue-600 hover:bg-blue-700` | `text-blue-500` |
| `success` | `bg-emerald-50` | `text-emerald-600` | `bg-emerald-600 hover:bg-emerald-700` | `text-emerald-500` |
| `warning` | `bg-amber-50` | `text-amber-600` | `bg-amber-500 hover:bg-amber-600` | `text-amber-500` |
| `danger` | `bg-red-50` | `text-red-600` | `bg-red-600 hover:bg-red-700` | `text-red-500` |

---

## Scrollbar

```css
/* Apply .scroll-premium to scrollable containers */
::-webkit-scrollbar        { width: 6px; height: 6px; }
::-webkit-scrollbar-track  { background: transparent; }
::-webkit-scrollbar-thumb  { border-radius: 9999px; background: theme(colors.slate.200); }
::-webkit-scrollbar-thumb:hover { background: theme(colors.slate.300); }

/* Hide scrollbar entirely: .no-scrollbar */
```

---

## Z-Index Scale (reference)

| Layer | Value |
|-------|-------|
| Sidebar | `z-200` |
| Header | `z-150` |
| Dropdown menus | `z-100` to `z-110` |
| Modals / Dialogs | `z-[99999]` / `z-10000` |
| Backdrop overlay | `z-100` |
| Toast / Notifications | `z-[99999]` / `z-1000` |

---

## Tooltip Pattern

```html
<span class="absolute left-full ml-3 hidden group-hover:block whitespace-nowrap
             rounded-lg bg-slate-800 px-2 py-1
             text-xs font-bold text-white uppercase tracking-wider
             shadow-xl z-300">
  Label
</span>
```

---

## Empty / Error States

```html
<!-- Empty state card -->
<div class="flex flex-col items-center justify-center p-20
            bg-white border border-slate-100 rounded-xl animate-enter">
  <!-- Icon container -->
  <div class="h-24 w-24 mb-6 flex items-center justify-center rounded-xl bg-slate-50 text-slate-300">
    <!-- icon svg -->
  </div>
  <h3 class="text-lg font-medium text-slate-800">No Items Found</h3>
  <p class="text-sm text-slate-400 mt-2 max-w-sm text-center font-medium leading-relaxed">
    Supporting description text here.
  </p>
</div>

<!-- Access denied state -->
<div class="h-16 w-16 bg-red-50 text-red-500 rounded-xl flex items-center justify-center border border-red-100">
  <!-- warning icon -->
</div>
```

---

## Sync / Toast Notification (dark variant)

```html
<!-- Fixed bottom-right dark notification -->
<div class="fixed bottom-6 right-6 z-1000
            bg-slate-900 border border-slate-800 text-white
            px-5 py-3 rounded-2xl text-xs font-medium
            animate-enter flex items-center gap-3 shadow-2xl">
  <div class="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
  <div class="flex flex-col">
    <span class="text-xs text-slate-400 uppercase tracking-[0.2em] mb-0.5">Label</span>
    <span>Message body</span>
  </div>
</div>
```

---

## Key Design Principles

1. **Soft, airy surfaces** — use very low opacity shadows (`rgba(0,0,0,0.04–0.08)`) and semi-transparent backgrounds with `backdrop-blur` rather than heavy borders or flat fills.
2. **Slate-first neutral palette** — all neutrals use Tailwind `slate-*`, never `gray-*` or `zinc-*`.
3. **Blue as primary action** — `blue-600` for CTAs, active states, focus rings, and progress. Never mix blue with indigo for interactive elements.
4. **Consistent border radius ladder** — cards → `3xl`, modals → `2xl`, inputs/buttons → `xl`, menus → `lg`. Never use `rounded` (4px) on interactive components.
5. **Micro-interactions everywhere** — every clickable element has `transition-all`, a hover state, and an `active:scale-*` press effect.
6. **Uppercase tracking labels** — section labels, role badges, and tooltip text are always `uppercase tracking-widest` or `tracking-wider` at `text-xs`.
7. **`.animate-enter` for all appearing elements** — modals, cards, dialogs, dropdowns, and error states all use the enter animation (blur + slide + fade).
