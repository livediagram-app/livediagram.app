'use client';

import { useEffect, useRef, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { TourTopics, type TourTopic } from '@liveworkspace/workbench/components/tour/TourTopics';
import { playerPlace, useCanvasBox } from './use-canvas-box';

// Watch It Built's start panel (docs/specs/007-editor/watch-it-built.md "The start panel"): in the player's place and
// look, the mode's topics to pick from, and Not Now. It takes focus as it opens; Escape is Not Now.
export function WatchStartPanel({
  topics,
  canvasRef,
  onPick,
  onClose,
}: {
  topics: readonly TourTopic[];
  canvasRef: RefObject<HTMLElement | null>;
  onPick: (id: string) => void;
  onClose: () => void;
}) {
  const box = useCanvasBox(canvasRef);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.querySelector<HTMLElement>('[data-tour-topic]')?.focus({ preventScroll: true });
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopImmediatePropagation();
      onClose();
    };
    window.addEventListener('keydown', onKey, { capture: true });
    return () => window.removeEventListener('keydown', onKey, { capture: true });
  }, [onClose]);

  if (typeof document === 'undefined') return null;
  return createPortal(
    <div
      ref={ref}
      role="dialog"
      aria-label="Watch It Built"
      data-watch-start=""
      className="fixed z-[var(--z-toast)] flex w-[22rem] max-w-[calc(100vw-32px)] -translate-x-1/2 flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-3.5 pb-2.5 shadow-xl motion-safe:animate-dialog-in dark:border-slate-700 dark:bg-slate-900"
      style={playerPlace(box)}
    >
      <TourTopics
        heading="What would you like to learn?"
        line="Short replays on your own canvas. Nothing is saved."
        topics={topics}
        onPick={onPick}
      />
      <div className="flex justify-end border-t border-slate-100 pt-2 dark:border-slate-800">
        <button
          type="button"
          onClick={onClose}
          className="cursor-pointer rounded-lg px-2.5 py-1.5 text-sm font-semibold text-slate-700 transition-colors duration-micro hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          Not Now
        </button>
      </div>
    </div>,
    document.body,
  );
}
