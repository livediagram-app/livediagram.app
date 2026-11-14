'use client';

// Mounts the presentation (docs/specs/012-collaboration/presentation-mode.md) over the editor, and owns the state
// that belongs to a RUNNING deck rather than to the deck itself: which way the last move travelled (for the HUD),
// the slide last asked for, and whether the first slide has arrived.
//
// Split out of EditorView so the view stays a layout: this is the whole of
// "there is a presentation happening" in one place, and it renders nothing at
// all when there is not.

import dynamic from 'next/dynamic';
import { startTransition, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  resolveSlide,
  slideBuildOrders,
  stepBuild,
  type PresentingBuild,
} from '@livedocuments/document';

import { loadedPresentationOverlay, loadPresentationOverlay } from '@/lib/editor-deferred-code';
import { useEditorContext } from '@/app/document/[id]/EditorContext';
import { slideDurationMs } from '@/lib/presentation-config';
import { useLatest } from '@liveworkspace/workbench/hooks/ui/useLatest';
import { useFocusReturn } from '@liveworkspace/workbench/hooks/ui/useFocusReturn';
import { CANVAS_ROOT_SELECTOR } from '@liveworkspace/workbench/lib/canvas-selectors';
import { startTypedTransition } from '@liveworkspace/workbench/lib/view-transition';
import {
  slideTransitionType,
  whenScreenSettles,
} from '@liveworkspace/workbench/components/canvas/slide-transition';

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
  // The build position last asked for (presentation-mode.md "Builds"), beside `asked`: a quick press counts from the
  // build a move still on its way set, not the one on screen.
  const askedBuild = useRef<PresentingBuild | null>(null);
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
      askedBuild.current = null;
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

  // The slide on screen's builds for the overlay (how many show, how many it has), worked out once per slide or step:
  // resolving a slide lays out its tab's pages.
  const onScreen = at === null ? undefined : slideDeck?.runnable[at];
  const presentingBuild = slideDeck?.presentingBuild ?? null;
  const build = useMemo(() => {
    if (!onScreen) return { shown: 0, count: 0 };
    const count = slideBuildOrders(resolveSlide(onScreen.slide, onScreen.tab)).length;
    const shown =
      presentingBuild?.slideId === onScreen.slide.id ? Math.min(presentingBuild.shown, count) : 0;
    return { shown, count };
  }, [onScreen, presentingBuild]);

  if (!slideDeck || at === null || !config || !Overlay) return null;
  // An item slide is the card itself, drawn over the canvas (docs/specs/012-collaboration/presentation-mode.md
  // "Item slides").
  // A move: a step (one slide either way, named by the overlay) counts from the slide last asked for, so quick
  // presses near the deck's ends wrap (Loop), stop at the end state or leave from where the last one went; a jump
  // is taken as given. Then it runs as a transition typed by its direction, or plainly for None
  // (startTypedTransition cuts under reduced motion). Answers where it went, or null when the deck ended.
  const go = (next: number, step?: 1 | -1): number | null => {
    const from = asked.current ?? at;
    const ends = slideDeck.runnable.length;
    const run = slideDeck.runnable;
    // A slide's builds (presentation-mode.md "Builds"): how many it has, and how many show at `from`.
    const buildsOf = (i: number) => {
      const st = run[i];
      return st ? slideBuildOrders(resolveSlide(st.slide, st.tab)).length : 0;
    };
    const setBuild = (b: PresentingBuild | null, alongMove: boolean) => {
      askedBuild.current = b;
      // While a move is on its way React holds it in a transition; the build rides the same one so the two commit
      // together, and the slide leaving never loses its builds a frame early.
      if (alongMove) startTransition(() => slideDeck.setPresentingBuild(b));
      else slideDeck.setPresentingBuild(b);
    };
    if (step !== undefined && from < ends) {
      const here = run[from]!.slide.id;
      const shown = askedBuild.current?.slideId === here ? askedBuild.current.shown : 0;
      const built = stepBuild({ slideId: here, shown }, buildsOf(from), step);
      if (built) {
        setBuild(built, asked.current !== null && asked.current !== at);
        return from;
      }
    }
    let target = Math.min(Math.max(0, next), ends);
    if (step !== undefined) {
      target = Math.max(0, from + step);
      if (target >= ends && config.loop) target = 0;
      else if (target > ends) {
        // Past the end state: leave, unless a move there is still on its way (a quick double press stops at it).
        if (asked.current === null) {
          slideDeck.exitPresentation();
          return null;
        }
        target = ends;
      }
    }
    asked.current = target;
    // The slide it lands on: finished going back a step (every build showing, none replaying), else unbuilt.
    const count = step === -1 ? buildsOf(target) : 0;
    const arrival: PresentingBuild | null =
      count > 0 ? { slideId: run[target]!.slide.id, shown: count, entering: false } : null;
    askedBuild.current = arrival;
    const land = () => {
      slideDeck.setPresentingBuild(arrival);
      slideDeck.setPresentingAt(target);
    };
    const type = slideTransitionType(config.transition, from, target);
    if (type) startTypedTransition(type, land);
    else land();
    return target;
  };
  return (
    <Overlay
      canvasTool={canvasTool}
      onSetCanvasTool={setCanvasTool}
      steps={slideDeck.runnable}
      at={at}
      build={build}
      onGo={go}
      onExit={slideDeck.exitPresentation}
      direction={direction}
      config={config}
      onChangeConfig={slideDeck.updateConfig}
    />
  );
}

