'use client';

// Reposition, on a picture cover (docs/specs/030-knowledgebase/page-surface.md "The cover"): the picture is dragged
// up and down to choose which part of it shows (its focus, 0 its top and 100 its foot), or moved by the arrow keys
// 5 at a time while the band has the focus; Enter saves and Escape cancels. Nothing is stored until Save Position,
// and the drag moves only the picture's object-position, so nothing else on the page re-renders while it moves.
import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type RefObject,
} from 'react';
import { COVER_FOCUS_CENTRE, movedCoverFocus, type TabCover } from '@liveknowledge/document';
import { useSetPageCover } from './page-cover-state';

/** How far the arrow keys move the focus. */
export const COVER_FOCUS_STEP = 5;

/**
 * The focus a drag of `dy` screen px moves a picture to. The picture fills the band's width or height (object-fit:
 * cover), so what it can move is the part of its height the band hides: dragging it down by all of that shows its
 * top (focus 0). A picture no taller than the band has nothing to move.
 */
export function draggedCoverFocus(
  start: number,
  dy: number,
  picture: { width: number; height: number },
  band: { width: number; height: number },
): number {
  if (picture.width <= 0 || picture.height <= 0 || band.height <= 0) return start;
  const scale = Math.max(band.width / picture.width, band.height / picture.height);
  const hidden = picture.height * scale - band.height;
  if (hidden <= 0.5) return start;
  return movedCoverFocus(start, (-dy / hidden) * 100);
}

export type CoverReposition = {
  active: boolean;
  /** The focus shown while repositioning. */
  focus: number;
  start: () => void;
  save: () => void;
  cancel: () => void;
  /** The band's handlers while repositioning. */
  bandProps: {
    tabIndex: number;
    role: 'slider';
    'aria-label': string;
    'aria-valuemin': number;
    'aria-valuemax': number;
    'aria-valuenow': number;
    'aria-valuetext': string;
    'aria-orientation': 'vertical';
    onPointerDown: (e: PointerEvent<HTMLDivElement>) => void;
    onPointerMove: (e: PointerEvent<HTMLDivElement>) => void;
    onPointerUp: (e: PointerEvent<HTMLDivElement>) => void;
    onPointerCancel: (e: PointerEvent<HTMLDivElement>) => void;
    onKeyDown: (e: KeyboardEvent<HTMLDivElement>) => void;
  };
};

export function useCoverReposition({
  cover,
  imgRef,
  bandRef,
}: {
  cover: TabCover;
  imgRef: RefObject<HTMLImageElement | null>;
  bandRef: RefObject<HTMLDivElement | null>;
}): CoverReposition {
  const setCover = useSetPageCover();
  // The picture being repositioned (its id), so a cover that changes under the reposition (a peer's, an undo) ends
  // it: what was being placed is gone.
  const picture = 'imageId' in cover ? cover : null;
  const stored = picture?.focus ?? COVER_FOCUS_CENTRE;
  const [placing, setPlacing] = useState<string | null>(null);
  const active = placing !== null && placing === picture?.imageId;
  const [focus, setFocus] = useState(stored);
  const drag = useRef<{ pointer: number; y: number; from: number } | null>(null);
  // The band takes the focus as the reposition starts, so the arrows, Enter and Escape reach it.
  useEffect(() => {
    if (active) bandRef.current?.focus({ preventScroll: true });
  }, [active, bandRef]);

  const start = () => {
    setFocus(stored);
    setPlacing(picture?.imageId ?? null);
  };
  const cancel = () => {
    drag.current = null;
    setPlacing(null);
  };
  const save = () => {
    drag.current = null;
    setPlacing(null);
    if (!picture || focus === stored) return;
    const { focus: _was, ...rest } = picture;
    setCover(focus === COVER_FOCUS_CENTRE ? rest : { ...rest, focus });
  };
  const sizes = () => {
    const img = imgRef.current;
    const band = bandRef.current;
    return {
      picture: { width: img?.naturalWidth ?? 0, height: img?.naturalHeight ?? 0 },
      band: { width: band?.clientWidth ?? 0, height: band?.clientHeight ?? 0 },
    };
  };
  return {
    active,
    focus,
    start,
    save,
    cancel,
    bandProps: {
      tabIndex: 0,
      role: 'slider',
      'aria-label': 'Cover Position',
      'aria-valuemin': 0,
      'aria-valuemax': 100,
      'aria-valuenow': focus,
      'aria-valuetext': `${focus}% down the picture`,
      'aria-orientation': 'vertical',
      onPointerDown: (e) => {
        // The buttons over the band keep their own presses.
        if (e.button !== 0 || (e.target as Element).closest('button')) return;
        e.preventDefault();
        e.currentTarget.setPointerCapture?.(e.pointerId);
        drag.current = { pointer: e.pointerId, y: e.clientY, from: focus };
      },
      onPointerMove: (e) => {
        const d = drag.current;
        if (!d || d.pointer !== e.pointerId) return;
        const { picture, band } = sizes();
        setFocus(draggedCoverFocus(d.from, e.clientY - d.y, picture, band));
      },
      onPointerUp: (e) => {
        if (drag.current?.pointer === e.pointerId) drag.current = null;
      },
      onPointerCancel: (e) => {
        if (drag.current?.pointer !== e.pointerId) return;
        setFocus(drag.current.from);
        drag.current = null;
      },
      onKeyDown: (e) => {
        if (e.target !== e.currentTarget) return;
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
          e.preventDefault();
          // The picture moves as the key says: up shows more of its foot, as dragging it up does.
          setFocus((f) =>
            movedCoverFocus(f, e.key === 'ArrowUp' ? COVER_FOCUS_STEP : -COVER_FOCUS_STEP),
          );
        } else if (e.key === 'Enter') {
          e.preventDefault();
          save();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          cancel();
        }
      },
    },
  };
}
