// Bring Focus (spec/144): the one rule for "is this view already looking at
// that?", and what the presser is told.
//
// It is asked from both ends. The RECIPIENT asks it of their own view, to
// decide whether an invitation is worth a dialog. The PRESSER asks it of every
// peer's published viewport (spec/131), to decide what their own toast should
// say. Same question, so one answer: a second copy of this arithmetic would
// drift, and the two ends would disagree about who was asked.

/** A view as either end can describe it: a canvas size, a pan, and a zoom. */
export type FocusView = {
  size: { width: number; height: number };
  pan: { x: number; y: number };
  zoom: number;
};

// Within a twentieth of the zoom: close enough to be seeing the same amount of
// board, loose enough to survive a nudge of the slider.
const ZOOM_TOLERANCE = 0.05;
// And within a tenth of the viewport of the point, measured on screen: a
// tenth of a board at 10% zoom is not a difference anybody can see.
const CENTRE_SLACK = 0.1;

/** Is that canvas point already at the middle of this view, at about that zoom? */
export function viewIsCentredOn(view: FocusView, at: { x: number; y: number }, zoom: number) {
  if (view.size.width <= 0 || view.size.height <= 0) return false;
  if (Math.abs(view.zoom - zoom) > zoom * ZOOM_TOLERANCE) return false;
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
export type FocusPressOutcome = 'alone' | 'already-there' | 'asked';

export const FOCUS_PRESS_MESSAGE: Record<FocusPressOutcome, string> = {
  alone: 'Nobody else is on this board right now',
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
  size,
  tabId,
  at,
  zoom,
}: {
  /** Whether the op actually went out (no room, no publish). */
  sent: boolean;
  /** The other people in the room, self excluded, as presence reports them. */
  peerIds: string[];
  /** Their last published viewport, by presence id. Missing = unknown. */
  viewports: Map<string, { tabId: string; pan: { x: number; y: number }; zoom: number }>;
  /** OUR canvas size, used as a stand-in for theirs: the viewport op carries
   *  no size, and this only picks which sentence to show. Erring towards
   *  "asked" is the harmless direction. */
  size: { width: number; height: number };
  tabId: string;
  at: { x: number; y: number };
  zoom: number;
}): FocusPressOutcome {
  if (!sent || peerIds.length === 0) return 'alone';
  const everyoneIsHere = peerIds.every((id) => {
    const view = viewports.get(id);
    // Somebody we have never heard from might be anywhere, so they count as
    // asked rather than as already there.
    if (!view || view.tabId !== tabId) return false;
    return viewIsCentredOn({ size, pan: view.pan, zoom: view.zoom }, at, zoom);
  });
  return everyoneIsHere ? 'already-there' : 'asked';
}
