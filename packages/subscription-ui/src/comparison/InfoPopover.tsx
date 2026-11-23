'use client';

import { useId, useLayoutEffect, useRef, useState } from 'react';
import {
  Glyph,
  HINT_CARD_SURFACE,
  placeHint,
  Portal,
  POPOVER_VIEWPORT_MARGIN,
  useClickOutside,
  useEscape,
  type HintLayout,
} from '@liveworkspace/ui';

const GAP = 8;

/**
 * A row's "what does this mean" button and the sentence it shows (subscription.md "What people see": each row has an
 * explanation). A tap or a click pins the note open, so it works on a touch screen; a mouse resting on the button
 * shows it too. Escape, a press outside, or the button again closes it. The note is the hover card's surface,
 * portalled and placed against the button, so the comparison's scrolling never clips it.
 */
export function InfoPopover({ label, children }: { label: string; children: string }) {
  const id = useId();
  const button = useRef<HTMLButtonElement>(null);
  const note = useRef<HTMLDivElement>(null);
  const [pinned, setPinned] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [layout, setLayout] = useState<HintLayout | null>(null);
  const open = pinned || hovered;
  const close = () => {
    setPinned(false);
    setHovered(false);
  };

  useEscape(close, { enabled: open, capture: true, stopPropagation: true });
  useClickOutside(button, close, pinned, `[data-info-note="${id}"]`);

  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const trigger = button.current;
      const surface = note.current;
      if (!trigger || !surface) return;
      const box = surface.getBoundingClientRect();
      setLayout(
        placeHint({
          trigger: trigger.getBoundingClientRect(),
          surface: { width: box.width, height: box.height },
          viewport: { width: window.innerWidth, height: window.innerHeight },
          gap: GAP,
          margin: POPOVER_VIEWPORT_MARGIN,
          order: ['bottom', 'top', 'right', 'left'],
        }),
      );
    };
    place();
    // The comparison scrolls inside its dialog: the note follows its button, and a resize re-places it.
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => {
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
      setLayout(null);
    };
  }, [open]);

  return (
    <>
      <button
        ref={button}
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-describedby={open ? id : undefined}
        onClick={() => setPinned((was) => !was)}
        // A mouse only: a touch's own pointerenter would open it under the finger and the click then close it.
        onPointerEnter={(event) => event.pointerType === 'mouse' && setHovered(true)}
        onPointerLeave={() => setHovered(false)}
        className={`touch-target relative flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400 ${
          open
            ? 'bg-slate-200 text-slate-900 dark:bg-slate-700 dark:text-white'
            : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100'
        }`}
      >
        <Glyph size={14} units={14} weight={1.4}>
          <circle cx="7" cy="7" r="5.6" />
          <path d="M7 6.4v3.4" />
          <circle cx="7" cy="4.3" r="0.4" fill="currentColor" />
        </Glyph>
      </button>
      {open ? (
        <Portal>
          <div
            ref={note}
            id={id}
            role="tooltip"
            data-info-note={id}
            className={`fixed z-[var(--z-toast)] w-72 max-w-[calc(100vw-1rem)] px-3 py-2.5 text-xs leading-relaxed text-slate-700 dark:text-slate-200 ${HINT_CARD_SURFACE}`}
            style={
              layout
                ? { left: layout.left, top: layout.top }
                : { left: -9999, top: -9999, visibility: 'hidden' }
            }
          >
            {children}
          </div>
        </Portal>
      ) : null}
    </>
  );
}
