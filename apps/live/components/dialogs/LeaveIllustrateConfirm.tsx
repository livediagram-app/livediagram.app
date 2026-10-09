'use client';

// Leaving Illustrate on a tab with content but no articles (docs/specs/007-editor/editor-modes.md
// "Leaving Illustrate"): a small card hanging from the mode switch that asked, since Diagram and
// Draw show no pages and what is changed there may not fit back onto them. A warning glyph, a
// question for a title, one plain sentence, and the two ways out: Cancel, or Switch (the target
// mode's glyph on it). Escape or an outside press stays. With no switch on screen (zen, a
// Shift+D press), the same card sits centred near the top of the screen.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { editorModeLabel, type EditorMode } from '@livediagram/document';
import { lucideTriangleAlert } from '@livediagram/icons/lucide';
import {
  Button,
  lucideGlyph,
  useClickOutside,
  useEscape,
  EDITOR_MODE_ICONS,
  Portal,
} from '@livediagram/ui';
import { VIEWPORT_EDGE_MARGIN as EDGE } from '@/lib/clamp-to-viewport';
import type { LeaveIllustrate } from '@/hooks/editor/useLeaveIllustrate';

const WarningIcon = lucideGlyph(lucideTriangleAlert, 18);
// The card's width and its gap from the switch, in px.
const WIDTH = 320;
const GAP = 10;
// Where the card sits with no switch to hang from: this far down the screen.
const FALLBACK_TOP = 72;

// The mode switch on screen, beside the menu button.
function visibleModeSwitch(): HTMLElement | null {
  for (const el of Array.from(
    document.querySelectorAll<HTMLElement>('[data-tour-id="editor-mode"]'),
  ))
    if (el.getClientRects().length > 0) return el;
  return null;
}

export function LeaveIllustrateConfirm({ leave }: { leave: LeaveIllustrate }) {
  if (!leave.confirming) return null;
  return (
    <SwitchCard
      mode={leave.confirming}
      onConfirm={leave.confirmSwitch}
      onCancel={leave.cancelSwitch}
    />
  );
}

function SwitchCard({
  mode,
  onConfirm,
  onCancel,
}: {
  mode: EditorMode;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const [place, setPlace] = useState<{
    left: number;
    top: number;
    // Where the pointer sits along the card's edge, and which edge (null: no switch, no pointer).
    arrow: { left: number; side: 'top' | 'bottom' } | null;
  } | null>(null);
  useLayoutEffect(() => {
    // Placed now and again on a resize, below the switch (above when there is no room below).
    const place = () => {
      const anchor = visibleModeSwitch();
      const h = ref.current?.offsetHeight ?? 160;
      if (!anchor) {
        setPlace({ left: (window.innerWidth - WIDTH) / 2, top: FALLBACK_TOP, arrow: null });
        return;
      }
      const a = anchor.getBoundingClientRect();
      const below = a.bottom + GAP + h <= window.innerHeight - EDGE;
      const left = Math.max(
        EDGE,
        Math.min(a.left + a.width / 2 - 28, window.innerWidth - WIDTH - EDGE),
      );
      setPlace({
        left,
        top: below ? a.bottom + GAP : a.top - GAP - h,
        arrow: { left: a.left + a.width / 2 - left, side: below ? 'top' : 'bottom' },
      });
    };
    place();
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, []);
  useEffect(() => {
    confirmRef.current?.focus();
  }, []);
  useEscape(onCancel);
  // A press on the switch itself is the switch's (it reopens its menu), not a cancel.
  useClickOutside(ref, onCancel, true, '[data-tour-id="editor-mode"]');
  const label = editorModeLabel(mode);
  const ModeIcon = EDITOR_MODE_ICONS[mode];
  return (
    <Portal>
      <div
        ref={ref}
        role="alertdialog"
        aria-labelledby="leave-illustrate-title"
        aria-describedby="leave-illustrate-body"
        data-leave-illustrate-confirm=""
        onKeyDown={(e) => {
          if (e.key === 'Enter' && e.target === e.currentTarget) onConfirm();
        }}
        className="fixed z-(--z-modal) animate-fade-in rounded-xl border border-slate-200 bg-white p-4 shadow-xl shadow-slate-900/15 motion-reduce:animate-none dark:border-slate-700 dark:bg-slate-900 dark:shadow-slate-950/60"
        style={{
          width: WIDTH,
          left: place?.left ?? -9999,
          top: place?.top ?? -9999,
        }}
      >
        {place?.arrow ? (
          <span
            aria-hidden
            className={`absolute h-3 w-3 rotate-45 border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900 ${
              place.arrow.side === 'top'
                ? '-top-1.5 border-l border-t'
                : '-bottom-1.5 border-b border-r'
            }`}
            style={{ left: place.arrow.left - 6 }}
          />
        ) : null}
        <div className="flex gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
            <WarningIcon aria-hidden />
          </span>
          <div className="min-w-0">
            <h2
              id="leave-illustrate-title"
              className="text-sm font-semibold text-slate-900 dark:text-slate-50"
            >
              Switch to {label}?
            </h2>
            <p
              id="leave-illustrate-body"
              className="mt-1 text-xs leading-5 text-slate-600 dark:text-slate-300"
            >
              {label} mode doesn&apos;t show pages. Changes you make there may not fit back onto
              your pages when you return to Illustrate.
            </p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Button size="sm" variant="secondary" className="whitespace-nowrap" onClick={onCancel}>
            Cancel
          </Button>
          <Button ref={confirmRef} size="sm" className="whitespace-nowrap" onClick={onConfirm}>
            <span className="inline-flex shrink-0">
              <ModeIcon size={14} aria-hidden />
            </span>
            <span>Switch</span>
          </Button>
        </div>
      </div>
    </Portal>
  );
}
