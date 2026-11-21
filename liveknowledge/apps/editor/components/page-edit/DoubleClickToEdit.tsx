'use client';

// Double-click to edit (docs/specs/030-knowledgebase/editing.md "Read mode"): while an Editor reads a page, a small
// quiet label rides just under the pointer over the writing, "Double-click to Edit", and a double-click on the
// writing opens edit mode. It follows the pointer by transform only (no render per move), waits a moment before it
// shows so a passing pointer never flashes it, and hides over links and controls, while a mouse button is down, on
// scroll, and for touch. With reduced motion it appears without its fade.
import { useEffect, useRef } from 'react';
import { Portal } from '@liveknowledge/ui';
import { PencilIcon } from '@/components/primitives/explorer-icons';

/** How long the pointer rests on the writing before the label shows (ms). */
export const HINT_DELAY_MS = 450;
/** Where the label sits from the pointer's tip (px): just under and right of the arrow. */
const OFFSET_X = 14;
const OFFSET_Y = 20;

const WRITING = '.article-flow[data-readonly]';
// Over these a click does its own thing, so the label stands aside.
const INTERACTIVE =
  'a, button, input, textarea, select, [role="button"], [data-page-link], summary';

/** Whether a pointer over `target` is over the page's writing, away from anything clickable. */
export function overWriting(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return target.closest(WRITING) !== null && target.closest(INTERACTIVE) === null;
}

export function DoubleClickToEdit({ active, onEdit }: { active: boolean; onEdit: () => void }) {
  const label = useRef<HTMLDivElement>(null);
  const edit = useRef(onEdit);
  useEffect(() => {
    edit.current = onEdit;
  });

  useEffect(() => {
    if (!active) return;
    let timer: number | undefined;
    let shown = false;
    let frame = 0;
    let x = 0;
    let y = 0;
    const place = () => {
      frame = 0;
      const el = label.current;
      if (el) el.style.transform = `translate3d(${x + OFFSET_X}px, ${y + OFFSET_Y}px, 0)`;
    };
    const hide = () => {
      window.clearTimeout(timer);
      timer = undefined;
      shown = false;
      label.current?.removeAttribute('data-shown');
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse' || e.buttons !== 0 || !overWriting(e.target)) {
        hide();
        return;
      }
      x = e.clientX;
      y = e.clientY;
      if (!frame) frame = requestAnimationFrame(place);
      if (!shown && timer === undefined)
        timer = window.setTimeout(() => {
          timer = undefined;
          shown = true;
          place();
          label.current?.setAttribute('data-shown', '');
        }, HINT_DELAY_MS);
    };
    const onDouble = (e: MouseEvent) => {
      if (!overWriting(e.target)) return;
      hide();
      edit.current();
    };
    document.addEventListener('pointermove', onMove, { passive: true });
    document.addEventListener('pointerdown', hide, { passive: true });
    document.addEventListener('dblclick', onDouble);
    window.addEventListener('scroll', hide, { capture: true, passive: true });
    window.addEventListener('blur', hide);
    return () => {
      hide();
      if (frame) cancelAnimationFrame(frame);
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerdown', hide);
      document.removeEventListener('dblclick', onDouble);
      window.removeEventListener('scroll', hide, { capture: true });
      window.removeEventListener('blur', hide);
    };
  }, [active]);

  if (!active) return null;
  return (
    <Portal>
      <div
        ref={label}
        aria-hidden
        data-double-click-hint=""
        className="pointer-events-none fixed left-0 top-0 z-[var(--z-toolbar)] inline-flex items-center gap-1 rounded-full bg-slate-900/80 px-2 py-0.5 text-[11px] font-medium leading-4 text-white opacity-0 shadow-sm backdrop-blur-sm motion-safe:transition-opacity motion-safe:duration-150 data-[shown]:opacity-100 dark:bg-white/85 dark:text-slate-900"
      >
        <PencilIcon size={10} />
        Double-click to Edit
      </div>
    </Portal>
  );
}
