'use client';

import { useEffect, useState, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import {
  GetStartedBody,
  GetStartedPopover,
  getStartedAnchor,
} from '@liveworkspace/workbench/components/tour/GetStartedPopover';
import type { TourTopic } from '@liveworkspace/workbench/components/tour/TourTopics';
import { playerPlace, useCanvasBox } from './use-canvas-box';

// Get Started (docs/specs/007-editor/watch-it-built.md "The start panel"): the workbench's Get Started popover from the
// footer's Get Started button, every app's alike, holding the mode's lessons. Opened with no Get Started button on show
// (from Settings), it stands in the player's place instead.
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
  // The footer button it hangs from, found once as it opens.
  const [anchor] = useState(getStartedAnchor);
  if (anchor) {
    return <GetStartedPopover anchor={anchor} topics={topics} onPick={onPick} onClose={onClose} />;
  }
  return (
    <StandingPanel canvasRef={canvasRef} onClose={onClose}>
      <GetStartedBody topics={topics} onPick={onPick} onClose={onClose} />
    </StandingPanel>
  );
}

// With no footer button to hang from: in the player's place, focused as it opens, Escape closing it.
function StandingPanel({
  canvasRef,
  onClose,
  children,
}: {
  canvasRef: RefObject<HTMLElement | null>;
  onClose: () => void;
  children: ReactNode;
}) {
  const box = useCanvasBox(canvasRef);
  useEffect(() => {
    document
      .querySelector<HTMLElement>('[data-watch-start] [data-tour-topic]')
      ?.focus({ preventScroll: true });
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
      role="dialog"
      aria-label="Get Started"
      className="fixed z-[var(--z-toast)] w-[26.25rem] max-w-[calc(100vw-32px)] -translate-x-1/2 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl motion-safe:animate-dialog-in dark:border-slate-700 dark:bg-slate-900"
      style={playerPlace(box)}
    >
      {children}
    </div>,
    document.body,
  );
}
