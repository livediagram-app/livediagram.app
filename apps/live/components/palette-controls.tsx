import { type BackgroundPattern, type TextAlignX, type TextAlignY } from '@livediagram/diagram';
import {
  BackgroundBlankIcon,
  BackgroundBricksIcon,
  BackgroundConfettiIcon,
  BackgroundCheckerboardIcon,
  BackgroundCrosshatchIcon,
  BackgroundDiagonalIcon,
  BackgroundEngineeringIcon,
  BackgroundGraphIcon,
  BackgroundGridIcon,
  BackgroundHexagonalIcon,
  BackgroundIsometricIcon,
  BackgroundLinesIcon,
  BackgroundStripesIcon,
  BackgroundWavesIcon,
} from './background-pattern-icons';
import { AlignIcon } from './palette-icons';
import { Tooltip } from './Tooltip';
import { useModKeyHeld } from '@/hooks/useModKeyHeld';

export function Accordion({
  title,
  open,
  onToggle,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="border-t border-slate-100 first:border-t-0 dark:border-slate-800">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800/60"
      >
        <span>{title}</span>
        <svg
          width="10"
          height="10"
          viewBox="0 0 10 10"
          aria-hidden
          className="transition-transform duration-200 ease-out"
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
        >
          <path
            d="M2 4l3 3 3-3"
            stroke="currentColor"
            strokeWidth="1.5"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      <div
        className="grid transition-[grid-template-rows] duration-200 ease-out"
        style={{ gridTemplateRows: open ? '1fr' : '0fr' }}
      >
        <div className="overflow-hidden">
          <div className="px-3 pb-3">{children}</div>
        </div>
      </div>
    </div>
  );
}

export function LabelButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
    >
      <span className="text-slate-500 dark:text-slate-400">{children}</span>
      {label}
    </button>
  );
}

export function ToolButton({
  active,
  label,
  onClick,
  children,
  shortcut,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  // Single-key shortcut letter rendered as a corner badge while
  // Cmd/Ctrl is held. Same visual treatment as IconButton's badge
  // so the cheat sheet reads consistently across tool buttons and
  // shape buttons.
  shortcut?: string;
}) {
  const modHeld = useModKeyHeld();
  const showBadge = !!shortcut && modHeld;
  const base =
    'relative flex flex-1 items-center justify-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition';
  const tone = active
    ? 'bg-brand-500 text-white shadow-sm'
    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white';
  return (
    <button type="button" onClick={onClick} className={`${base} ${tone}`} aria-pressed={active}>
      {children}
      <span>{label}</span>
      {showBadge ? (
        <kbd
          aria-hidden
          className="pointer-events-none absolute right-0.5 top-0.5 flex h-3.5 min-w-[0.875rem] items-center justify-center rounded-[3px] border border-slate-300 bg-white px-0.5 text-[8px] font-semibold uppercase leading-none text-slate-700 shadow-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
        >
          {shortcut}
        </kbd>
      ) : null}
    </button>
  );
}

export function SizeButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  // Stretches to fill its parent grid cell so the row reads as four
  // equal-width controls rather than four shrink-to-fit pills floating
  // at the start of the row.
  const base =
    'flex w-full items-center justify-center rounded-md px-1.5 py-1 text-xs font-medium transition';
  const styled = active
    ? 'bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-200'
    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white';
  return (
    <button type="button" onClick={onClick} className={`${base} ${styled}`}>
      {children}
    </button>
  );
}

