'use client';

// Mounts the presentation (spec/31) over the editor, and owns the two pieces
// of state that belong to a RUNNING deck rather than to the deck itself: which
// way the last move travelled (so the slide transition knows which way to
// slide) and the transition's own tick.
//
// Split out of EditorView so the view stays a layout: this is the whole of
// "there is a presentation happening" in one place, and it renders nothing at
// all when there is not.

import { useEffect, useRef, useState } from 'react';

import { PresentationOverlay } from '@/components/canvas/PresentationOverlay';
import { useEditorContext } from '@/app/diagram/[id]/EditorContext';

// Matches the CSS in globals.css (.lvd-slide-*), so the class is removed the
// moment the animation ends rather than being left on the node.
const SLIDE_MS = 380;

export function PresentationHost() {
  const { slideDeck } = useEditorContext();
  const at = slideDeck?.presentingAt ?? null;
  const [direction, setDirection] = useState<'forward' | 'back'>('forward');
  const prevAt = useRef<number | null>(null);

  // Drive the canvas's transition class. The canvas underneath is the thing
  // that actually moves — one transform on one layer, so a hundred-element
  // slide costs exactly what a one-element slide does.
  useEffect(() => {
    const root = document.documentElement;
    if (at === null) {
      root.removeAttribute('data-presenting');
      root.removeAttribute('data-slide-move');
      prevAt.current = null;
      return;
    }
    const before = prevAt.current;
    prevAt.current = at;
    root.setAttribute('data-presenting', '');
    if (before === null) {
      // Entering: the first slide arrives as a card rather than a page swap.
      root.setAttribute('data-slide-move', 'in');
    } else if (at === before) {
      return;
    } else {
      const dir = at > before ? 'forward' : 'back';
      setDirection(dir);
      root.setAttribute('data-slide-move', dir);
    }
    const timer = window.setTimeout(() => root.removeAttribute('data-slide-move'), SLIDE_MS);
    return () => window.clearTimeout(timer);
  }, [at]);

  // Leaving the mode must always clean up, including on unmount (a navigation
  // away mid-presentation would otherwise leave the attribute on <html>).
  useEffect(
    () => () => {
      document.documentElement.removeAttribute('data-presenting');
      document.documentElement.removeAttribute('data-slide-move');
    },
    [],
  );

  if (!slideDeck || at === null) return null;
  return (
    <PresentationOverlay
      steps={slideDeck.runnable}
      at={at}
      onGo={(next) => slideDeck.setPresentingAt(next)}
      onExit={slideDeck.exitPresentation}
      direction={direction}
    />
  );
}
