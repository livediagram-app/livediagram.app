'use client';

// Mounts the presentation (docs/specs/012-collaboration/presentation-mode.md) over the editor, and owns the state
// that belongs to a RUNNING deck rather than to the deck itself: which way the last move travelled (for the HUD),
// the slide last asked for, and whether the first slide has arrived.
//
// Split out of EditorView so the view stays a layout: this is the whole of
// "there is a presentation happening" in one place, and it renders nothing at
// all when there is not.

import dynamic from 'next/dynamic';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';

import { loadedPresentationOverlay, loadPresentationOverlay } from '@/lib/editor-deferred-code';
import { useEditorContext } from '@/app/document/[id]/EditorContext';
import { slideDurationMs } from '@/lib/presentation-config';
import { useLatest } from '@/hooks/ui/useLatest';
import { useFocusReturn } from '@/hooks/ui/useFocusReturn';
import { CANVAS_ROOT_SELECTOR } from '@liveworkspace/workbench/lib/canvas-selectors';
import { startTypedTransition } from '@/lib/view-transition';
import { slideTransitionType, whenScreenSettles } from './slide-transition';

// Drawn only while presenting; fetched once the editor is idle (lib/editor-deferred-code.ts), and a deck
// starts only once it is in (useSlideDeck). This lazy wrapper is the fallback for a presentation entered
// before the code loaded.
const LazyPresentationOverlay = dynamic(loadPresentationOverlay, { ssr: false });

// Where focus lands after a deck when the Present that started it has gone (the header's remounts with the chrome):
// a Present on screen, else the canvas.
const presentOrCanvas = () =>
  [...document.querySelectorAll<HTMLElement>('[data-presentation-start]')].find(
    (el) => el.getClientRects().length > 0,
  ) ?? document.querySelector<HTMLElement>(`main${CANVAS_ROOT_SELECTOR}`);

export function PresentationHost() {
  const { slideDeck, canvasTool, setCanvasTool } = useEditorContext();
  const at = slideDeck?.presentingAt ?? null;
  const presenting = at !== null;
  // Leaving the deck hands focus back to the Present that started it (presentation-mode.md "Exiting"). Taken from the
  // press, while the deck loads: Present is disabled then, and a disabled button lets go of focus.
  useFocusReturn(presenting || !!slideDeck?.startingDeck, presentOrCanvas);
  // The slide on screen ('end' for the end state): a peer's edit can move the
  // slide's place in the run without the slide changing, which is no move.
  const shown = at === null ? null : (slideDeck?.runnable[at]?.slide.id ?? 'end');
  const [direction, setDirection] = useState<'forward' | 'back'>('forward');
  const prevAt = useRef<number | null>(null);
  const prevShown = useRef<string | null>(null);
  // The slide last asked for. React holds a transition while a View Transition runs, so `at` lags behind quick
  // presses; a step counts from here instead, and every press lands (presentation-mode.md "Motion").
  const asked = useRef<number | null>(null);
  // Device-local presenter settings (docs/specs/012-collaboration/presentation-mode.md). Owned by the deck hook, because
  // the camera reads them too.
  const config = slideDeck?.config;
  const configRef = useLatest(config);
  // Whether the first slide has arrived: until the screen settles it is held hidden (`pending`), then revealed as a
  // `slide-in` transition. Reset as the deck ends, so the next one arrives the same way.
  const [revealed, setRevealed] = useState(false);
  if (!presenting && revealed) setRevealed(false);
  // The overlay holds the deck's keys, so it draws in the very commit the first slide does: the loaded
  // component itself when its code is in, never a lazy wrapper that waits a frame (and drops a key pressed
  // in it). Chosen once per presentation, so it never swaps (and remounts) mid-deck.
  const [Overlay, setOverlay] = useState<typeof LazyPresentationOverlay | null>(null);
  if (at !== null && Overlay === null)
    setOverlay(() => loadedPresentationOverlay() ?? LazyPresentationOverlay);
  if (at === null && Overlay !== null) setOverlay(null);

  // The deck's marks on <html> and the direction of travel. A LAYOUT effect: it runs in the commit that put the new
  // slide on the canvas, before the browser takes its picture of it. The move itself animates as a View Transition
  // (onGo below), so nothing here drives an animation.
  useLayoutEffect(() => {
    if (asked.current === at) asked.current = null;
    const root = document.documentElement;
    if (at === null) {
      root.removeAttribute('data-presenting');
      prevAt.current = null;
      prevShown.current = null;
      asked.current = null;
      return;
    }
    const before = prevAt.current;
    const shownBefore = prevShown.current;
    prevAt.current = at;
    prevShown.current = shown;
    root.setAttribute('data-presenting', '');
    const cfg = configRef.current;
    if (cfg) {
      // The chosen speed drives the animation's duration through a variable the View Transition's
      // pseudo-elements inherit, so the keyframes stay one definition rather than three.
      root.style.setProperty('--lvd-slide-ms', `${slideDurationMs(cfg)}ms`);
      root.toggleAttribute('data-hide-pointer', cfg.hidePointer);
    }
    // The same slide at a new place (a peer's edit) moves nothing.
    if (before !== null && shown !== shownBefore) setDirection(at > before ? 'forward' : 'back');
  }, [at, shown, configRef]);

  // The entrance: the first slide is held hidden until fullscreen has landed and the slide is fitted to it, so the
  // card never arrives and then jumps; then it is revealed as a `slide-in` transition (a cut under reduced motion).
  useLayoutEffect(() => {
    const root = document.documentElement;
    if (!presenting || revealed) {
      root.removeAttribute('data-slide-move');
      return;
    }
    root.setAttribute('data-slide-move', 'pending');
    return whenScreenSettles(() => startTypedTransition('slide-in', () => setRevealed(true)));
  }, [presenting, revealed]);

  // Leaving the mode must always clean up, including on unmount (a navigation
  // away mid-presentation would otherwise leave the attribute on <html>).
  useEffect(
    () => () => {
      document.documentElement.removeAttribute('data-presenting');
      document.documentElement.removeAttribute('data-slide-move');
      document.documentElement.removeAttribute('data-hide-pointer');
      document.documentElement.style.removeProperty('--lvd-slide-ms');
    },
    [],
  );

  if (!slideDeck || at === null || !config || !Overlay) return null;
  // A move: a step (one slide either way) counts from the slide last asked for, a jump is taken as given; then it
  // runs as a transition typed by its direction, or plainly for None (startTypedTransition cuts under reduced motion).
  const go = (next: number) => {
    const from = asked.current ?? at;
    const step = next - at;
    const target =
      Math.abs(step) === 1 ? Math.min(Math.max(0, from + step), slideDeck.runnable.length) : next;
    asked.current = target;
    const type = slideTransitionType(config.transition, from, target);
    if (type) startTypedTransition(type, () => slideDeck.setPresentingAt(target));
    else slideDeck.setPresentingAt(target);
  };
  return (
    <>
      <Overlay
        canvasTool={canvasTool}
        onSetCanvasTool={setCanvasTool}
        steps={slideDeck.runnable}
        at={at}
        onGo={go}
        onExit={slideDeck.exitPresentation}
        direction={direction}
        config={config}
        onChangeConfig={slideDeck.updateConfig}
      />
    </>
  );
}
