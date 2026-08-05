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
import { slideDurationMs } from '@/lib/presentation-config';

// The node the transition animates: the canvas surface. Kept here so the
// cleanup can listen for ITS animationend rather than guessing a duration.
const SURFACE_SELECTOR = '[data-canvas-a11y-root]';

// Matches the CSS in globals.css (.lvd-slide-*), so the class is removed the
// moment the animation ends rather than being left on the node.
export function PresentationHost() {
  const { slideDeck, canvasTool, setCanvasTool } = useEditorContext();
  const at = slideDeck?.presentingAt ?? null;
  const [direction, setDirection] = useState<'forward' | 'back'>('forward');
  const prevAt = useRef<number | null>(null);
  // Device-local presenter settings (spec/31). Owned by the deck hook, because
  // the camera reads them too.
  const config = slideDeck?.config;
  const configRef = useRef(config);
  configRef.current = config;

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
    const cfg = configRef.current;
    if (cfg) {
      root.setAttribute('data-slide-transition', cfg.transition);
      // The chosen speed drives the animation's duration through a variable,
      // so the keyframes stay one definition rather than three.
      root.style.setProperty('--lvd-slide-ms', `${slideDurationMs(cfg)}ms`);
      root.toggleAttribute('data-hide-pointer', cfg.hidePointer);
    }
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
    // Cleared on the animation's OWN end event, not on a timer. A timer has to
    // guess the duration, and guessing even slightly short yanked the
    // attribute mid-animation — the element snapped from wherever it had got
    // to straight to its resting place, which is the little bounce at the end
    // of a transition that reads as rubber-banding.
    const surface = document.querySelector(SURFACE_SELECTOR);
    const done = () => root.removeAttribute('data-slide-move');
    surface?.addEventListener('animationend', done);
    surface?.addEventListener('animationcancel', done);
    // Belt and braces: if the surface is missing or the animation never runs
    // (reduced motion with animations disabled outright, a hidden tab), the
    // attribute must not stick and block the next transition.
    const failsafe = window.setTimeout(done, 1200);
    return () => {
      surface?.removeEventListener('animationend', done);
      surface?.removeEventListener('animationcancel', done);
      window.clearTimeout(failsafe);
    };
  }, [at]);

  // Leaving the mode must always clean up, including on unmount (a navigation
  // away mid-presentation would otherwise leave the attribute on <html>).
  useEffect(
    () => () => {
      document.documentElement.removeAttribute('data-presenting');
      document.documentElement.removeAttribute('data-slide-move');
      document.documentElement.removeAttribute('data-slide-transition');
      document.documentElement.removeAttribute('data-hide-pointer');
      document.documentElement.style.removeProperty('--lvd-slide-ms');
    },
    [],
  );

  if (!slideDeck || at === null || !config) return null;
  return (
    <PresentationOverlay
      canvasTool={canvasTool}
      onSetCanvasTool={setCanvasTool}
      steps={slideDeck.runnable}
      at={at}
      onGo={(next) => slideDeck.setPresentingAt(next)}
      onExit={slideDeck.exitPresentation}
      direction={direction}
      config={config}
      onChangeConfig={slideDeck.updateConfig}
    />
  );
}
