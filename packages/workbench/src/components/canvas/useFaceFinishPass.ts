'use client';

import { useLayoutEffect, type RefObject } from 'react';
import {
  MARKER_FACE_MAX_PARTS,
  faceBudgetSpent,
  markerFaceBudget,
  markerFaceSeed,
  spendFaceBudget,
  type MarkerFaceBudget,
} from '@liveworkspace/element-model/marker-face';
import type { Finish } from '@liveworkspace/element-model/finish';
import { isPillRect } from '@liveworkspace/model-core/face-finish';
import { scheduleFaceTake, type FaceTake, type FaceTakeWhen } from './face-take-batch';
import { watchUntilSettled, type SettleWatch } from './settle-watch';
import { watchFaceArrivals } from './face-arrivals';
import {
  INK_ATTR,
  DRAWN_ATTR,
  PILL_ATTR,
  SKIP,
  TAKING_ATTR,
  HOVER_ATTR,
  type Pen,
  type Write,
  MEASURE_ATTR,
  SHAPE_ATTR,
  ISOLATED_ATTR,
  RULES_ATTR,
  gridRules,
  isFaceBox,
  frameInk,
  shapeInk,
  isSvgShape,
} from './face-finish-ink';

// A write's marks: one element, or several (Array.isArray alone types a readonly list as any[]).
const isMarkList = (m: Element | readonly Element[]): m is readonly Element[] => Array.isArray(m);

// A face's own parts in its finish on the canvas. Under Marker (docs/specs/008-canvas/finish.md "Marker", "Faces: frames and shapes"):
// once the face has settled, its frames (outlined HTML boxes) and its SVG shapes are read from the live DOM and
// described to markerFacePart, the same rules and drawing the export runs over its markup (svgMarkerFace). Each
// part's ink goes in beside the part itself: an <svg> inside a frame, a <g> after a shape, in the shape's own
// coordinates. So it moves with the part (a column that scrolls, a band that animates) and sits under whatever the
// face draws above the part (its words). The part's own line is hidden by app/face-finish.css through the mark set
// here. The ink is ours, not React's: React never sees it, and every take clears the last one first. A face takes
// with the board's other faces (face-take-batch.ts): all clear, then all read, then all write, so a board of
// thousands of faces is laid out once per batch rather than once per face.

/** What a board of cards hands the pass (liveplanner's Plan board, its docs/specs/008-canvas/blueprints/finish.md).
 *  A face given one counts its frames apart from its other parts (MARKER_FACE_MAX_FRAMES against
 *  MARKER_FACE_MAX_PARTS), as a board's cards are frames by the hundred; a face given none keeps one count. Pass a
 *  module constant: the pass starts again whenever it changes. */
export type FaceFinishBoard = {
  /** The owner a part sits in (a card, a column), '' for none: its strokes are seeded by that owner and its order among
   *  the owner's drawn parts, not its place in the whole face, so a part coming or going elsewhere (a card dragged to
   *  another column) leaves every other part's ink as it was. */
  ownerOf?: (root: Element, el: Element) => string;
  /** A part the browser is not drawing (a busy board's card off screen): the take leaves it unread, and the face is
   *  taken again once such parts scroll into view and pause (face-arrivals.ts). */
  unseen?: (el: Element) => boolean;
  /** A change that touches nothing the pass draws (the pointer's own feedback on a board), on top of its own. */
  ignore?: (r: MutationRecord) => boolean;
};

/** The face under `root` in its finish, re-taken whenever it settles after a change: Marker draws its frames and
 *  shapes in marker; Sketch shades its shapes in pencil; Professional keeps its SVG pills round (face-finish.css
 *  squares every other rectangle). */
export function useFaceFinishPass(
  rootRef: RefObject<HTMLElement | null>,
  finish: Finish | undefined,
  elementId: string,
  {
    // A body that fills its tab or the screen is the page, not a box on it: its own box
    // is never coloured in.
    page = false,
    board,
  }: { page?: boolean; board?: FaceFinishBoard } = {},
): void {
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root || finish === undefined || finish === 'flexible') return;
    const pen: Pen = finish === 'marker' ? 'marker' : 'pencil';
    let cancel = () => {};
    let watch: SettleWatch | undefined;
    // The parts a take left unseen, watched until they scroll into view, then taken (face-arrivals.ts).
    const arrivals = board?.unseen ? watchFaceArrivals(() => take('frame')) : undefined;
    const boardIgnore = board?.ignore;
    const ignore = boardIgnore ? (r: MutationRecord) => ownChange(r) || boardIgnore(r) : ownChange;
    const settle = () => watchUntilSettled(root, () => take('frame'), { resize: true, ignore });
    // Marker and Sketch take with the board's other faces: a face that mounts before it is first painted, one that
    // settled or whose lettering loaded at the next frame. Professional only marks pills, which reads no layout.
    const take = (when: FaceTakeWhen) => {
      if (finish === 'professional') {
        markFacePills(root);
        return;
      }
      const { prepare, read } = markerFaceTake(
        root,
        elementId,
        pen,
        page,
        undefined,
        board,
        arrivals?.watch,
      );
      cancel = scheduleFaceTake(
        root,
        {
          prepare,
          read: () => {
            const write = read();
            return () => {
              const after = write();
              // Every change so far is drawn, the take's own included: none of them is a change to wait for. The
              // face is watched from its first take on.
              if (watch) watch.taken();
              else watch = settle();
              return after;
            };
          },
        },
        when,
      );
    };
    take('now');
    if (finish === 'professional') watch = settle();
    // Lettering that loads late reflows the face without a mutation.
    let live = true;
    void document.fonts?.ready.then(() => live && take('frame'));
    return () => {
      live = false;
      cancel();
      watch?.();
      arrivals?.stop();
      clearMarkerFace(root);
      root.removeAttribute(TAKING_ATTR);
      for (const pill of root.querySelectorAll(`[${PILL_ATTR}]`)) pill.removeAttribute(PILL_ATTR);
    };
  }, [rootRef, finish, elementId, page, board]);
}

