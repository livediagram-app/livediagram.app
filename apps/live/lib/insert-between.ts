import { isBoxed, type Element, type ElementId } from '@livediagram/diagram';

// Inserting a note BETWEEN two notes (spec/139). An event-storming wall is a
// left-to-right timeline, so "this happened before that" is the whole
// information content of the x axis and adding a step in the middle is the
// most common edit in a session. This module is the geometry behind it: which
// gap the cursor is offering to fill, how far the board has to open to make
// room, and what the board looks like once it has.
//
// Pure and React-free, so the three surfaces that must agree can share it:
// the live preview (a render-time transform), the ghost + marker (where the
// note will land), and the drop (what actually gets committed).

// The insertion point is the RIGHT-hand note's left edge: the incoming note
// takes that note's place and everything from there on slides along, so every
// gap the author already arranged survives untouched and the new note gets
// the row's prevailing gap on its right.
export type InsertionSlot = {
  // Canvas x of the incoming note's left edge.
  atX: number;
  // Canvas y of the incoming note's centre — it lines up with the note it
  // displaces rather than with the cursor's wobble.
  atY: number;
  // How far the board opens: the incoming note plus the row's prevailing gap.
  shiftDx: number;
  // Everything that travels the full `shiftDx` AS A WHOLE. The preview can
  // only translate whole elements (it is a CSS transform), so this set is
  // exactly what the preview shows moving; `applyInsertionShift` adds the one
  // thing a transform cannot express — a free arrow that straddles the point
  // and therefore stretches.
  shiftedIds: ElementId[];
  // The notes either side of the gap (either end of the row leaves one null
  // in a future leading/trailing insert; today both are always present).
  leftId: ElementId | null;
  rightId: ElementId | null;
  // Vertical extent of the insertion marker: the board's own span, because
  // the whole board splits here, not just the hovered row.
  spanTop: number;
  spanBottom: number;
};

// May this session be offered an insertion at all? Only on an event-storming
// board, and only where the drop would actually be allowed to land: a preview
// that opens a slot a read-only viewer, a locked tab or a blocked active layer
// would then refuse is a promise the editor can't keep.
export function canInsertBetweenOn(state: {
  esBoard: boolean;
  readOnly: boolean;
  tabLocked: boolean;
  // The whole creation gate (spec/74): includes a hidden or locked active
  // layer, which blocks creation without locking anything else.
  createBlocked: boolean;
}): boolean {
  return state.esBoard && !state.readOnly && !state.tabLocked && !state.createBlocked;
}

type FindArgs = {
  // Cursor in canvas coords.
  cursorX: number;
  cursorY: number;
  // Footprint of the note being dragged in (canvas units).
  incomingWidth: number;
  elements: Element[];
  // Elements on a hidden or locked layer (spec/74). They cannot define the
  // row — you can't aim at a note you can't see — but they still SHIFT, so
  // the board stays consistent the moment their layer comes back.
  inertIds?: ReadonlySet<ElementId>;
  // The slot currently on offer, if any. Passed back in so the offer sticks
  // through a shaky hand (see SLOT_HYSTERESIS).
  active?: InsertionSlot | null;
};

// The event-storming template's own gap, used when the row has no gap worth
// measuring (its notes overlap or sit flush).
export const DEFAULT_INSERTION_GAP = 72;

// How far above / below a note the cursor still counts as "in this row",
// as a fraction of the note's height.
const ROW_TOLERANCE_RATIO = 0.5;

// How far outside its gap the cursor may stray before an open slot closes.
// Without it the preview flickers on and off at the boundary as the hand
// shakes — the whole board twitching sideways at 60Hz.
const SLOT_HYSTERESIS = 32;

// The vertical padding on the insertion marker, so it reads as a line THROUGH
// the board rather than one that stops at the outermost note.
const MARKER_PADDING = 40;

function rowContains(el: Element & { y: number; height: number }, cursorY: number): boolean {
  const slack = el.height * ROW_TOLERANCE_RATIO;
  return cursorY >= el.y - slack && cursorY <= el.y + el.height + slack;
}

// Elements a ripple may move. A locked element is one the author pinned in
// place on purpose, so the board opens AROUND it.
function movable(el: Element): boolean {
  return el.locked !== true;
}

// The x that decides whether an element is "at or after" the insertion point.
// Boxed elements answer with their left edge; a group answers with the centre
// of its union bounds, so a group straddling the point travels whole instead
// of being torn in half.
function groupBounds(elements: Element[]): Map<string, { minX: number; maxX: number }> {
  const bounds = new Map<string, { minX: number; maxX: number }>();
  for (const el of elements) {
    if (!isBoxed(el) || !el.groupId) continue;
    const seen = bounds.get(el.groupId);
    const minX = Math.min(seen?.minX ?? Infinity, el.x);
    const maxX = Math.max(seen?.maxX ?? -Infinity, el.x + el.width);
    bounds.set(el.groupId, { minX, maxX });
  }
  return bounds;
}

// Does this arrow travel whole? Its free ends must all be at or after the
// point, and any element it is pinned to must be travelling too — otherwise
// one end is anchored to something that isn't moving and the arrow stretches
// instead (which a transform can't preview; see applyInsertionShift).
function arrowTravelsWhole(el: Element, atX: number, movingIds: Set<ElementId>): boolean {
  if (el.type !== 'arrow') return false;
  let anchored = false;
  for (const end of [el.from, el.to]) {
    if (end.kind === 'free') {
      if (end.x < atX) return false;
      anchored = true;
    } else if (end.kind === 'pinned') {
      if (!movingIds.has(end.elementId)) return false;
      anchored = true;
    } else {
      // on-arrow / pinned-group resolve from other elements, which either
      // move or don't; leave those arrows to follow rather than guess.
      return false;
    }
  }
  return anchored;
}

