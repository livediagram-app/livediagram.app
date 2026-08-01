// How a shape of kind K is born: the per-kind default size table, and the
// factory that turns a kind into a ShapeElement with that kind's own starting
// content. Lifted out of ./factories, which had reached 719 lines holding this
// alongside the factories for every OTHER element type; those stayed behind.
//
// Runtime constants come from the LEAF modules ('./data-shapes',
// './selection-mode', './collab-shapes'), NOT from './index':
// SHAPE_DEFAULT_SIZE reads RAIL_* at module-init time, and a runtime read
// through the index cycle TDZ-crashes plain-Node ESM consumers. Only TYPES
// come from './index', and those are erased at build.
import {
  DEFAULT_BUTTON_MODE,
  DEFAULT_PICKER_SOURCE,
  DEFAULT_SESSION_TOOL,
  DEFAULT_TIMER_MINUTES,
  MODE_BUTTON_SKIN,
} from './selection-mode';
import {
  CHECKLIST_DEFAULT_ITEMS,
  LINE_DEFAULT_CATEGORIES,
  LINE_DEFAULT_SERIES,
  PIE_DEFAULT_SLICES,
  RAIL_DEFAULT_POINTS,
  RAIL_POINT_STEP_PX,
  RATING_DEFAULT,
  REACTION_DEFAULT,
} from './data-shapes';
import {
  AGENDA_DEFAULT_MINUTES,
  DEFAULT_CHAIR_FACING,
  DEFAULT_DECISION_STATUS,
  DEFAULT_ESTIMATE_SCALE,
} from './collab-shapes';
import type { ShapeElement, ShapeKind } from './index';

// --- Factories -------------------------------------------------------------

