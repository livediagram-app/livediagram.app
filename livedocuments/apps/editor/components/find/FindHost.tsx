'use client';

// Where the Find bar sits (docs/specs/007-editor/find-and-replace.md "The bar"): at the canvas's top right, under the
// Toolbar strip; on a phone across the canvas's top under the strip. Placed against the canvas's own box (it moves
// with the header, the tab bar and a side pane), so the canvas never re-renders for it. The bar's code loads the first
// time it opens, its Find field standing in meanwhile so what is typed is the query (FindBarLoading).
import {
  lazy,
  Suspense,
  useLayoutEffect,
  useState,
  type CSSProperties,
  type RefObject,
} from 'react';
import { useIsMobileViewport } from '@liveworkspace/workbench/hooks/ui/useIsMobileViewport';
import { toolbarTopClearancePx } from '@/lib/canvas-chrome';
import type { FindView } from '@/hooks/editor/useFindReplace';
import { FindBarLoading } from './FindBarLoading';

const FindBar = lazy(() => import('./FindBar').then((m) => ({ default: m.FindBar })));

// The bar's width on a desktop, and its inset from the canvas's edges.
const BAR_WIDTH = 420;
const INSET = 16;
const PHONE_INSET = 8;

type Box = { top: number; left: number; right: number };

export function FindHost({
  find,
  canvasMainRef,
}: {
  find: FindView;
  canvasMainRef: RefObject<HTMLElement | null>;
}) {
  const phone = useIsMobileViewport();
  const [box, setBox] = useState<Box | null>(null);
  const open = find.open;
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
