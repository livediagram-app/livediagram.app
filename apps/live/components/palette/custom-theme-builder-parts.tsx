import { lucideClipboardPaste } from '@livediagram/icons/lucide';
import { useColourWell } from '@/components/palette/palette-controls';
import { ChevronDownIcon, CopyIcon, Glyph, Prims } from '@livediagram/ui';

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
// label beneath. Pressing the block opens the one colour picker
// (useColourWell); the format-painter copy button sits on it, and while a
// colour is copied a paste overlay covers it instead.
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
  const { open, toggle, setTrigger, popover } = useColourWell({ label, value, onChange });
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-slate-200 bg-white p-1 transition hover:border-brand-300 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-brand-500/60">
      <span
        className="relative block h-7 w-full overflow-hidden rounded border border-black/5 dark:border-white/10"
        style={{ backgroundColor: value }}
      >
        <button
          ref={setTrigger}
          type="button"
          aria-label={label}
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={toggle}
          className="absolute inset-0 h-full w-full cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500"
        />
        {/* Copy this colour (format painter). Sits above the well. */}
        {!pasting ? (
          <button
            type="button"
            onClick={() => painter.copy(value)}
            aria-label={`Copy ${label} colour`}
            className="absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded bg-white/85 text-slate-600 shadow-sm transition hover:text-brand-600 dark:bg-slate-900/80 dark:text-slate-200"
          >
            <CopyIcon size={9} />
          </button>
        ) : (
          // Paste overlay: covers the well so a click applies the copied
          // colour instead of opening the picker.
          <button
            type="button"
            onClick={() => {
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
      {popover}
    </div>
  );
}

// A compact per-shape colour: a small colour square that opens the one
// colour picker, and the same paste-target behaviour as the tiles when a
// colour is on the painter clipboard.
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
  const { open, toggle, setTrigger, popover } = useColourWell({ label, value, onChange });
  return (
    <span
      className="relative h-6 w-6 shrink-0 overflow-hidden rounded border border-slate-300 dark:border-slate-600"
      style={{ backgroundColor: value }}
    >
      <button
        ref={setTrigger}
        type="button"
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={toggle}
        className="absolute inset-0 h-full w-full cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500"
      />
      {pasting ? (
        <button
          type="button"
          onClick={() => {
            onChange(painter.copied!);
            painter.clear();
          }}
          aria-label={`Paste colour into ${label}`}
          className="absolute inset-0 bg-brand-500/15 ring-1 ring-inset ring-brand-400/70"
        />
      ) : null}
      {popover}
    </span>
  );
}

export function ResetGlyph() {
  return (
    <Glyph size={13} units={16}>
      <path d="M3 8a5 5 0 1 1 1.5 3.5" />
      <path d="M3 5.5V8h2.5" />
    </Glyph>
  );
}

function PasteGlyph() {
  return (
    <Glyph size={11} units={24} className="text-brand-700 dark:text-brand-200">
      <Prims prims={lucideClipboardPaste} />
    </Glyph>
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
        <ChevronDownIcon size={12} className={open ? 'rotate-180 transition' : 'transition'} />
      </button>
      {open ? <div className="px-2.5 pb-2.5 pt-1">{children}</div> : null}
    </div>
  );
}