// Default size per shape kind. Uniform 120 for square / circle / diamond,
// natural aspect ratios for the flowchart-vocabulary shapes (cylinder
// taller than wide, parallelogram + hexagon + document wider than tall).
// Exported so the editor can offer "reset to default aspect ratio" — the
// width:height proportion here is each shape's canonical look.
export const SHAPE_DEFAULT_SIZE: Record<ShapeKind, { width: number; height: number }> = {
  square: { width: 120, height: 120 },
  circle: { width: 120, height: 120 },
  diamond: { width: 120, height: 120 },
  cylinder: { width: 100, height: 140 },
  parallelogram: { width: 160, height: 100 },
  hexagon: { width: 140, height: 120 },
  document: { width: 140, height: 110 },
  // Document (spec/100): 420x594 is the A-series root-2 ratio, at a size that
  // reads as a page beside a 120px square without swallowing the canvas.
  page: { width: 420, height: 594 },
  // Mind node (spec/118): a caption-width pill. Wide enough for a phrase,
  // short enough that a column of siblings stays readable.
  'mind-node': { width: 170, height: 48 },
  // Lane (spec/119): a band, not a box — wide enough to lay a flow across and
  // tall enough for a row of steps.
  lane: { width: 900, height: 200 },
  // Reaction pad: a press-me square, sized like the other Behaviour buttons.
  'reaction-pad': { width: 150, height: 110 },
  // Record (spec/120): a class box — wide enough for "name: Type" rows,
  // tall enough for a title plus four of them before it needs resizing.
  entity: { width: 240, height: 170 },
  // Stadium / pill — the conventional flowchart "Start / End" terminator
  // shape. Wider than tall by default; the CSS `border-radius: 9999px`
  // render path means the ends stay perfectly semicircular at any
  // aspect ratio the user resizes to.
  stadium: { width: 160, height: 64 },
  // Actor (UML stickman): line-art figure with its label below. Taller
  // than wide and aspect-locked on create so the figure never distorts.
  // Default size hugs the figure tightly — earlier 90×150 left a 38-
  // unit band below the legs which read as wasted padding under bare
  // (unlabelled) stickmen. 90×130 keeps room for a short label
  // (y 112..130) without dominating the box.
  actor: { width: 90, height: 130 },
  // Cloud: a container shape (networking / architecture). Stretches to
  // fit its label like the other flowchart shapes.
  cloud: { width: 180, height: 140 },
  triangle: { width: 130, height: 120 },
  trapezoid: { width: 160, height: 110 },
  star: { width: 130, height: 130 },
  // Speech bubble: wider than tall, with room for the tail beneath the body.
  'speech-bubble': { width: 180, height: 130 },
  // Frame / section: a large container drawn around content, so it starts
  // big. Transparent body (see shape-svg-overlay) with a top-left label.
  frame: { width: 360, height: 260 },
  // UI device frames. Sized to evoke each device's natural aspect
  // ratio at a glance: browser + monitor land on a 4:3-ish landscape
  // (with the monitor a touch taller to leave room for its stand);
  // laptop is wider with a flatter total profile (screen + keyboard
  // base stacked); phone + tablet are portrait at typical phone /
  // tablet ratios.
  browser: { width: 240, height: 160 },
  monitor: { width: 220, height: 170 },
  laptop: { width: 240, height: 150 },
  phone: { width: 90, height: 170 },
  tablet: { width: 140, height: 180 },
  // Smartwatch: a square-ish face with bands above + below, so portrait.
  smartwatch: { width: 110, height: 150 },
  // Curated glyph. Square + aspect-locked on create (set in createShape) so
  // the line art never distorts; the label sits below. Sized generously so a
  // two-line caption (e.g. "Durable Objects") clears the glyph rather than
  // crowding it.
  icon: { width: 120, height: 120 },
  // A sticker's default is square, which is right for the emoji half; the
  // creation path widens it for a word badge off STICKER_ASPECT, since the
  // default table is per-kind and a badge and an emoji are one kind.
  sticker: { width: 104, height: 104 },
  // Progress bar: a wide, short pill. Progress ring: a square donut
  // (aspect-locked on create so it stays circular).
  'progress-bar': { width: 220, height: 44 },
  'progress-ring': { width: 130, height: 130 },
  // Timeline rail: width carries the default points at RAIL_POINT_STEP_PX
  // spacing; height leaves room for the dots + ticks above the line.
  'timeline-rail': { width: RAIL_DEFAULT_POINTS * RAIL_POINT_STEP_PX, height: 96 },
  // Rating: a row of five stars.
  rating: { width: 200, height: 44 },
  // Charts default their legend BELOW the plot (spec/53), so the starting box
  // is squarer than it was when the legend took a side strip: the width goes to
  // the plot and the extra height carries the legend band.
  'pie-chart': { width: 260, height: 220 },
  'bar-chart': { width: 260, height: 220 },
  // Line chart: a touch wider for the x-axis labels.
  'line-chart': { width: 300, height: 240 },
  // Code block: room for a dozen-ish monospace lines (spec/82).
  'code-block': { width: 320, height: 180 },
  // Checklist: a card of starter rows (spec/83).
  checklist: { width: 240, height: 180 },
  // Mode button (spec/103): a square-ish tile, sized for an icon ABOVE its
  // label — the shape a toolbar button has, rather than a wide pill that read
  // as just another labelled box.
  'mode-button': { width: 104, height: 96 },
  // Portal (spec/104): portal-shaped — taller than it is wide, like a portal.
  portal: { width: 72, height: 112 },
  // Session button (spec/105): the Selection Mode button's tile, so a row of
  // Behaviour controls lines up.
  'session-button': { width: 104, height: 96 },
  // Reveal zone (spec/106): a cover, so it arrives big enough to actually
  // cover something — a column of notes rather than one sticky.
  reveal: { width: 320, height: 220 },
  // Picker (spec/107): a card wide enough for a name at a readable size.
  picker: { width: 220, height: 132 },
  // Chair (spec/130): furniture at human scale beside a 40px-wide Avatar-mode
  // character — a seat the sprite fits into rather than a throne it rattles
  // around in.
  chair: { width: 76, height: 84 },
  // Estimate card (spec/123): the eight fibonacci chips wrap to two rows, and
  // the card has to hold them PLUS the answered avatars PLUS the two footer
  // buttons without clipping — a card that arrives already cut off is the
  // first thing anybody sees.
  estimate: { width: 360, height: 310 },
  // Temperature check (spec/124): five buttons over five bars, plus the
  // average. Narrower than the estimate card — five chips, not eight — but
  // tall enough for all three bands.
  temperature: { width: 300, height: 270 },
  // Idea box (spec/125): a box that holds a stack of cards, so it arrives
  // sized like a retro column rather than a sticky.
  'idea-box': { width: 320, height: 340 },
  // Agenda (spec/127): a run of six segments before it needs resizing.
  agenda: { width: 330, height: 300 },
  // Decision record (spec/128): a card for a sentence plus three drivers.
  decision: { width: 330, height: 220 },
  // Roll call (spec/129): two columns of names, six rows deep.
  'roll-call': { width: 300, height: 260 },
};

