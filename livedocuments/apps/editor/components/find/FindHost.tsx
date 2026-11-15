'use client';

// Where the Find bar sits (docs/specs/007-editor/find-and-replace.md "The bar"): at the canvas's top right, under the
// Toolbar strip; on a phone across the canvas's top under the strip. Placed against the canvas's own box (it moves
// with the header, the tab bar and a side pane), so the canvas never re-renders for it. The bar's code loads the first
// time it opens, its Find field standing in meanwhile so what is typed is the query (FindBarLoading). It runs the find
// state itself (useFindReplace), so a key typed into the bar re-renders the bar and not the editor around it; the
// editor's door (FindDoor.openBar) reaches its opener through `openerRef`.
import {
  lazy,
  memo,
  Suspense,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type RefObject,
} from 'react';
import { useIsMobileViewport } from '@liveworkspace/workbench/hooks/ui/useIsMobileViewport';
import { toolbarTopClearancePx } from '@/lib/canvas-chrome';
import { useAssignRef } from '@liveworkspace/workbench/hooks/ui/useLatest';
import { useFindReplace, type FindDeps, type FindDoor } from '@/hooks/editor/useFindReplace';
import { FindBarLoading } from './FindBarLoading';
import { useEditorChromeLatest } from '@/app/document/[id]/EditorContext';
import { sameDepsButWriting } from '@/app/document/[id]/editor-chrome-equal';

const FindBar = lazy(() => import('./FindBar').then((m) => ({ default: m.FindBar })));

// The bar's width on a desktop, and its inset from the canvas's edges.
const BAR_WIDTH = 420;
const INSET = 16;
const PHONE_INSET = 8;

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
  const deps = useEditorChromeLatest(
    (s) => s.findDeps,
    (a, b) => !openRef.current && sameDepsButWriting(a, b),
  );
  return <FindHost {...props} deps={deps} openRef={openRef} />;
});

export function FindHost({
  deps,
  openerRef,
  canvasMainRef,
  openRef,
}: FindHostProps & {
  deps: FindDeps;
  // Told whether the bar is open, after each render.
  openRef?: RefObject<boolean>;
}) {
  const find = useFindReplace(deps);
  useAssignRef(openerRef, find.openBar);
  const phone = useIsMobileViewport();
  const [box, setBox] = useState<Box | null>(null);
  const open = find.open;
  useLayoutEffect(() => {
    if (openRef) openRef.current = open;
  });
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
  if (!open || !box) return null;
  const top = box.top + toolbarTopClearancePx(1);
  const style: CSSProperties = phone
    ? { top, left: box.left + PHONE_INSET, right: box.right + PHONE_INSET }
    : { top, right: box.right + INSET, width: `min(${BAR_WIDTH}px, calc(100vw - ${2 * INSET}px))` };
  return (
    <div className="pointer-events-none fixed z-[var(--z-panel)]" style={style}>
      <Suspense fallback={<FindBarLoading find={find} />}>
        <FindBar find={find} />
      </Suspense>
    </div>
  );
}
