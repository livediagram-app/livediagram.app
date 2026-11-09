import type { Element, ShapeElement, Tab } from '@livediagram/document';
import type { UserPreferences } from '@/lib/user-preferences';
import type { WhiteboardTool } from '@/lib/whiteboard-tool';
import type { WhiteboardShapeKey } from '@/lib/whiteboard-shape-catalogue';
import type { WhiteboardPen, WhiteboardPenId, WhiteboardPrefs } from '@/lib/whiteboard-prefs';

// A Watch It Built topic (docs/specs/007-editor/watch-it-built.md "The curriculum"): a short replay of a few chapters.
// Pure: for any moment in a chapter it says what the demo looks like, what of the real chrome is open, and where
// Example is heading, so pausing, a chapter press and reduced motion's Next are only a different moment. The player
// (components/tour/WatchItBuiltPlayer.tsx) draws it.

export type ReplayMode = 'diagram' | 'draw' | 'workshop';

export type Chapter = {
  // Unique across every topic: the dashboard reads it as `TourStep<Id>` (computed-emitters.ts TOUR_STEP_SOURCE).
  readonly id: string;
  readonly name: string;
  // Shortened for a phone's player.
  readonly shortName: string;
  readonly ms: number;
  readonly say: string;
  readonly sayTouch: string;
};

export type Point = { readonly x: number; readonly y: number };

/** What a topic builds its layout from: the view's centre and size in canvas units, and the tab's look. */
export type TopicEnv = {
  readonly centre: Point;
  readonly size: { readonly width: number; readonly height: number };
  readonly tab: Tab;
  // The view's zoom (screen px per canvas unit), so a demo can keep a screen distance from chrome drawn over the canvas
  // (the player moved to the top). 1 when not given.
  readonly zoom?: number;
};

/** Where Example points, as something the player finds on screen. */
export type CursorTarget =
  // A tour anchor (`data-tour-id`), its centre.
  | { readonly kind: 'tour'; readonly id: string }
  // The first match of a selector, by its words when given (exact words first, then words it ends with).
  | { readonly kind: 'find'; readonly selector: string; readonly text?: string }
  | { readonly kind: 'element'; readonly id: string; readonly at?: 'centre' | 'bottom' | 'top' }
  // A row or tile in the element menu or its flyout, by the words on it.
  | { readonly kind: 'menu'; readonly name: string }
  // A point on the canvas.
  | { readonly kind: 'canvas'; readonly x: number; readonly y: number };

export type Waypoint = {
  // When Example arrives here, in ms into the chapter.
  readonly at: number;
  readonly to: CursorTarget;
  // A press shows a small ring under Example as it arrives.
  readonly press?: boolean;
};

/**
 * Draw's dock as it shows at a moment (watch-it-built.md "The curriculum", Draw): the tool in hand, the shape armed,
 * a marker's colour and width and the other tool settings, drawn over the person's own on the dock only
 * (lib/replay/replay-dock.ts), never picked or stored.
 */
export type ReplayDock = {
  readonly tool?: WhiteboardTool;
  readonly armedShape?: WhiteboardShapeKey | null;
  readonly prefs?: Partial<Omit<WhiteboardPrefs, 'pens'>>;
  readonly pens?: Partial<
    Record<WhiteboardPenId, Partial<Pick<WhiteboardPen, 'colour' | 'width'>>>
  >;
};

export type Frame = {
  readonly elements: readonly Element[];
  readonly selectedId: string | null;
  // Whether a caret shows at the end of the selected shape's label (typing).
  readonly typing?: boolean;
  // The real chrome that is open at this moment, by the player's openable ids (replay-dom.ts OPENABLES). Anything the
  // replay opened that is not listed is closed again.
  readonly open?: readonly string[];
  // The element menu, held open on a demo element, opened through these rows (by their words) in order.
  readonly menu?: { readonly on: string; readonly path: readonly string[] } | null;
  // A field typed into: the player sets the input found by `selector` to `text` (a search box's query).
  readonly typed?: { readonly selector: string; readonly text: string } | null;
  // How the tab looks at this moment (Look and Feel), drawn in for the canvas and its dialog only.
  readonly tab?: Partial<Tab>;
  // The person's preferences as the canvas sees them (Draw's board background), likewise.
  readonly prefs?: Partial<UserPreferences>;
  // Where the player sits: low over the canvas (the default), or at its top while a dialog fills the bottom.
  readonly player?: 'top';
  // Draw's dock as it shows (the marker in hand, its colour), likewise.
  readonly dock?: ReplayDock;
  // Example is holding something here (a carried shape, a pen drawing): the cursor sits on this canvas point, pressed.
  readonly hold?: Point | null;
};

/** What a topic's `measure` may ask of the screen. */
export type ScreenProbe = {
  // Where a target is on screen, or null while it is not there.
  find(target: CursorTarget): Point | null;
  // A screen point on the canvas.
  toCanvas(p: Point): Point;
};

// The replay itself; its name, line and mode are its card's (lib/replay/curriculum.ts).
export type Topic<L = unknown> = {
  readonly id: string;
  readonly chapters: readonly Chapter[];
  layout(env: TopicEnv): L;
  frame(index: number, ms: number, layout: L): Frame;
  plan(index: number, layout: L): readonly Waypoint[];
  // Live measures a topic needs from the screen as it plays (where the palette's first tile is), returning a new layout
  // when it learned something, else null.
  measure?(layout: L, index: number, ms: number, screen: ScreenProbe): L | null;
};

/** A topic's whole length, in ms. */
export const topicMs = (topic: Pick<Topic, 'chapters'>) =>
  topic.chapters.reduce((sum, c) => sum + c.ms, 0);

/** The chapter at `index`, clamped, by id. */
export const chapterId = (topic: Pick<Topic, 'chapters'>, index: number) =>
  topic.chapters[Math.max(0, Math.min(index, topic.chapters.length - 1))]!.id;

// Shared motion: an eased 0..1 between two beats, and a straight blend.
export const ease = (p: number) => (p < 0.5 ? 4 * p * p * p : 1 - (-2 * p + 2) ** 3 / 2);
export const between = (ms: number, from: number, to: number) =>
  ms <= from ? 0 : ms >= to ? 1 : ease((ms - from) / (to - from));
export const lerp = (a: number, b: number, p: number) => a + (b - a) * p;

/** A frame with nothing selected, open or held, for a topic's `frame` to fill in. */
export const frameOf = (elements: readonly Element[], rest: Partial<Frame> = {}): Frame => ({
  elements,
  selectedId: null,
  ...rest,
});

/** A shape's centre on the canvas. */
export const centreOf = (el: Pick<ShapeElement, 'x' | 'y' | 'width' | 'height'>): Point => ({
  x: el.x + el.width / 2,
  y: el.y + el.height / 2,
});

/** Typed out letter by letter between two beats. */
export const typedAt = (text: string, ms: number, from: number, to: number) => {
  const p = (ms - from) / (to - from);
  return text.slice(0, Math.max(0, Math.min(text.length, Math.ceil(p * text.length))));
};