/** Marks every SVG rectangle under `root` whose ends are round (a pill, a disc), which Professional keeps. */
export function markFacePills(root: Element): void {
  if (typeof SVGRectElement === 'undefined') return;
  for (const rect of root.querySelectorAll('rect')) {
    const pill = isPillRect(
      rect.width.baseVal.value,
      rect.height.baseVal.value,
      rect.rx.baseVal.value || rect.ry.baseVal.value,
    );
    if (pill !== rect.hasAttribute(PILL_ATTR)) rect.toggleAttribute(PILL_ATTR, pill);
  }
}

// A change the pass made (its ink going in or out, its marks), or one that changes nothing it draws (hover chrome).
function ownChange(r: MutationRecord): boolean {
  // Sketch's ink copy of the face (SketchFace) is re-taken from the live face: never a change to read. Nor is the
  // face's hover chrome, which the pass never reads (SKIP): the pointer passing over a table never re-takes it.
  const target = r.target instanceof Element ? r.target : r.target.parentElement;
  if (target?.closest(`[data-sketch-ink], [${HOVER_ATTR}]`)) return true;
  if (r.type === 'attributes')
    return (
      r.attributeName === DRAWN_ATTR ||
      r.attributeName === TAKING_ATTR ||
      r.attributeName === HOVER_ATTR ||
      r.attributeName === PILL_ATTR ||
      r.attributeName === RULES_ATTR ||
      r.attributeName === MEASURE_ATTR ||
      r.attributeName === ISOLATED_ATTR ||
      // The isolation it sets on a box it colours in.
      (r.attributeName === 'style' && (r.target as Element).hasAttribute?.(ISOLATED_ATTR))
    );
  if (r.type !== 'childList') return false;
  const ours = (n: Node) =>
    n instanceof Element && (n.hasAttribute(INK_ATTR) || n.hasAttribute(HOVER_ATTR));
  return [...r.addedNodes, ...r.removedNodes].every(ours);
}

/** Removes the pass's ink and marks under `root`. */
export function clearMarkerFace(root: Element): void {
  for (const ink of root.querySelectorAll(`[${INK_ATTR}]`)) ink.remove();
  for (const drawn of root.querySelectorAll(`[${DRAWN_ATTR}]`)) drawn.removeAttribute(DRAWN_ATTR);
  for (const ruled of root.querySelectorAll(`[${RULES_ATTR}]`)) ruled.removeAttribute(RULES_ATTR);
  for (const isolated of [root, ...root.querySelectorAll<HTMLElement>(`[${ISOLATED_ATTR}]`)])
    if (isolated instanceof HTMLElement && isolated.hasAttribute(ISOLATED_ATTR)) {
      isolated.style.isolation = '';
      isolated.removeAttribute(ISOLATED_ATTR);
    }
}

/** One take: clears the last, then draws every frame and shape under `root` that Marker draws. Returns how many. */
export function drawMarkerFace(
  root: HTMLElement,
  elementId: string,
  // Sketch's pencil shades the face's shapes only; its wobble draws the rest by hand.
  pen: Pen = 'marker',
  page = false,
  board?: FaceFinishBoard,
): number {
  let drawn = 0;
  const take = markerFaceTake(root, elementId, pen, page, (n) => (drawn = n), board);
  take.prepare?.();
  take.read()()?.();
  return drawn;
}

/** A take of `root` in steps for a batch (face-take-batch.ts): `prepare` holds the face still and clears the last
 *  take, `read` reads the face and every part to draw without writing anything, the write it returns draws them, and
 *  what the write returns lets the marks take effect and releases the face. `onDrawn` hears how many parts it drew,
 *  `onUnseen` the parts the board's `unseen` left unread, once the face is read. */
