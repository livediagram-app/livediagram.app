'use client';

// The custom-swatch popover (docs/specs/008-canvas/quick-style-panel.md "Custom swatches"): opened by
// right-click, Shift+F10 or the context-menu key on one of a row's six theme
// swatches. It edits the palette and styles nothing: a picked colour is saved
// INTO the swatch, and Clear override puts the theme's colour back.

import { useEffect, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { CustomColourEditor } from '@/components/colour/CustomColourEditor';

const GAP = 8;
const MARGIN = 8;

export function SwatchOverridePopover({
  anchor,
  label,
  colour,
  overridden,
  themeNote,
  onSave,
  onClear,
  onClose,
}: {
  // The swatch it belongs to: focus returns here, and it sits beside the
  // swatch's panel.
  anchor: HTMLElement;
  // "Custom colour for Green, Stroke".
  label: string;
  // What the swatch shows now: its custom colour, else the theme's.
  colour: string;
  overridden: boolean;
  // "Theme colour: Green", shown in Clear override's place when there is none.
  themeNote: string;
  onSave: (hex: string) => void;
  onClear: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  // Beside the panel, level with the swatch, kept inside the viewport: to its
  // right (the panel lives on the left), else to its left. Written straight to
  // the node before paint: it is placement, not state.
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    const box = node.getBoundingClientRect();
    const a = anchor.getBoundingClientRect();
    const panel = anchor.closest('[data-quick-style-panel]');
    const side = panel?.getBoundingClientRect() ?? a;
    const right = side.right + GAP;
    node.style.left = `${
      right + box.width <= window.innerWidth - MARGIN
        ? right
        : Math.max(MARGIN, side.left - GAP - box.width)
    }px`;
    node.style.top = `${Math.min(Math.max(MARGIN, a.top), window.innerHeight - MARGIN - box.height)}px`;
    node.style.visibility = 'visible';
  }, [anchor]);

  const close = () => {
    onClose();
    anchor.focus();
  };

  // Focus moves in once, on open: the editor's colour square.
  useEffect(() => {
    ref.current?.querySelector<HTMLElement>('[role="slider"]')?.focus();
  }, []);

  // A press anywhere else closes it.
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node | null;
      if (t && !ref.current?.contains(t) && !anchor.contains(t)) onCloseRef.current();
    };
    window.addEventListener('pointerdown', onDown, true);
    return () => window.removeEventListener('pointerdown', onDown, true);
  }, [anchor]);

  return createPortal(
    <div
      ref={ref}
      role="dialog"
      aria-label={label}
      data-testid="swatch-override-popover"
      onPointerDown={(e) => e.stopPropagation()}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          close();
        }
      }}
      style={{ left: 0, top: 0, visibility: 'hidden' }}
      className="pointer-events-auto fixed z-[var(--z-toolbar)] flex w-64 flex-col gap-2 rounded-lg border border-slate-200 bg-white p-2.5 text-slate-700 shadow-lg shadow-slate-900/5 motion-safe:animate-fade-in dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:shadow-slate-950/40"
    >
      <span className="select-none text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
        Custom colour
      </span>
      {/* The one custom colour editor (docs/specs/004-interface-design/colour-picker.md "Picking a
          colour of your own"): Use saves the colour into the swatch and closes. */}
      <CustomColourEditor
        start={colour}
        boardWarning={false}
        onUse={(hex) => {
          onSave(hex.toLowerCase());
          close();
        }}
      />
      <div className="flex items-center gap-2">
        {overridden ? (
          <button
            type="button"
            onClick={() => {
              onClear();
              close();
            }}
            className="h-7 rounded-md px-2 text-xs font-medium text-slate-700 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Clear override
          </button>
        ) : (
          // Nothing to clear yet: say what the swatch is instead of a dead button.
          <span className="px-1 text-[11px] text-slate-500 dark:text-slate-400">{themeNote}</span>
        )}
      </div>
    </div>,
    document.body,
  );
}
