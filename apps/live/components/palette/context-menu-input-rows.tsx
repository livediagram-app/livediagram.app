import { useEyeDropper } from '@/hooks/ui/useEyeDropper';
import { hexish, ToggleSwitch } from '@/components/palette/palette-controls';
import { DirArrow } from '@/components/palette/context-menu-icons';
import { type IconPosition } from '@livediagram/diagram';
import { onMouseHover, useRevertOnUnmount } from '@/components/primitives/hover-preview';

const NOOP = () => {};

// A small preset palette for the inline colour picker. The "+" custom chip
// still opens the OS picker for anything off-palette.
// One labelled colour row inside the Colours section: the label + current
// swatch toggle an inline preset palette (clicking the row again closes it,
// so the picker never gets stuck open). A "+" chip opens the OS picker for a
// custom colour.
export function ColourRow({
  label,
  value,
  open,
  onToggle,
  onChange,
  presets,
  onPreview,
  onCommit,
  onPreviewEnd,
}: {
  label: string;
  value: string;
  open: boolean;
  onToggle: () => void;
  onChange: (color: string) => void;
  // Preset swatches to offer — derived from the active theme so they match it.
  presets: string[];
  // Hover-to-preview for the discrete swatches (desktop pointer), mirroring the
  // style-preset tiles: onPreview shows the colour live, onPreviewEnd reverts,
  // and onCommit is the click-commit that snapshots the true pre-hover value for
  // undo. The custom "+" <input> keeps onChange (debounced drag). All optional,
  // so a caller without the preview wiring still works on plain onChange.
  onPreview?: (color: string) => void;
  onCommit?: (color: string) => void;
  onPreviewEnd?: () => void;
}) {
  // Revert an in-flight swatch preview if the menu/section unmounts mid-hover
  // (pointerleave doesn't fire on unmount).
  useRevertOnUnmount(onPreviewEnd ?? NOOP);
  const eyeDropper = useEyeDropper();
  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full cursor-pointer items-center justify-between px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
      >
        <span>{label}</span>
        <span
          className="h-4 w-4 rounded border border-slate-300 dark:border-slate-600"
          style={{ backgroundColor: hexish(value) }}
          aria-hidden
        />
      </button>
      {open ? (
        // Swatches are sized for a comfortable touch target on mobile.
        <div className="flex flex-wrap items-center gap-1.5 px-3 pb-2.5 pt-1">
          {presets.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={c}
              onClick={() => (onCommit ?? onChange)(c)}
              onPointerEnter={onPreview ? onMouseHover(() => onPreview(c)) : undefined}
              onPointerLeave={onPreview ? onMouseHover(() => onPreviewEnd?.()) : undefined}
              className={`h-7 w-7 cursor-pointer rounded-md border transition ${
                value.toLowerCase() === c.toLowerCase()
                  ? 'border-brand-500 ring-1 ring-brand-400'
                  : 'border-slate-300 hover:scale-110 dark:border-slate-600'
              }`}
              style={{ backgroundColor: c }}
            />
          ))}
          {/* Pick a colour off the screen (spec/09 Colours): a pipette
              before the "+", offered only where the browser has an
              EyeDropper. Click it, then click anything on screen — an image,
              a logo in another window, an element already on the board — and
              that colour is applied the way a swatch click is. */}
          {eyeDropper.supported ? (
            <button
              type="button"
              aria-label={`Pick ${label} colour from the screen`}
              title="Pick a colour from anywhere on the screen"
              onClick={() => {
                void eyeDropper.pick().then((hex) => {
                  if (hex) (onCommit ?? onChange)(hex);
                });
              }}
              className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md border border-dashed border-slate-300 text-slate-500 transition hover:border-brand-400 hover:text-brand-600 dark:border-slate-600 dark:hover:border-brand-500 dark:hover:text-brand-300"
            >
              <PipetteIcon />
            </button>
          ) : null}
          <label
            className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md border border-dashed border-slate-300 text-sm leading-none text-slate-500 dark:border-slate-600"
            aria-label={`Custom ${label} colour`}
          >
            +
            <input
              type="color"
              value={hexish(value)}
              onChange={(e) => onChange(e.target.value)}
              className="absolute h-0 w-0 opacity-0"
            />
          </label>
        </div>
      ) : null}
    </div>
  );
}

// The inline-icon placement picker laid out as a cross (Top / Left / Right /
// Bottom around an empty centre), each cell an arrow + label.
export function IconPositionGrid({
  current,
  onPick,
  onPreview,
  onPreviewEnd,
}: {
  current: string;
  onPick: (pos: IconPosition) => void;
  // Optional hover-preview pair (spec/48 flow): hovering a cell shows the
  // icon on that side live, leaving reverts.
  onPreview?: (pos: IconPosition) => void;
  onPreviewEnd?: () => void;
}) {
  const cell = (key: IconPosition, label: string, dir: 'up' | 'down' | 'left' | 'right') => (
    <button
      type="button"
      aria-pressed={current === key}
      onClick={() => onPick(key)}
      onPointerEnter={onPreview ? onMouseHover(() => onPreview(key)) : undefined}
      onPointerLeave={onPreviewEnd ? onMouseHover(onPreviewEnd) : undefined}
      className={`flex items-center justify-center gap-1 rounded px-1.5 py-1 text-[11px] font-medium transition ${
        current === key
          ? 'bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-100'
          : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700'
      }`}
    >
      <DirArrow dir={dir} />
      {label}
    </button>
  );
  return (
    <div className="grid grid-cols-3 gap-1 px-2 pb-1.5">
      <span />
      {cell('above', 'Top', 'up')}
      <span />
      {cell('left', 'Left', 'left')}
      <span />
      {cell('right', 'Right', 'right')}
      <span />
      {cell('below', 'Bottom', 'down')}
      <span />
    </div>
  );
}

// One labelled button grid in the Border section. Literal column classes so
// Tailwind keeps them.

// A full-width row whose whole surface toggles an iOS-style switch (the
// switch is presentational so we don't nest a button in a button). Shared by
// the Layer aspect-lock row + the Table header/zebra toggles.
export function MenuToggleRow({
  label,
  description,
  checked,
  onToggle,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={checked}
      className="flex w-full cursor-pointer items-center justify-between gap-3 px-3 py-1.5 text-left transition hover:bg-slate-100 dark:hover:bg-slate-800"
    >
      <span className="flex flex-col">
        <span className="text-xs font-medium text-slate-700 dark:text-slate-200">{label}</span>
        {description ? (
          <span className="text-[10px] text-slate-500 dark:text-slate-400">{description}</span>
        ) : null}
      </span>
      <ToggleSwitch presentational checked={checked} label={label} />
    </button>
  );
}

// A pipette: the tool that lifts a colour off something already there.
function PipetteIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="m2 22 1-1h3l9-9" />
      <path d="M3 21v-3l9-9" />
      <path d="m15 6 3.4-3.4a2.1 2.1 0 1 1 3 3L18 9l.9.9a1 1 0 0 1 0 1.4l-1.4 1.4a1 1 0 0 1-1.4 0L11.3 8.1a1 1 0 0 1 0-1.4l1.4-1.4a1 1 0 0 1 1.4 0L15 6z" />
    </svg>
  );
}