export function PatternButton({
  active,
  onClick,
  label,
  children,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  // w-full so every button fills its grid cell — the active/hover box
  // is then a uniform width regardless of how long the label is.
  const base = 'flex w-full flex-col items-center gap-1 rounded-md px-1 py-2 transition';
  const styled = active
    ? 'bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-200'
    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white';
  return (
    <button type="button" onClick={onClick} className={`${base} ${styled}`}>
      {children}
      <span className="w-full truncate text-center text-[10px] font-medium">{label}</span>
    </button>
  );
}

// One entry per pattern, with the `extra` flag driving the Show more
// toggle. New patterns slot in by editing this list — the picker UI
// has no hard-coded ids.
export type PatternEntry = {
  id: BackgroundPattern;
  label: string;
  shortLabel: string;
  description: string;
  icon: () => React.ReactElement;
  extra?: boolean;
};

export const PATTERNS: PatternEntry[] = [
  {
    id: 'grid',
    label: 'Grid',
    shortLabel: 'Grid',
    description: 'Subtle dot grid background.',
    icon: BackgroundGridIcon,
  },
  {
    id: 'blank',
    label: 'Blank',
    shortLabel: 'Blank',
    description: 'No background pattern.',
    icon: BackgroundBlankIcon,
  },
  {
    id: 'lines',
    label: 'Lines',
    shortLabel: 'Lines',
    description: 'Horizontal ruled lines.',
    icon: BackgroundLinesIcon,
  },
  {
    id: 'graph',
    label: 'Graph',
    shortLabel: 'Graph',
    description: 'Square graph paper.',
    icon: BackgroundGraphIcon,
  },
  {
    id: 'crosshatch',
    label: 'Crosshatch',
    shortLabel: 'Cross',
    description: 'Diagonal crosshatch pattern.',
    icon: BackgroundCrosshatchIcon,
  },
  {
    id: 'confetti',
    label: 'Confetti',
    shortLabel: 'Confetti',
    description: 'Multi-colour dots; pattern colour ignored.',
    icon: BackgroundConfettiIcon,
  },
  {
    id: 'stripes',
    label: 'Stripes',
    shortLabel: 'Stripes',
    description: 'Vertical ruled lines.',
    icon: BackgroundStripesIcon,
  },
  {
    id: 'diagonal',
    label: 'Diagonal',
    shortLabel: 'Diagonal',
    description: 'Single-direction 45° lines.',
    icon: BackgroundDiagonalIcon,
  },
  {
    id: 'waves',
    label: 'Waves',
    shortLabel: 'Waves',
    description: 'Gentle sinusoidal lines, softest of the textures.',
    extra: true,
    icon: BackgroundWavesIcon,
  },
  {
    id: 'bricks',
    label: 'Bricks',
    shortLabel: 'Bricks',
    description: 'Offset masonry brickwork.',
    extra: true,
    icon: BackgroundBricksIcon,
  },
  {
    id: 'isometric',
    label: 'Isometric',
    shortLabel: 'Iso',
    description: 'Isometric rhombic grid for 3D / technical diagrams.',
    extra: true,
    icon: BackgroundIsometricIcon,
  },
  {
    id: 'checkerboard',
    label: 'Checkerboard',
    shortLabel: 'Check',
    description: 'Alternating filled squares.',
    extra: true,
    icon: BackgroundCheckerboardIcon,
  },
  {
    id: 'hexagonal',
    label: 'Hexagonal',
    shortLabel: 'Hex',
    description: 'Honeycomb grid for hex maps and cell layouts.',
    extra: true,
    icon: BackgroundHexagonalIcon,
  },
  {
    id: 'engineering',
    label: 'Engineering',
    shortLabel: 'Eng',
    description: 'Graph paper with bold major gridlines every 5 cells.',
    extra: true,
    icon: BackgroundEngineeringIcon,
  },
];

const ALIGN_GRID: { x: TextAlignX; y: TextAlignY }[] = [
  { y: 'top', x: 'left' },
  { y: 'top', x: 'center' },
  { y: 'top', x: 'right' },
  { y: 'middle', x: 'left' },
  { y: 'middle', x: 'center' },
  { y: 'middle', x: 'right' },
  { y: 'bottom', x: 'left' },
  { y: 'bottom', x: 'center' },
  { y: 'bottom', x: 'right' },
];

export function alignLabel(x: TextAlignX, y: TextAlignY): string {
  const yLabel = y === 'top' ? 'Top' : y === 'bottom' ? 'Bottom' : 'Middle';
  const xLabel = x === 'left' ? 'left' : x === 'right' ? 'right' : 'centre';
  return `${yLabel} ${xLabel}`;
}

export function AlignmentGrid({
  alignX,
  alignY,
  onChange,
}: {
  alignX: TextAlignX;
  alignY: TextAlignY;
  onChange: (x: TextAlignX, y: TextAlignY) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-1">
      {ALIGN_GRID.map(({ x, y }) => {
        const active = alignX === x && alignY === y;
        return (
          <Tooltip
            key={`${y}-${x}`}
            title={alignLabel(x, y)}
            description="Align text to this corner of the element."
          >
            <button
              type="button"
              onClick={() => onChange(x, y)}
              aria-label={alignLabel(x, y)}
              aria-pressed={active}
              className={
                active
                  ? 'flex h-7 w-full items-center justify-center rounded-md bg-brand-100 text-brand-700'
                  : 'flex h-7 w-full items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white'
              }
            >
              <AlignIcon x={x} y={y} />
            </button>
          </Tooltip>
        );
      })}
    </div>
  );
}

export function ColorSwatch({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (color: string) => void;
}) {
  return (
    <label className="relative flex flex-1 cursor-pointer items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800">
      <span
        aria-hidden
        className="h-4 w-4 rounded border border-slate-300 dark:border-slate-600 dark:bg-slate-800"
        style={{ backgroundColor: value }}
      />
      <span className="flex-1">{label}</span>
      <input
        type="color"
        value={hexish(value)}
        onChange={(e) => onChange(e.target.value)}
        aria-label={`${label} color`}
        className="absolute h-0 w-0 opacity-0"
      />
    </label>
  );
}

export function hexish(color: string): string {
  if (/^#[0-9a-fA-F]{6}$/.test(color)) return color;
  return '#ffffff';
}

type IconButtonProps = {
  label: string;
  description: string;
  onClick: () => void;
  children: React.ReactNode;
  disabled?: boolean;
  // Pressed-state styling. Used by the shape buttons during draw-to-
  // size mode so the user sees which shape is queued for the next
  // canvas drag (the cursor + the banner already say it, but a
  // highlighted palette button closes the loop for the
  // "where did I click?" question). Same brand-50 fill as the
  // canvas-tool ToolButton's active state for visual consistency.
  active?: boolean;
  // Single-key shortcut letter (e.g. "R"). Renders a corner badge
  // whenever the user is holding Cmd/Ctrl, so the palette becomes a
  // self-documenting cheat sheet without permanent visual clutter.
  // The shortcut itself is bound centrally in useEditorKeyboardShortcuts;
  // this prop is purely the visual reveal.
  shortcut?: string;
  // Optional HTML5 drag source. Used by the icon tiles so an icon can be
  // dragged onto a shape (the drop sets the shape's inline icon). When
  // unset the button isn't draggable.
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
};

export function IconButton({
  label,
  description,
  onClick,
  children,
  disabled,
  active,
  shortcut,
  draggable,
  onDragStart,
}: IconButtonProps) {
  const modHeld = useModKeyHeld();
  const showBadge = !disabled && !!shortcut && modHeld;
  const tone = active
    ? 'bg-brand-100 text-brand-700 ring-1 ring-brand-300 dark:bg-brand-500/20 dark:text-brand-200 dark:ring-brand-500/50'
    : 'text-slate-600 enabled:hover:bg-slate-100 enabled:hover:text-slate-900 dark:text-slate-100 dark:enabled:hover:bg-slate-800 dark:enabled:hover:text-white';
  const button = (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      draggable={draggable}
      onDragStart={onDragStart}
      className={`relative flex h-9 w-9 items-center justify-center rounded-md transition disabled:cursor-not-allowed disabled:opacity-40 ${tone}`}
    >
      {children}
      {showBadge ? (
        <kbd
          aria-hidden
          className="pointer-events-none absolute right-0.5 top-0.5 flex h-3.5 min-w-[0.875rem] items-center justify-center rounded-[3px] border border-slate-300 bg-white px-0.5 text-[8px] font-semibold uppercase leading-none text-slate-700 shadow-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
        >
          {shortcut}
        </kbd>
      ) : null}
    </button>
  );
  if (disabled) return button;
  return (
    <Tooltip title={label} description={description}>
      {button}
    </Tooltip>
  );
}

// iOS-style toggle switch. Used by the Shape accordion's Lock-aspect
// row but generic enough for any future boolean preference that
// belongs alongside its label rather than as an icon button.
export function ToggleSwitch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
      className={
        checked
          ? 'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full bg-brand-500 transition'
          : 'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full bg-slate-300 transition dark:bg-slate-600'
      }
    >
      <span
        aria-hidden
        className={
          checked
            ? 'inline-block h-3.5 w-3.5 translate-x-[18px] rounded-full bg-white shadow-sm transition'
            : 'inline-block h-3.5 w-3.5 translate-x-[3px] rounded-full bg-white shadow-sm transition'
        }
      />
    </button>
  );
}