export function markerFaceTake(
  root: HTMLElement,
  elementId: string,
  pen: Pen = 'marker',
  page = false,
  onDrawn?: (drawn: number) => void,
  board?: FaceFinishBoard,
  onUnseen?: (parts: readonly Element[]) => void,
): FaceTake {
  // Sketch hides a live face's fills and lines (its ink copy shows them through the wobble, app/sketch-face.css):
  // they are shown again from before the face is read until it is drawn.
  let measured: Element[] = [];
  const unmeasure = () => {
    for (const live of measured) live.removeAttribute(MEASURE_ATTR);
  };
  return {
    prepare: () => {
      // The face is held still (no transitions, face-finish.css) for the whole take: a border fading back in from the
      // mark the clear just removed would read as no line at all, and the part would go undrawn.
      root.setAttribute(TAKING_ATTR, '');
      clearMarkerFace(root);
      measured = [...root.querySelectorAll('[data-sketch-words]')];
      for (const live of measured) live.setAttribute(MEASURE_ATTR, '');
    },
    read: () => {
      let writes: Write[];
      let drawn: number;
      try {
        let unseen: readonly Element[];
        ({ writes, drawn, unseen } = readParts(root, elementId, pen, page, board));
        onUnseen?.(unseen);
      } catch (error) {
        unmeasure();
        root.removeAttribute(TAKING_ATTR);
        throw error;
      }
      return () => {
        const marked: Element[] = [];
        try {
          for (const write of writes) {
            const m = write();
            if (m) marked.push(...(isMarkList(m) ? m : [m]));
          }
        } catch (error) {
          root.removeAttribute(TAKING_ATTR);
          throw error;
        } finally {
          unmeasure();
        }
        onDrawn?.(drawn);
        // The marks take effect while transitions are still held, or each part's own line would ease out from where
        // the clear left it instead of going at once. Read once every face is written: one style pass for them all.
        return () => {
          try {
            for (const el of marked) void getComputedStyle(el).color;
          } finally {
            root.removeAttribute(TAKING_ATTR);
          }
        };
      };
    },
  };
}

// Every part under `root` the pen draws, read without writing: the writes that draw them, in order, how many, and the
// parts the board's `unseen` left unread.
function readParts(
  root: HTMLElement,
  elementId: string,
  pen: Pen,
  page: boolean,
  board: FaceFinishBoard | undefined,
): { writes: Write[]; drawn: number; unseen: readonly Element[] } {
  const face = { width: root.offsetWidth, height: root.offsetHeight };
  const seed = markerFaceSeed(elementId);
  const unseen: Element[] = [];
  const isUnseen = board?.unseen;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT, {
    acceptNode: (n) => {
      if ((n as Element).matches(SKIP)) return NodeFilter.FILTER_REJECT;
      if (!isUnseen?.(n as Element)) return NodeFilter.FILTER_ACCEPT;
      unseen.push(n as Element);
      return NodeFilter.FILTER_REJECT;
    },
  });
  const parts: Element[] = [root];
  for (let n = walker.nextNode(); n; n = walker.nextNode()) parts.push(n as Element);
  const writes: Write[] = [];
  let drawn = pen === 'marker' ? gridRules(root, face, seed, 0, writes) : 0;
  // A board counts its frames apart from its shapes and lines (the grid's rules among them).
  const budget: MarkerFaceBudget | undefined = board
    ? { ...markerFaceBudget(), parts: drawn }
    : undefined;
  const spent = () => (budget ? faceBudgetSpent(budget) : drawn >= MARKER_FACE_MAX_PARTS);
  // The face's own box is coloured in once: the outermost element that paints it (a wrapper and a card inside it the
  // same size would streak twice).
  // An element with a hand-drawn body (SketchOverlay) has its box drawn and shaded already.
  let ownBoxDrawn = page || !!root.querySelector(':scope > svg[data-finish]');
  const ownerOf = board?.ownerOf;
  // How many parts each owner has drawn so far this take (FaceFinishBoard's ownerOf).
  const owned = new Map<string, number>();
  for (const el of parts) {
    if (spent()) break;
    const faceBox =
      !ownBoxDrawn && el instanceof HTMLElement && (el === root || isFaceBox(el, face));
    const owner = ownerOf?.(root, el);
    const count = owner === undefined ? 0 : (owned.get(owner) ?? 0);
    const index = owner === undefined ? drawn : ownerBase(owner) + count;
    const ink =
      el instanceof HTMLElement
        ? frameInk(el, face, seed, index, faceBox || el.hasAttribute(SHAPE_ATTR), pen, budget)
        : isSvgShape(el)
          ? shapeInk(el, face, seed, index, pen, budget)
          : null;
    if (ink) {
      drawn += 1;
      writes.push(ink.write);
      if (budget) spendFaceBudget(budget, ink.part.role);
      if (owner !== undefined) owned.set(owner, count + 1);
    }
    if (ink?.part.role === 'shape' && faceBox) ownBoxDrawn = true;
  }
  return { writes, drawn, unseen };
}

// A 32-bit FNV-1a of an owner's key, spread so owners' part indices never meet ('' is no owner: 0).
function ownerBase(key: string): number {
  if (!key) return 0;
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 0x01000193);
  return (h >>> 0) & 0x7fff0000;
}
