'use client';

// Where the Find bar sits (docs/specs/007-editor/find-and-replace.md "The bar"): at the canvas's top right, under the
// Toolbar strip; on a phone across the canvas's top under the strip. A page's title bar it would cover (Lock page and
// the cog at its right end) puts it under that title bar instead (findBarTop), checked as the canvas pans or zooms. Placed against the canvas's own box (it moves
// with the header, the tab bar and a side pane), so the canvas never re-renders for it. The bar's code loads the first
// time it opens, its Find field standing in meanwhile so what is typed is the query (FindBarLoading). It runs the find
// state itself (useFindReplace), so a key typed into the bar re-renders the bar and not the editor around it; the
// editor's door (FindDoor.openBar) reaches its opener through `openerRef`.
import {
  lazy,
  memo,
  Suspense,
  useLayoutEffect,
  useReducer,
  useRef,
  useState,
  type CSSProperties,
  type RefObject,
} from 'react';
import { useIsMobileViewport } from '@liveworkspace/workbench/hooks/ui/useIsMobileViewport';
import {
  canvasGestureNow,
  subscribeCanvasGesture,
} from '@liveworkspace/workbench/lib/canvas-gesture';
import { toolbarTopClearancePx } from '@/lib/canvas-chrome';
import { useAssignRef } from '@liveworkspace/workbench/hooks/ui/useLatest';
import { useFindReplace, type FindDeps, type FindDoor } from '@/hooks/editor/useFindReplace';
import { FindBarLoading } from './FindBarLoading';
import { findBarTop } from '@liveworkspace/workbench/components/find/find-bar-top';
import { useEditorChromeLatest } from '@/app/document/[id]/EditorContext';
import { sameDepsButWriting } from '@/app/document/[id]/editor-chrome-equal';

const FindBar = lazy(() => import('./FindBar').then((m) => ({ default: m.FindBar })));

// The bar's width on a desktop, and its inset from the canvas's edges.
const BAR_WIDTH = 420;
const INSET = 16;
const PHONE_INSET = 8;
// How long the bar keeps placing itself, each frame, after the last cause to: a pan, a zoom or the canvas springing
// back from its edge eases for up to about this long.
const PLACE_SETTLE_MS = 500;
// The page title bars the bar keeps clear of (PageTitleBar).
const TITLE_BAR_SELECTOR = '[data-page-title-bar]';

type Box = { top: number; left: number; right: number };

type FindHostProps = {
  openerRef: RefObject<FindDoor['openBar']>;
  canvasMainRef: RefObject<HTMLElement | null>;
};

// The editor's Find (docs/specs/007-editor/blueprints/flashcards.md "Performance and limits"): its deps from the
// chrome store. While the bar is shut a typing commit renders nothing here (nothing it shows changed); while it is open
// every commit does, so the matches follow the writing.
export const EditorFindHost = memo(function EditorFindHost(props: FindHostProps) {
  const openRef = useRef(false);
  // The bar opening re-renders this host once, so `deps` is the newest as it opens: while it was shut, the commits
  // that wrote the article went unrendered here, and the bar's own state re-renders only FindHost, which would
  // search the writing as it was when the bar last rendered (Work Tracker 1051).
  const [, refresh] = useReducer((n: number) => n + 1, 0);
  const deps = useEditorChromeLatest(
    (s) => s.findDeps,
    (a, b) => !openRef.current && sameDepsButWriting(a, b),
  );
  return <FindHost {...props} deps={deps} openRef={openRef} onOpenChange={refresh} />;
});

export function FindHost({
  deps,
  openerRef,
  canvasMainRef,
  openRef,
  onOpenChange,
}: FindHostProps & {
  deps: FindDeps;
  // Told whether the bar is open, after each render.
  openRef?: RefObject<boolean>;
  // Told when the bar opens or closes, so the host that owns `deps` can hand it the newest.
  onOpenChange?: () => void;
}) {
  const find = useFindReplace(deps);
  useAssignRef(openerRef, find.openBar);
  const phone = useIsMobileViewport();
  const [box, setBox] = useState<Box | null>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const open = find.open;
  useLayoutEffect(() => {
    if (openRef) openRef.current = open;
  });
  useLayoutEffect(() => {
    onOpenChange?.();
  }, [open, onOpenChange]);
  useLayoutEffect(() => {
    const main = canvasMainRef.current;
    if (!open || !main) return;
    const measure = () => {
      const r = main.getBoundingClientRect();
      setBox({ top: r.top, left: r.left, right: window.innerWidth - r.right });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(main);
    window.addEventListener('resize', measure);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [open, canvasMainRef]);
  const top = box ? box.top + toolbarTopClearancePx(1) : 0;
  // Clear of the page title bars: written straight to the bar's style (a pan or zoom moves them with no render here),
  // after each render, on a canvas gesture, the wheel, a resize (the bar's own too, Replace opening) and a press or key
  // that may zoom, never on idle frames.
  const place = useRef<() => void>(() => {});
  useLayoutEffect(() => {
    const el = barRef.current;
    const main = canvasMainRef.current;
    if (!open || !box || !el || !main) return;
    let raf = 0;
    let until = 0;
    const follow = () => {
      const r = el.getBoundingClientRect();
      const avoid = [...document.querySelectorAll(TITLE_BAR_SELECTOR)].map((t) =>
        t.getBoundingClientRect(),
      );
      const at = findBarTop(
        top,
        { left: r.left, right: r.right, height: r.height },
        avoid,
        main.getBoundingClientRect().bottom - INSET,
      );
      const px = `${Math.round(at)}px`;
      if (el.style.top !== px) el.style.top = px;
    };
    const tick = () => {
      raf = 0;
      follow();
      const gesture = canvasGestureNow();
      if (gesture === 'pan' || gesture === 'zoom' || performance.now() < until)
        raf = requestAnimationFrame(tick);
    };
    const schedule = () => {
      until = performance.now() + PLACE_SETTLE_MS;
      if (!raf) raf = requestAnimationFrame(tick);
    };
    place.current = follow;
    follow();
    const observer = new ResizeObserver(schedule);
    observer.observe(el);
    const unsubscribe = subscribeCanvasGesture(schedule);
    window.addEventListener('wheel', schedule, { passive: true });
    window.addEventListener('pointerup', schedule);
    window.addEventListener('keyup', schedule);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      place.current = () => {};
      observer.disconnect();
      unsubscribe();
      window.removeEventListener('wheel', schedule);
      window.removeEventListener('pointerup', schedule);
      window.removeEventListener('keyup', schedule);
    };
  }, [open, box, top, canvasMainRef]);
  useLayoutEffect(() => place.current());
  if (!open || !box) return null;
  const style: CSSProperties = phone
    ? { top, left: box.left + PHONE_INSET, right: box.right + PHONE_INSET }
    : { top, right: box.right + INSET, width: `min(${BAR_WIDTH}px, calc(100vw - ${2 * INSET}px))` };
  return (
    <div
      ref={barRef}
      data-find-bar=""
      className="pointer-events-none fixed z-[var(--z-panel)]"
      style={style}
    >
      <Suspense fallback={<FindBarLoading find={find} />}>
        <FindBar find={find} />
      </Suspense>
    </div>
  );
}