function medianGap(sorted: { x: number; width: number }[]): number {
  const gaps: number[] = [];
  sorted.forEach((el, i) => {
    const prev = sorted[i - 1];
    if (!prev) return;
    const gap = el.x - (prev.x + prev.width);
    if (gap > 0) gaps.push(gap);
  });
  gaps.sort((a, b) => a - b);
  return gaps[Math.floor((gaps.length - 1) / 2)] ?? DEFAULT_INSERTION_GAP;
}

// Is the cursor still inside the slot it opened (plus the hysteresis margin)?
function stillInside(slot: InsertionSlot, cursorX: number, cursorY: number, elements: Element[]) {
  const left = elements.find((el) => el.id === slot.leftId);
  const right = elements.find((el) => el.id === slot.rightId);
  if (!left || !right || !isBoxed(left) || !isBoxed(right)) return false;
  const withinX =
    cursorX >= left.x + left.width - SLOT_HYSTERESIS && cursorX <= right.x + SLOT_HYSTERESIS;
  const withinY = rowContains(right, cursorY) || rowContains(left, cursorY);
  return withinX && withinY;
}

export function findInsertionSlot({
  cursorX,
  cursorY,
  incomingWidth,
  elements,
  inertIds,
  active,
}: FindArgs): InsertionSlot | null {
  if (active && stillInside(active, cursorX, cursorY, elements)) return active;

  // Row candidates: what the author can actually see and aim at.
  const row = elements
    .filter(isBoxed)
    .filter((el) => movable(el) && !inertIds?.has(el.id) && rowContains(el, cursorY))
    .sort((a, b) => a.x - b.x);
  if (row.length < 2) return null;

  // The adjacent pair whose gap holds the cursor. Over a note, or off either
  // end of the row, there is no offer to make — leading / trailing insertion
  // has no "between" to speak of, you can just drop there.
  const pair = row
    .map((el, i) => ({ left: row[i - 1], right: el }))
    .find(({ left, right }) => !!left && cursorX >= left.x + left.width && cursorX <= right.x);
  const left = pair?.left;
  const right = pair?.right;
  if (!left || !right) return null;

  const atX = right.x;
  const shiftDx = incomingWidth + medianGap(row);

  const groups = groupBounds(elements);
  const movingIds = new Set<ElementId>();
  for (const el of elements) {
    if (!movable(el) || !isBoxed(el)) continue;
    const group = el.groupId ? groups.get(el.groupId) : undefined;
    const anchorX = group ? (group.minX + group.maxX) / 2 : el.x;
    if (anchorX >= atX) movingIds.add(el.id);
  }
  // Arrows resolve after the boxes, because a pinned arrow travels exactly
  // when the elements it connects do.
  for (const el of elements) {
    if (movable(el) && arrowTravelsWhole(el, atX, movingIds)) movingIds.add(el.id);
  }

  let spanTop = Infinity;
  let spanBottom = -Infinity;
  for (const el of elements) {
    if (!isBoxed(el)) continue;
    spanTop = Math.min(spanTop, el.y);
    spanBottom = Math.max(spanBottom, el.y + el.height);
  }
  if (spanTop === Infinity) {
    spanTop = right.y;
    spanBottom = right.y + right.height;
  }

  return {
    atX,
    atY: right.y + right.height / 2,
    shiftDx,
    shiftedIds: [...movingIds],
    leftId: left.id,
    rightId: right.id,
    spanTop: spanTop - MARKER_PADDING,
    spanBottom: spanBottom + MARKER_PADDING,
  };
}

// Where the incoming note's CENTRE lands — what the ghost draws at and what
// the drop commits, so the preview cannot lie about the result.
export function insertionGhostCentre(
  slot: InsertionSlot,
  incomingWidth: number,
): { x: number; y: number } {
  return { x: slot.atX + incomingWidth / 2, y: slot.atY };
}

// The board the DROP commits: the ripple, then the new note in the slot the
// ripple opened. One value, so the whole insertion lands in one history entry
// — a single Undo puts the board back exactly as it was.
export function insertElementAt<T extends Element>(
  elements: Element[],
  slot: InsertionSlot,
  element: T,
): Element[] {
  return [...applyInsertionShift(elements, slot), element];
}

// The board with the slot opened for real. The oracle for the preview, and
// the thing the drop actually commits.
export function applyInsertionShift(elements: Element[], slot: InsertionSlot): Element[] {
  const moving = new Set(slot.shiftedIds);
  const dx = slot.shiftDx;
  if (moving.size === 0 || dx === 0) return elements;
  let changed = false;
  const next = elements.map((el) => {
    if (!movable(el)) return el;
    if (isBoxed(el)) {
      if (!moving.has(el.id)) return el;
      changed = true;
      return { ...el, x: el.x + dx };
    }
    if (el.type !== 'arrow') return el;
    // Free ends at or after the point move; ends before it stay. A whole
    // arrow therefore translates, and one that straddles the point stretches
    // — both its endpoints keep the note they were drawn between.
    const shiftEnd = <T extends typeof el.from>(end: T): T =>
      end.kind === 'free' && end.x >= slot.atX ? { ...end, x: end.x + dx } : end;
    const from = shiftEnd(el.from);
    const to = shiftEnd(el.to);
    if (from === el.from && to === el.to) return el;
    changed = true;
    return { ...el, from, to };
  });
  return changed ? next : elements;
}
