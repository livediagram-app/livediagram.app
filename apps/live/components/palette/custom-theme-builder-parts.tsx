import { hexish } from '@/components/palette/palette-controls';

export type Painter = {
  copied: string | null;
  copy: (value: string) => void;
  clear: () => void;
};

// Presentational leaf components for the custom theme builder: the field
// label, the colour tile + its swatch dot, the reset / copy / paste glyphs,
// and the collapsible row. Split out of CustomThemeBuilder (all props-only,
// no builder state).
export function FieldLabel({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 ${className}`}
    >
      {children}
    </span>
  );
}

// A base-colour tile: a large colour block (the whole point) with a
// label beneath, the native colour input layered invisibly on top, plus
// the format-painter copy button / paste overlay.
export function ColorTile({
  label,
  value,
  onChange,
  painter,
}: {
  label: string;
  value: string;
  onChange: (color: string) => void;
  painter: Painter;
}) {
  const pasting = painter.copied !== null;
  return (
    <label className="flex cursor-pointer flex-col gap-1 rounded-lg border border-slate-200 bg-white p-1 transition hover:border-brand-300 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-brand-500/60">
      <span
        className="relative block h-7 w-full overflow-hidden rounded border border-black/5 dark:border-white/10"
        style={{ backgroundColor: value }}
      >
        <input
          type="color"
          value={hexish(value)}
          onChange={(e) => onChange(e.target.value)}
          aria-label={label}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        />
        {/* Copy this colour (format painter). Sits above the input. */}
        {!pasting ? (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              painter.copy(value);
            }}
            aria-label={`Copy ${label} colour`}
            className="absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded bg-white/85 text-slate-600 shadow-sm transition hover:text-brand-600 dark:bg-slate-900/80 dark:text-slate-200"
          >
            <CopyIcon />
          </button>
        ) : (
          // Paste overlay: covers the input so a click applies the copied
          // colour instead of opening the native picker.
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              onChange(painter.copied!);
              painter.clear();
            }}
            aria-label={`Paste colour into ${label}`}
            className="absolute inset-0 flex items-center justify-center bg-brand-500/10 ring-1 ring-inset ring-brand-400/60 transition hover:bg-brand-500/20"
          >
            <PasteGlyph />
          </button>
        )}
      </span>
      <span className="w-full truncate text-center text-[10px] font-medium text-slate-600 dark:text-slate-300">
        {label}
      </span>
    </label>
  );
}

// A compact per-shape colour input: a small colour square with the
// native picker layered on top, and the same paste-target behaviour as
// the tiles when a colour is on the painter clipboard.
export function ColorDot({
  label,
  value,
  onChange,
  painter,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  painter: Painter;
}) {
  const pasting = painter.copied !== null;
  return (
    <span
      className="relative h-6 w-6 shrink-0 overflow-hidden rounded border border-slate-300 dark:border-slate-600"
      style={{ backgroundColor: value }}
    >
      <input
        type="color"
        aria-label={label}
        value={hexish(value)}
        onChange={(e) => onChange(e.target.value)}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
      />
      {pasting ? (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            onChange(painter.copied!);
            painter.clear();
          }}
          aria-label={`Paste colour into ${label}`}
          className="absolute inset-0 bg-brand-500/15 ring-1 ring-inset ring-brand-400/70"
        />
      ) : null}
    </span>
  );
}

export function ResetGlyph() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 8a5 5 0 1 1 1.5 3.5" />
      <path d="M3 5.5V8h2.5" />
    </svg>
  );
}

export function CopyIcon() {
  return (
    <svg
      width="9"
      height="9"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      aria-hidden
    >
      <rect x="5.5" y="5.5" width="8" height="8" rx="1.5" />
      <path d="M10.5 5.5V4A1.5 1.5 0 0 0 9 2.5H4A1.5 1.5 0 0 0 2.5 4v5A1.5 1.5 0 0 0 4 10.5h1.5" />
    </svg>
  );
}

export function PasteGlyph() {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      className="text-brand-700 dark:text-brand-200"
      aria-hidden
    >
      <path d="M3 3l4 4M3 7V3h4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7 13h6M10 10v6" strokeLinecap="round" />
    </svg>
  );
}

export function ExpandRow({
  label,
  badge,
  open,
  onToggle,
  children,
}: {
  label: string;
  badge?: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-slate-100 dark:border-slate-800">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center justify-between px-2.5 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800/60"
      >
        <span className="flex items-center gap-2">
          {label}
          {badge ? (
            <span className="rounded-full bg-brand-100 px-1.5 py-0.5 text-[10px] font-semibold text-brand-700 dark:bg-brand-500/20 dark:text-brand-200">
              {badge}
            </span>
          ) : null}
        </span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          aria-hidden
          className={open ? 'rotate-180 transition' : 'transition'}
        >
          <path
            d="M3 4.5 6 7.5 9 4.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      {open ? <div className="px-2.5 pb-2.5 pt-1">{children}</div> : null}
    </div>
  );
}
