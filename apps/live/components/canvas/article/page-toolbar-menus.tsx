'use client';

// The page toolbar's menus and popovers (docs/specs/007-editor/article-pages.md "The page
// toolbar"): Style, Align, Insert, the text and highlight colours, and the link field. Each opens
// under its button, keeps the writing's caret (buttons never take focus; the link field does and
// hands it back), and closes on a choice, Escape or an outside press.
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Tooltip, useClickOutside, useEscape } from '@livediagram/ui';
import { Portal } from '@/components/primitives/Portal';
import { ARTICLE_HIGHLIGHT_SWATCHES, ARTICLE_TEXT_SWATCHES } from '@/lib/article/article-swatches';

/** A popover hung under `anchor`, in the page toolbar's keep-active zone. */
export function ToolbarPopover({
  anchor,
  onClose,
  children,
  label,
  width,
}: {
  // The toolbar button (its data-anchor) the popover hangs under.
  anchor: string;
  onClose: () => void;
  children: ReactNode;
  label: string;
  width?: number;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  useLayoutEffect(() => {
    const el = document.querySelector(`[data-page-toolbar] [data-anchor="${anchor}"]`);
    if (!el) return;
    const a = el.getBoundingClientRect();
    const w = box.current?.offsetWidth ?? width ?? 200;
    setPos({
      left: Math.max(8, Math.min(a.left, window.innerWidth - w - 8)),
      top: a.bottom + 6,
    });
  }, [anchor, width]);
  useClickOutside(box, () => onClose(), true, '[data-page-toolbar]');
  useEscape(() => onClose(), { capture: true, stopPropagation: true });
  return (
    <Portal>
      <div
        ref={box}
        role="dialog"
        aria-label={label}
        data-article-keep-active=""
        onMouseDown={(e) => {
          // A press in the popover keeps the writing's caret (the link field excepted).
          if (!(e.target as HTMLElement).closest('input')) e.preventDefault();
        }}
        className="fixed z-[var(--z-overlay)] animate-fade-in rounded-xl border border-slate-200 bg-white p-1.5 text-sm shadow-lg shadow-slate-900/10 dark:border-slate-700 dark:bg-slate-900 dark:shadow-slate-950/40"
        style={{ left: pos?.left ?? -9999, top: pos?.top ?? -9999, width }}
      >
        {children}
      </div>
    </Portal>
  );
}

/** One row of a toolbar menu: an item drawn as what it does. */
export function MenuRow({
  selected,
  onPick,
  children,
  label,
}: {
  selected?: boolean;
  onPick: () => void;
  children: ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      role="menuitemradio"
      aria-checked={selected ?? false}
      aria-label={label}
      onClick={onPick}
      className={`flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-slate-700 transition hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-brand-600 dark:text-slate-200 dark:hover:bg-slate-800 ${
        selected ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300' : ''
      }`}
    >
      {children}
    </button>
  );
}

/** A grid of colour swatches with "Default" first. */
export function SwatchGrid({
  kind,
  current,
  accent,
  onPick,
}: {
  kind: 'text' | 'highlight';
  current: string | null;
  accent: string;
  onPick: (color: string | null) => void;
}) {
  const swatches =
    kind === 'text'
      ? [{ label: 'Accent', value: accent }, ...ARTICLE_TEXT_SWATCHES]
      : ARTICLE_HIGHLIGHT_SWATCHES;
  return (
    <div className="flex w-[196px] flex-col gap-1.5 p-1">
      <button
        type="button"
        onClick={() => onPick(null)}
        aria-pressed={current === null}
        className={`flex items-center gap-2 rounded-md px-2 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 ${
          current === null ? 'bg-slate-100 dark:bg-slate-800' : ''
        }`}
      >
        <span
          aria-hidden
          className="h-4 w-4 rounded-full border border-slate-300 bg-[linear-gradient(135deg,transparent_45%,#ef4444_45%,#ef4444_55%,transparent_55%)] dark:border-slate-600"
        />
        {kind === 'text' ? 'Default colour' : 'No highlight'}
      </button>
      <div
        role="radiogroup"
        aria-label={kind === 'text' ? 'Text colour' : 'Highlight'}
        className="grid grid-cols-5 gap-1.5 px-1 pb-1"
      >
        {swatches.map((s) => (
          <Tooltip key={s.label} label={s.label}>
            <button
              type="button"
              role="radio"
              aria-checked={current?.toLowerCase() === s.value.toLowerCase()}
              aria-label={s.label}
              onClick={() => onPick(s.value)}
              className={`h-7 w-7 rounded-full ring-1 ring-slate-900/10 transition hover:scale-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 motion-reduce:hover:scale-100 dark:ring-white/15 ${
                current?.toLowerCase() === s.value.toLowerCase()
                  ? 'outline-2 outline-offset-2 outline-brand-600'
                  : ''
              }`}
              style={{ background: s.value }}
            >
              {kind === 'text' ? (
                <span aria-hidden className="text-xs font-bold text-white">
                  A
                </span>
              ) : null}
            </button>
          </Tooltip>
        ))}
      </div>
    </div>
  );
}

/** The link field: an address, Enter to set it, Remove to take it off. */
export function LinkField({
  initial,
  onApply,
  onRemove,
  onCancel,
}: {
  initial: string;
  onApply: (href: string) => void;
  onRemove: (() => void) | null;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(initial);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    input.current?.focus();
    input.current?.select();
  }, []);
  // A bare domain is an https address; mailto and http(s) are kept as typed.
  const normalised = (raw: string) => {
    const t = raw.trim();
    if (!t) return '';
    if (/^(https?:\/\/|mailto:)/i.test(t)) return t;
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t)) return `mailto:${t}`;
    return `https://${t}`;
  };
  return (
    <form
      className="flex items-center gap-1.5 p-1"
      onSubmit={(e) => {
        e.preventDefault();
        const href = normalised(value);
        if (href) onApply(href);
        else onCancel();
      }}
    >
      <input
        ref={input}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            onCancel();
          }
        }}
        placeholder="Paste or type a link"
        aria-label="Link address"
        className="h-8 w-64 rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/25 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
      />
      <button
        type="submit"
        className="h-8 rounded-md bg-brand-600 px-3 text-xs font-semibold text-white transition hover:bg-brand-700 dark:bg-brand-600"
      >
        Apply
      </button>
      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          className="h-8 rounded-md px-2 text-xs font-medium text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          Remove
        </button>
      ) : null}
    </form>
  );
}
