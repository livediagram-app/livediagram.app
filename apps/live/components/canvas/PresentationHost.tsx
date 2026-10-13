'use client';

// Mounts the presentation (docs/specs/012-collaboration/presentation-mode.md) over the editor, and owns the two pieces
// of state that belong to a RUNNING deck rather than to the deck itself: which
// way the last move travelled (so the slide transition knows which way to
// slide) and the transition's own tick.
//
// Split out of EditorView so the view stays a layout: this is the whole of
// "there is a presentation happening" in one place, and it renders nothing at
// all when there is not.

import dynamic from 'next/dynamic';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';

import { ITEM_TYPES } from '@livediagram/items';
import { loadedPresentationOverlay, loadPresentationOverlay } from '@/lib/editor-deferred-code';
import { useCanvasSurface } from '@/components/canvas/CanvasSurfaceContext';
import { usePlan } from '@/components/plan/PlanContext';
import { planPalette } from '@/components/plan/plan-palette';
import { useEditorContext } from '@/app/document/[id]/EditorContext';
import { slideDurationMs } from '@/lib/presentation-config';
import { useLatest } from '@/hooks/ui/useLatest';
import {
  restartMove,
  sendOff,
  SLIDE_SURFACE_SELECTOR,
  snapshotOutgoing,
  whenScreenSettles,
  type SlideMove,
} from './slide-transition';

// Drawn only while presenting; fetched once the editor is idle (lib/editor-deferred-code.ts), and a deck
// starts only once it is in (useSlideDeck). This lazy wrapper is the fallback for a presentation entered
// before the code loaded.
const LazyPresentationOverlay = dynamic(loadPresentationOverlay, { ssr: false });

// Plan's UI loads only when it is drawn (docs/specs/026-plan/plan-mode.md "Cost"), so a document without
// Plan pays nothing for it.
const ItemSlideView = dynamic(
  () => import('@/components/plan/ItemSlideView').then((m) => m.ItemSlideView),
  { ssr: false },
);