// New boxed elements default to Medium text size per spec 09 ("Text size").
export function createShape(kind: ShapeKind, x: number, y: number): ShapeElement {
  const { width, height } = SHAPE_DEFAULT_SIZE[kind];
  const base: ShapeElement = {
    id: crypto.randomUUID(),
    type: 'shape',
    shape: kind,
    x,
    y,
    width,
    height,
    textSize: 'md',
  };
  // Mode button (spec/103): looks like a button, so it arrives pill-shaped
  // with a call to action already written and pointed at Avatar mode — the
  // walkthrough case it exists for. The author retypes the label like any
  // other shape's, and picks a different mode from the element menu.
  if (kind === 'mode-button') {
    return {
      ...base,
      // NO default label: the face reads "Switch to <Mode>", derived from the
      // mode it carries, so re-pointing a button relabels it instead of leaving
      // yesterday's copy on it. An author who types their own label wins — it
      // is still a shape's label — but the useful default is the derived one.
      mode: DEFAULT_BUTTON_MODE,
      // A button has to look pressable BEFORE anyone styles it, and the
      // theme-derived shape fill made it read as one more labelled box on the
      // canvas. So it ships with a real UI button's colours: a light surface, a
      // hairline border, dark text, and a soft lift off the canvas (spec/86).
      // Deliberately NOT a saturated brand block — a solid slab of colour on
      // the canvas reads as a shape someone drew, not as a control, and it
      // fought every diagram's own palette. These are ELEMENT colours, so they
      // behave like any user-picked colour and are changeable from the menu;
      // deriveNewBoxedColours skips the kind for the same reason it skips a
      // page.
      fillColor: MODE_BUTTON_SKIN.fill,
      strokeColor: MODE_BUTTON_SKIN.stroke,
      textColor: MODE_BUTTON_SKIN.text,
      shadow: { offsetX: 0, offsetY: 2, blur: 6, opacity: 0.24 },
      borderRadius: 'lg',
      textSize: 'sm',
      textBold: true,
    };
  }
  // Portal (spec/104): ships unlinked (there is nothing to link to until a
  // second portal exists) with a label the author replaces. It paints its own
  // ring, so the box behind it is transparent, and `strokeColor` is the colour
  // of the energy rather than of a border — electric blue by default, the
  // colour everyone already reads as "portal", and recolourable like any other
  // element (an orange pair is the obvious second half).
  if (kind === 'portal') {
    return {
      ...base,
      // Deliberately UNLABELLED: an unnamed portal is named positionally
      // ("Portal 1", "Portal 2") wherever it's shown, so a diagram full of them
      // is navigable without anyone typing a name. A label the author types
      // wins over the number. See portalName in apps/live/lib/portals.ts.
      fillColor: 'transparent',
      strokeColor: '#38bdf8',
      textColor: '#ffffff',
      textSize: 'sm',
      textBold: true,
      // A portal has a natural shape: stretched wide it stops reading as one at
      // all (the panel and knob distort with the box). Locking the aspect keeps
      // drag-to-draw and every later resize portal-shaped; the user can still
      // unlock it from the menu like any other element.
      aspectLocked: true,
    };
  }
  // Session button (spec/105): same skin and rules as the Selection Mode
  // button — it IS one, pointed at a session tool instead of a mode — with a
  // default five-minute timer so a fresh one already does something.
  if (kind === 'session-button') {
    return {
      ...base,
      session: { tool: DEFAULT_SESSION_TOOL, minutes: DEFAULT_TIMER_MINUTES },
      fillColor: MODE_BUTTON_SKIN.fill,
      strokeColor: MODE_BUTTON_SKIN.stroke,
      textColor: MODE_BUTTON_SKIN.text,
      shadow: { offsetX: 0, offsetY: 2, blur: 6, opacity: 0.24 },
      borderRadius: 'lg',
      textSize: 'sm',
      textBold: true,
    };
  }
  // Reveal zone (spec/106): a frosted cover. It paints itself, so the element
  // box carries no fill of its own; the label names what is underneath and
  // sits at the top, out of the way of the middle where the hint goes.
  if (kind === 'reveal') {
    return {
      ...base,
      label: 'Hidden',
      fillColor: 'transparent',
      strokeColor: '#94a3b8',
      textColor: '#0f172a',
      borderRadius: 'lg',
      textAlignY: 'top',
      textBold: true,
    };
  }
  // Picker (spec/107): a plain card — the result is the content, so it gets
  // the room by default rather than a written list.
  if (kind === 'picker') {
    return {
      ...base,
      pickerSource: DEFAULT_PICKER_SOURCE,
      fillColor: '#ffffff',
      strokeColor: '#cbd5e1',
      textColor: '#0f172a',
      shadow: { offsetX: 0, offsetY: 2, blur: 6, opacity: 0.2 },
      borderRadius: 'lg',
      textSize: 'sm',
    };
  }
  // Chair (spec/130): furniture, so it paints its own seat and back and the
  // element box carries no fill. The label (a name, a role) sits UNDER the
  // chair, out of the way of the character that will sit in it.
  if (kind === 'chair') {
    return {
      ...base,
      chairFacing: DEFAULT_CHAIR_FACING,
      fillColor: 'transparent',
      strokeColor: '#94a3b8',
      textColor: '#0f172a',
      textSize: 'sm',
      textAlignY: 'bottom',
      // A chair stretched wide stops reading as a chair, the same reason the
      // portal locks its aspect. Unlockable from the menu like any element.
      aspectLocked: true,
    };
  }
  // The collaboration panels (spec/123, 124, 125, 127, 129): each paints a
  // card with its own pressable face, so they share one skin — a white
  // surface, a soft shadow, a small top-aligned title. The label is the
  // question / prompt / session name, which belongs at the top of the card
  // rather than centred over the controls.
  if (
    kind === 'estimate' ||
    kind === 'temperature' ||
    kind === 'idea-box' ||
    kind === 'agenda' ||
    kind === 'roll-call'
  ) {
    // Deliberately NO fill / stroke / text colour: the card takes the tab
    // theme's element colours like a plain square does, so a dark theme gives
    // a dark card. Pinning white here made them the only elements on the board
    // that stayed bright when everything around them darkened.
    const seed: ShapeElement = {
      ...base,
      shadow: { offsetX: 0, offsetY: 2, blur: 6, opacity: 0.2 },
      borderRadius: 'lg',
      textSize: 'sm',
      textBold: true,
      textAlignX: 'left',
      textAlignY: 'top',
    };
    if (kind === 'estimate') {
      return { ...seed, label: 'Estimate', estimateScale: DEFAULT_ESTIMATE_SCALE };
    }
    if (kind === 'temperature') return { ...seed, label: 'How are we feeling?' };
    if (kind === 'idea-box') return { ...seed, label: 'Ideas' };
    if (kind === 'agenda') {
      return {
        ...seed,
        label: 'Agenda',
        // A fresh agenda is a real one-hour-shaped session rather than an
        // empty list, so a dropped element demonstrates what it does.
        agendaItems: [
          { label: 'Set the scene', minutes: AGENDA_DEFAULT_MINUTES },
          { label: 'Gather input', minutes: 10 },
          { label: 'Discuss', minutes: 15 },
          { label: 'Agree actions', minutes: AGENDA_DEFAULT_MINUTES },
        ],
      };
    }
    return { ...seed, label: 'Roll call' };
  }
  // Decision record (spec/128): the label IS the decision statement, so it
  // reads left-aligned from the top like a sentence rather than centred like a
  // node caption, with the chip and the drivers drawn around it.
  if (kind === 'decision') {
    return {
      ...base,
      label: 'We will …',
      decisionStatus: DEFAULT_DECISION_STATUS,
      textAlignX: 'left',
      textAlignY: 'top',
      // Theme colours, like the collaboration cards above.
      borderRadius: 'lg',
      shadow: { offsetX: 0, offsetY: 2, blur: 6, opacity: 0.18 },
    };
  }
  // Document (spec/100): prose sits TOP-LEFT. Centred body text is the
  // strongest tell that something is a label pretending to be a document,
  // and every other shape defaults to centred.
  if (kind === 'entity') {
    return {
      ...base,
      // The title sits in its own bar and the rows read left to right, so
      // neither wants the centred default every other shape has.
      textAlignX: 'left',
      textAlignY: 'top',
      label: 'Entity',
      entityFields: [
        { name: 'id', type: 'string' },
        { name: 'name', type: 'string' },
      ],
    };
  }
  if (kind === 'reaction-pad') {
    return {
      ...base,
      reaction: REACTION_DEFAULT,
      // The glyph carries the meaning, so the label names the ACT rather than
      // repeating it: "Celebrate" over a 🎉 says what pressing does.
      label: 'Celebrate',
      textAlignY: 'bottom',
      borderRadius: 'lg',
    };
  }
  if (kind === 'lane') {
    return {
      ...base,
      // The title lives in the left gutter (spec/119), so it aligns to the
      // leading edge rather than floating over the work.
      textAlignX: 'left',
      textAlignY: 'middle',
      // A generous inset so the title sits IN its gutter rather than against
      // the lane's edge — the default padding put it hard up on the border.
      padding: 'lg',
      label: 'Lane',
    };
  }
  if (kind === 'page') {
    return {
      ...base,
      textAlignX: 'left',
      textAlignY: 'top',
      // Paper, explicitly, rather than whatever fill the tab theme gives
      // every other box — a page tinted like the shapes around it stops
      // reading as a page. Set as ELEMENT colours (not a theme entry), so
      // they behave like any user-picked colour and can be changed from the
      // menu; a theme with per-shape overrides can still claim the kind.
      fillColor: '#ffffff',
      strokeColor: '#d4d4d8',
      // A soft lift is the other half of "paper": it sits ON the canvas
      // rather than being drawn into it (spec/86).
      shadow: { offsetX: 0, offsetY: 2, blur: 8, opacity: 0.18 },
      // Body text wants reading size, not the label size a shape defaults to.
      textSize: 'sm',
      // A generous margin, like a word processor's — text running to the
      // edge of a page is the other half of "this isn't paper".
      padding: 'lg',
    };
  }
  // The actor is a figure with its label beneath the legs, not text
  // inside a box. Lock the aspect ratio so resizing never warps the
  // stickman, and default the label to the bottom band.
  if (kind === 'actor') {
    return { ...base, aspectLocked: true, textAlignY: 'bottom' };
  }
  // Icons: aspect-locked so the glyph never warps, label sits beneath
  // the glyph (the icon fills the box, text below reads as a caption).
  if (kind === 'icon') {
    return { ...base, aspectLocked: true, textAlignY: 'bottom' };
  }
  // Stickers (spec/116): aspect-locked, because the plate + its content are
  // one drawn object and stretching it is never what anyone wants. No label
  // at all — a sticker says what it says in its own art, and the caption band
  // an icon carries would undo the die-cut look.
  if (kind === 'sticker') {
    return { ...base, aspectLocked: true };
  }
  // Frame: a container drawn around other elements. Its label sits in the
  // top-right (like a section title) rather than centred, and the body is
  // transparent (rendered fill-less in shape-svg-overlay) so content shows
  // through.
  if (kind === 'frame') {
    // Frames start with a "Frame" section title in the top-right, padded in
    // off the border so it doesn't touch the outline, so they read as a
    // labelled container the moment they're dropped.
    return { ...base, label: 'Frame', textAlignY: 'top', textAlignX: 'right', padding: 'lg' };
  }
  // Progress ring is drawn as a donut, so lock the aspect ratio to keep it
  // circular. Both progress kinds start half-filled so the fill is visible the
  // moment they're dropped, and default to the `fill` animation — which plays
  // once on drop and holds the filled state (it doesn't loop), so a freshly
  // dropped progress element animates in and stays done.
  if (kind === 'progress-ring') {
    return { ...base, aspectLocked: true, progress: 50, progressAnim: 'fill' };
  }
  if (kind === 'progress-bar') {
    return { ...base, progress: 50, progressAnim: 'fill' };
  }
  // Timeline rail: starts with the default number of points; no label inside
  // (the rail draws its own dots + line). See spec/51.
  if (kind === 'timeline-rail') {
    return { ...base, railCount: RAIL_DEFAULT_POINTS, strokeColor: '#64748b' };
  }
  // Rating: a row of stars, three filled by default, amber accent. See spec/52.
  if (kind === 'rating') {
    return { ...base, rating: RATING_DEFAULT, strokeColor: '#f59e0b' };
  }
  // Pie + bar charts: start with three sample data points; edit from the menu.
  // See spec/53.
  if (kind === 'pie-chart' || kind === 'bar-chart') {
    return { ...base, pieSlices: PIE_DEFAULT_SLICES.map((s) => ({ ...s })) };
  }
  // Line chart: shared categories + a couple of sample series (CSV-importable).
  if (kind === 'line-chart') {
    return {
      ...base,
      lineCategories: [...LINE_DEFAULT_CATEGORIES],
      lineSeries: LINE_DEFAULT_SERIES.map((s) => ({ ...s, values: [...s.values] })),
    };
  }
  // Code block: empty snippet, plain language; the view renders a
  // double-click-to-edit placeholder until code lands. See spec/82.
  if (kind === 'code-block') {
    return { ...base, codeLanguage: 'plain' };
  }
  // Checklist: starter rows so the affordance is obvious on drop. See spec/83.
  if (kind === 'checklist') {
    return { ...base, checklistItems: CHECKLIST_DEFAULT_ITEMS.map((i) => ({ ...i })) };
  }
  return base;
}
