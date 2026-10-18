// Bring Focus (docs/specs/012-collaboration/bring-focus.md): the one rule for "is this view already looking at
// that?", and what the presser is told.
//
// It is asked from both ends. The RECIPIENT asks it of their own view, to
// decide whether an invitation is worth a dialog. The PRESSER asks it of every
// peer's published viewport (docs/specs/012-collaboration/follow-me-viewport.md), to decide what their own toast should
// say. Same question, so one answer: a second copy of this arithmetic would
// drift, and the two ends would disagree about who was asked.

import {
  hasPageLook,
  pagesOf,
  layOutPages,
  opensInOf,
  type LaidOutPage,
  type PageRect,
  type Tab,
} from '@livediagram/document';
import type { RemoteViewport } from '@/hooks/collab/useFollowMe';

/** A view as either end can describe it: a canvas size, a pan, and a zoom. */
type FocusView = {
  size: { width: number; height: number };
  pan: { x: number; y: number };
  zoom: number;
};

// Zoom is not part of the question: taking an invitation keeps your own zoom,
// so somebody at any zoom with the point in the middle is already there.
// Within a tenth of the viewport of the point, measured on screen: a
// tenth of a canvas at 10% zoom is not a difference anybody can see.
const CENTRE_SLACK = 0.1;

/** The page a press on a Pages tab points at (docs/specs/012-collaboration/bring-focus.md "On a
 *  page"): the one the point sits on, while the tab is in a mode that shows pages. Null anywhere else,
 *  including the surround between pages, where taking it centres the point as on any canvas. */
export function focusPageAt(
  tab: Tab | undefined,
  at: { x: number; y: number },
): LaidOutPage | null {
  if (!tab || !hasPageLook(opensInOf(tab))) return null;
  return (
    layOutPages(pagesOf(tab)).find(
      ({ rect }) =>
        at.x >= rect.x &&
        at.x <= rect.x + rect.width &&
        at.y >= rect.y &&
        at.y <= rect.y + rect.height,
    ) ?? null
  );
}

// A framed page fits the view with padding, so a hair over is still framed (rounding, a scrollbar).
const PAGE_FIT_SLACK = 1.01;

/** Is that page already framed in this view: the middle of the view on it, and all of it on screen?
 *  Zoom is part of it here, unlike a bare point, because taking it fits the page: somebody zoomed
 *  into one corner of it is not yet looking at the page. */
function viewFramesPage(view: FocusView, page: PageRect) {
  const midX = view.size.width / 2 - view.pan.x;
  const midY = view.size.height / 2 - view.pan.y;
  const onIt =
    midX >= page.x && midX <= page.x + page.width && midY >= page.y && midY <= page.y + page.height;
  return (
    onIt &&
    page.width * view.zoom <= view.size.width * PAGE_FIT_SLACK &&
    page.height * view.zoom <= view.size.height * PAGE_FIT_SLACK
  );
}

/** Is that canvas point already at the middle of this view? With the page it is on (a Pages
 *  tab), is that page framed instead, since that is where taking it lands. */
export function viewIsCentredOn(
  view: FocusView,
  at: { x: number; y: number },
  page?: PageRect | null,
) {
  if (view.size.width <= 0 || view.size.height <= 0) return false;
  if (page) return viewFramesPage(view, page);
  // The pan is in CANVAS units (the zoom is applied separately, about the
  // viewport's own centre), so the point in the middle of the view is
  // size/2 - pan. Scaling the difference converts "how far off" into the
  // screen distance the viewer would actually see it move.
  const dx = Math.abs(view.size.width / 2 - view.pan.x - at.x) * view.zoom;
  const dy = Math.abs(view.size.height / 2 - view.pan.y - at.y) * view.zoom;
  const slack = Math.min(view.size.width, view.size.height) * CENTRE_SLACK;
  return dx <= slack && dy <= slack;
}

/** What a press did, from the presser's side. */
type FocusPressOutcome = 'alone' | 'already-there' | 'asked';

export const FOCUS_PRESS_MESSAGE: Record<FocusPressOutcome, string> = {
  alone: 'Nobody else is on this canvas right now',
  // Pressing twice is normal (to catch a latecomer, or because half the room
  // said no), and the people who came are deliberately not asked again. Saying
  // "nobody is here" to a presser looking at a row of avatars reads as the
  // feature being broken, which is how this message came to exist.
  'already-there': 'Everyone else is already looking at it',
  asked: 'Asked everyone else to look here',
};

export function focusPressOutcome({
  sent,
  peerIds,
  viewports,
  tabId,
  at,
  page,
}: {
  /** Whether the op actually went out (no room, no publish). */
  sent: boolean;
  /** The other people in the room, self excluded, as presence reports them. */
  peerIds: string[];
  /** Their last published viewport, by presence id. Missing = unknown. */
  viewports: Map<string, RemoteViewport>;
  tabId: string;
  at: { x: number; y: number };
  /** The page the point is on, on a Pages tab (focusPageAt): judged as framed, not centred. */
  page?: PageRect | null;
}): FocusPressOutcome {
  if (!sent || peerIds.length === 0) return 'alone';
  const everyoneIsHere = peerIds.every((id) => {
    const view = viewports.get(id);
    // Somebody we have never heard from might be anywhere, so they count as
    // asked rather than as already there.
    if (!view || view.tabId !== tabId) return false;
    // Judged on THEIR canvas, as their own receiver judges it: with zoom no
    // longer compared, our size would call a point centred for a wider screen
    // that their dialog still asks about. No size is unknown, so asked.
    if (!view.size) return false;
    return viewIsCentredOn({ size: view.size, pan: view.pan, zoom: view.zoom }, at, page);
  });
  return everyoneIsHere ? 'already-there' : 'asked';
}