// Matches the CSS in globals.css (.lvd-slide-*), so the class is removed the
// moment the animation ends rather than being left on the node.
export function PresentationHost() {
  const { slideDeck, canvasTool, setCanvasTool } = useEditorContext();
  const plan = usePlan();
  const surface = useCanvasSurface();
  const at = slideDeck?.presentingAt ?? null;
  // The slide on screen ('end' for the end state): a peer's edit can move the
  // slide's place in the run without the slide changing, which is no move.
  const shown = at === null ? null : (slideDeck?.runnable[at]?.slide.id ?? 'end');
  const [direction, setDirection] = useState<'forward' | 'back'>('forward');
  const prevAt = useRef<number | null>(null);
  const prevShown = useRef<string | null>(null);
  // Device-local presenter settings (docs/specs/012-collaboration/presentation-mode.md). Owned by the deck hook, because
  // the camera reads them too.
  const config = slideDeck?.config;
  const configRef = useLatest(config);
  // The outgoing slide, snapshotted the moment a move is asked for (before the new slide replaces it on the
  // canvas), sent off once the move lands (slide-transition.ts).
  const outgoing = useRef<HTMLElement | null>(null);
  // The overlay holds the deck's keys, so it draws in the very commit the first slide does: the loaded
  // component itself when its code is in, never a lazy wrapper that waits a frame (and drops a key pressed
  // in it). Chosen once per presentation, so it never swaps (and remounts) mid-deck.
  const [Overlay, setOverlay] = useState<typeof LazyPresentationOverlay | null>(null);
  if (at !== null && Overlay === null)
    setOverlay(() => loadedPresentationOverlay() ?? LazyPresentationOverlay);
  if (at === null && Overlay !== null) setOverlay(null);

  // Drive the canvas's transition class. The canvas underneath is the thing
  // that actually moves — one transform on one layer, so a hundred-element
  // slide costs exactly what a one-element slide does.
  //
  // A LAYOUT effect: the new slide is already on the canvas when this runs, so setting the move after paint showed
  // one frame of it at rest before it jumped off-screen to slide in.
  useLayoutEffect(() => {
    const root = document.documentElement;
    if (at === null) {
      root.removeAttribute('data-presenting');
      root.removeAttribute('data-slide-move');
      prevAt.current = null;
      prevShown.current = null;
      outgoing.current = null;
      return;
    }
    const before = prevAt.current;
    const shownBefore = prevShown.current;
    prevAt.current = at;
    prevShown.current = shown;
    root.setAttribute('data-presenting', '');
    const cfg = configRef.current;
    if (cfg) {
      root.setAttribute('data-slide-transition', cfg.transition);
      // The chosen speed drives the animation's duration through a variable,
      // so the keyframes stay one definition rather than three.
      root.style.setProperty('--lvd-slide-ms', `${slideDurationMs(cfg)}ms`);
      root.toggleAttribute('data-hide-pointer', cfg.hidePointer);
    }
    const surface = document.querySelector(SLIDE_SURFACE_SELECTOR);
    const ghost = outgoing.current;
    outgoing.current = null;
    // Cleared on the animation's OWN end event, not on a timer. A timer has to
    // guess the duration, and guessing even slightly short yanked the
    // attribute mid-animation — the element snapped from wherever it had got
    // to straight to its resting place, which is the little bounce at the end
    // of a transition that reads as rubber-banding.
    // The surface's OWN animation: an animationend bubbling up from an element inside it (a note's entrance, a
    // looping sticker) must not end the slide move early.
    const done = (e?: Event) => {
      if (e && e.target !== surface) return;
      root.removeAttribute('data-slide-move');
    };
    let failsafe = 0;
    const begin = (move: SlideMove) => {
      restartMove(root, surface, move);
      // Belt and braces: if the surface is missing or the animation never runs
      // (reduced motion with animations disabled outright, a hidden tab), the
      // attribute must not stick and block the next transition.
      failsafe = window.setTimeout(() => done(), 1200);
    };
    surface?.addEventListener('animationend', done);
    surface?.addEventListener('animationcancel', done);
    let cancelSettle = () => {};
    if (before === null) {
      // Entering: the first slide arrives as a card rather than a page swap, once fullscreen has landed and the
      // slide been fitted to it; until then it holds back, so the card never arrives and then jumps.
      root.setAttribute('data-slide-move', 'pending');
      cancelSettle = whenScreenSettles(() => begin('in'));
    } else if (shown !== shownBefore) {
      const dir = at > before ? 'forward' : 'back';
      setDirection(dir);
      begin(dir);
      // The outgoing slide leaves the other way as the new one arrives.
      if (ghost) sendOff(ghost, dir);
    }
    // The same slide at a new place (a peer's edit) moves nothing, but the
    // listeners above still clear a move already under way.
    return () => {
      cancelSettle();
      surface?.removeEventListener('animationend', done);
      surface?.removeEventListener('animationcancel', done);
      window.clearTimeout(failsafe);
    };
  }, [at, shown, configRef]);

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

  if (!slideDeck || at === null || !config || !Overlay) return null;
  // An item slide is the card itself, drawn over the canvas (docs/specs/012-collaboration/presentation-mode.md
  // "Item slides").
  const itemId = slideDeck.runnable[at]?.slide.itemId;
  return (
    <>
      {itemId ? (
        <ItemSlideView
          item={plan?.items.get(itemId)}
          types={plan?.types ?? ITEM_TYPES}
          statusNames={plan?.statusNames}
          palette={planPalette(surface, {})}
        />
      ) : null}
      <Overlay
        canvasTool={canvasTool}
        onSetCanvasTool={setCanvasTool}
        steps={slideDeck.runnable}
        at={at}
        onGo={(next) => {
          // Snapshotted now, while the canvas still shows the slide being left.
          if (next !== at)
            outgoing.current = snapshotOutgoing(
              document.querySelector(SLIDE_SURFACE_SELECTOR),
              config.transition,
            );
          slideDeck.setPresentingAt(next);
        }}
        onExit={slideDeck.exitPresentation}
        direction={direction}
        config={config}
        onChangeConfig={slideDeck.updateConfig}
      />
    </>
  );
}
