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
import { presetSetup } from '@livediagram/items';
import {
  DEFAULT_BUTTON_MODE,
  DEFAULT_PICKER_SOURCE,
  DEFAULT_SESSION_TOOL,
  DEFAULT_TIMER_MINUTES,
} from './selection-mode';
import {
  CHECKLIST_DEFAULT_ITEMS,
  LEGEND_DEFAULT_ITEMS,
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
} from './collab-shapes';
import { QUIZ_DEFAULT_SECONDS } from './quiz';
import { SANKEY_DEFAULT_FLOWS } from './sankey-model';
import { NAV_DEFAULT_LINKS, PROCESS_DEFAULT_STEPS, STAT_DEFAULTS } from './web-components';
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
  // Document (docs/specs/009-elements/page-element.md): 420x594 is the A-series root-2 ratio, at a size that
  // reads as a page beside a 120px square without swallowing the canvas.
  page: { width: 420, height: 594 },
  // Mind node (docs/specs/009-elements/mind-node.md): a caption-width pill. Wide enough for a phrase,
  // short enough that a column of siblings stays readable. 170x48 fitted a
  // couple of words and made anything longer wrap or overflow, which is not
  // what people actually type into a mind map.
  'mind-node': { width: 250, height: 80 },
  // Lane (docs/specs/009-elements/lane.md): a band, not a box — wide enough to lay a flow across and
  // tall enough for a row of steps.
  lane: { width: 900, height: 200 },
  // Reaction pad: a press-me square, sized like the other Behaviour buttons.
  'reaction-pad': { width: 150, height: 110 },
  // Comment panel (docs/specs/012-collaboration/comment-pin.md "The look"): a card sized for a short
  // conversation (three or four bubbles) above the composer. It reflows, so a
  // resize makes room for more of the thread.
  'comment-pin': { width: 300, height: 320 },
  // Action panel (docs/specs/012-collaboration/action-panel.md): sized for a few actions above the Add
  // Action bar. It reflows, so a resize makes room for more actions.
  'action-card': { width: 300, height: 300 },
  // Done check: taller than the other room-response panels because it stacks
  // TWO rosters (done and waiting) plus the all-done line. At 190 a two-person
  // room already overflowed by a few pixels and the body grew a scrollbar.
  'done-check': { width: 280, height: 220 },
  // Record (docs/specs/009-elements/entity.md): a class box — wide enough for "name: Type" rows,
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
  // big. Transparent by default (see defaultFillColor) with a top-left label.
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
  // Foldable, unfolded: the two panels side by side make a nearly square
  // inner screen, a little wider than it is tall, which is what separates it
  // at a glance from the portrait phone and tablet above.
  foldable: { width: 190, height: 170 },
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
  // Plan board (docs/specs/026-plan/blueprints/DEFAULTS.md D5): room for five 220px columns and a
  // header; made Blank (no columns yet), so it starts at the empty board's height (planBoardHeightFor).
  // A literal, not PLAN_BOARD_EMPTY_HEIGHT_PX: this table is read while the module graph is still loading,
  // where the imported constant can be uninitialised; plan-shapes.test.ts keeps the two equal.
  // A Plan card is one card face at a board column's width.
  'plan-board': { width: 1120, height: 880 },
  'plan-card': { width: 240, height: 120 },
  // A plan view's own size comes from its view (planViewSize); this is a visualisation's.
  'plan-view': { width: 720, height: 400 },
  // A Sheet (docs/specs/029-sheets/sheet.md "Placing a sheet"): about nine columns by eighteen rows.
  'plan-sheet': { width: 960, height: 560 },
  // Progress bar: a wide, short pill. Progress ring: a square donut
  // (aspect-locked on create so it stays circular).
  'progress-bar': { width: 220, height: 44 },
  'progress-ring': { width: 130, height: 130 },
  // Timeline rail: width carries the default points at RAIL_POINT_STEP_PX
  // spacing; height leaves room for the dots + ticks above the line.
  'timeline-rail': { width: RAIL_DEFAULT_POINTS * RAIL_POINT_STEP_PX, height: 96 },
  // Rating: a row of five stars.
  rating: { width: 200, height: 44 },
  // Charts default their legend BELOW the plot (docs/specs/009-elements/pie-chart.md), so the starting box
  // is squarer than it was when the legend took a side strip: the width goes to
  // the plot and the extra height carries the legend band.
  'pie-chart': { width: 260, height: 220 },
  'bar-chart': { width: 260, height: 220 },
  // Line chart: a touch wider for the x-axis labels.
  'line-chart': { width: 300, height: 240 },
  // Code block: room for a dozen-ish monospace lines (docs/specs/009-elements/code-block.md).
  'code-block': { width: 320, height: 180 },
  // Checklist: a card of starter rows (docs/specs/009-elements/checklist.md).
  checklist: { width: 240, height: 180 },
  // Legend (docs/specs/009-elements/pie-chart.md): narrower than a checklist, because a key is a swatch and
  // a word, and short enough to sit in a corner beside the thing it explains.
  legend: { width: 180, height: 132 },
  // Sankey (docs/specs/009-elements/sankey.md): wide, because a Sankey reads left to right across its
  // columns, and the starter budget has four of them, each with a label beside its bar.
  sankey: { width: 560, height: 300 },
  // Mode button (docs/specs/009-elements/mode-button.md): a square-ish tile, sized for an icon ABOVE its
  // label — the shape a toolbar button has, rather than a wide pill that read
  // as just another labelled box.
  'mode-button': { width: 104, height: 96 },
  // Bring Focus (docs/specs/012-collaboration/bring-focus.md): the mode button's shape, a touch wider because its
  // label is a sentence fragment ("The problem") rather than a mode's one word.
  'focus-button': { width: 120, height: 96 },
  // Portal (docs/specs/009-elements/portal-element.md): portal-shaped — taller than it is wide, like a portal.
  portal: { width: 72, height: 112 },
  // Session button (docs/specs/012-collaboration/session-button.md): the Selection Mode button's tile, so a row of
  // Behaviour controls lines up.
  'session-button': { width: 104, height: 96 },
  // Reveal zone (docs/specs/009-elements/reveal-zone.md): a cover, so it arrives big enough to actually
  // cover something — a column of notes rather than one sticky.
  reveal: { width: 320, height: 220 },
  // Picker (docs/specs/012-collaboration/picker.md): a card wide enough for a name at a readable size.
  picker: { width: 220, height: 132 },
  // Chair (docs/specs/009-elements/chair.md): furniture at human scale beside a 40px-wide Avatar-mode
  // character — a seat the sprite fits into rather than a throne it rattles
  // around in.
  chair: { width: 76, height: 84 },
  // Estimate card (docs/specs/012-collaboration/estimate-card.md): the eight fibonacci chips wrap to two rows, and
  // the card has to hold them PLUS the answered avatars PLUS the two footer
  // buttons without clipping — a card that arrives already cut off is the
  // first thing anybody sees.
  estimate: { width: 360, height: 310 },
  // Quiz (docs/specs/012-collaboration/quiz.md): a square, because the face is a disc with the answers on a
  // ring around it. Big enough that six answers fit round the ring at a
  // readable size before anybody resizes it.
  quiz: { width: 520, height: 520 },
  // Temperature check (docs/specs/012-collaboration/temperature-check.md): five faces over five bars over
  // the mood meter. Wide enough for each face to carry its word, and tall
  // enough that the bars, the main read, get real height.
  temperature: { width: 320, height: 300 },
  // Idea box (docs/specs/012-collaboration/idea-box.md): a list of ideas over the composer, so it arrives
  // sized like a retro column rather than a sticky, and tall enough for its
  // empty state (the breathing rows plus the invitation under them) above the
  // composer without scrolling.
  'idea-box': { width: 340, height: 420 },
  // Q&A board (docs/specs/012-collaboration/qa-board.md): a spotlight over a ranked list over the add field,
  // so it arrives tall enough for five or six notes before it scrolls.
  'qa-board': { width: 360, height: 460 },
  // Agenda (docs/specs/012-collaboration/agenda.md): a run of six segments before it needs resizing.
  agenda: { width: 330, height: 300 },
  // Decision record (docs/specs/012-collaboration/decision-record.md): a card for a sentence plus three drivers.
  decision: { width: 330, height: 220 },
  // Roll call (docs/specs/012-collaboration/roll-call.md): two columns of names, six rows deep.
  'roll-call': { width: 300, height: 260 },
  // Web components (docs/specs/009-elements/web-components-and-no-groups.md), at the sizes the grouped composites they
  // replace arrived at, so a canvas built from either reads the same.
  banner: { width: 440, height: 104 },
  callout: { width: 380, height: 116 },
  // Card (docs/specs/009-elements/card.md): room for a title, a meta line, two body lines and a tag row.
  card: { width: 300, height: 150 },
  // Badge (docs/specs/009-elements/badge.md): fitted to its text on every commit (badgeSize); this is "New".
  badge: { width: 40, height: 24 },
  // Step number (docs/specs/009-elements/step-number.md): a small disc.
  step: { width: 28, height: 28 },
  // Pointer note (docs/specs/009-elements/pointer-note.md): a short note; its tip hangs below it (D190).
  'pointer-note': { width: 180, height: 64 },
  // Diagram key (docs/specs/009-elements/diagram-key.md): one row's height until it settles (D191).
  'diagram-key': { width: 260, height: 68 },
  // Stack (docs/specs/009-elements/stack.md): an empty row to drop into (D192).
  stack: { width: 360, height: 160 },
  // Sequence diagram (docs/specs/009-elements/sequence-diagram.md): three lifelines and five messages (D194).
  sequence: { width: 560, height: 340 },
  // Boundary (docs/specs/009-elements/boundary.md): room for a few nodes inside.
  boundary: { width: 480, height: 300 },
  // Concept graphics (docs/specs/009-elements/concept-graphics.md).
  'layer-stack': { width: 360, height: 260 },
  pyramid: { width: 320, height: 260 },
  cycle: { width: 300, height: 300 },
  hub: { width: 340, height: 320 },
  onion: { width: 320, height: 320 },
  chevrons: { width: 600, height: 150 },
  // Three 150px cards and two 16px gaps.
  'stat-row': { width: 482, height: 96 },
  process: { width: 420, height: 110 },
  'site-header': { width: 640, height: 84 },
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
  // Mode button (docs/specs/009-elements/mode-button.md): looks like a button, so it arrives pill-shaped
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
      // hairline border, dark text, and a soft lift off the canvas (docs/specs/008-canvas/element-shadows.md).
      // Deliberately NOT a saturated brand block — a solid slab of colour on
      // the canvas reads as a shape someone drew, not as a control, and it
      // fought every canvas's own palette. The skin is NOT stored: it is the
      // kind's default per surface (behaviourSkin in colors.ts), so an
      // unstyled button follows light / dark and the tab theme like any shape.
      shadow: { offsetX: 0, offsetY: 2, blur: 6, opacity: 0.24 },
      borderRadius: 'lg',
      textSize: 'sm',
      textBold: true,
    };
  }
  // Portal (docs/specs/009-elements/portal-element.md): ships unlinked (there is nothing to link to until a
  // second portal exists) with a label the author replaces. It paints its own
  // ring, so the box behind it is transparent, and `strokeColor` is the colour
  // of the energy rather than of a border — electric blue by default, the
  // colour everyone already reads as "portal", and recolourable like any other
  // element (an orange pair is the obvious second half).
  if (kind === 'portal') {
    return {
      ...base,
      // Deliberately UNLABELLED: an unnamed portal is named positionally
      // ("Portal 1", "Portal 2") wherever it's shown, so a canvas full of them
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
  // Session button (docs/specs/012-collaboration/session-button.md): same skin and rules as the Selection Mode
  // button — it IS one, pointed at a session tool instead of a mode — with a
  // default five-minute timer so a fresh one already does something.
  if (kind === 'session-button') {
    return {
      ...base,
      session: { tool: DEFAULT_SESSION_TOOL, minutes: DEFAULT_TIMER_MINUTES },
      shadow: { offsetX: 0, offsetY: 2, blur: 6, opacity: 0.24 },
      borderRadius: 'lg',
      textSize: 'sm',
      textBold: true,
    };
  }
  // Reveal zone (docs/specs/009-elements/reveal-zone.md): a frosted cover. It paints itself, so the element
  // box carries no fill of its own; the label names what is underneath and
  // sits at the top, out of the way of the middle where the hint goes.
  if (kind === 'reveal') {
    return {
      ...base,
      label: 'Hidden',
      borderRadius: 'lg',
      textAlignY: 'top',
      textBold: true,
    };
  }
  // Picker (docs/specs/012-collaboration/picker.md): a plain card — the result is the content, so it gets
  // the room by default rather than a written list.
  if (kind === 'picker') {
    return {
      ...base,
      pickerSource: DEFAULT_PICKER_SOURCE,
      shadow: { offsetX: 0, offsetY: 2, blur: 6, opacity: 0.2 },
      borderRadius: 'lg',
      textSize: 'sm',
    };
  }
  // Chair (docs/specs/009-elements/chair.md): furniture, so it paints its own seat and back and the
  // element box carries no fill. The label (a name, a role) sits UNDER the
  // chair, out of the way of the character that will sit in it.
  if (kind === 'chair') {
    return {
      ...base,
      chairFacing: DEFAULT_CHAIR_FACING,
      textSize: 'sm',
      textAlignY: 'bottom',
      // A chair stretched wide stops reading as a chair, the same reason the
      // portal locks its aspect. Unlockable from the menu like any element.
      aspectLocked: true,
    };
  }
  // The collaboration panels (docs/specs/012-collaboration/estimate-card.md, 124, 125, 127, 129): each paints a
  // card with its own pressable face, so they share one skin — a white
  // surface, a soft shadow, a small top-aligned title. The label is the
  // question / prompt / session name, which belongs at the top of the card
  // rather than centred over the controls.
  if (
    kind === 'estimate' ||
    kind === 'temperature' ||
    kind === 'idea-box' ||
    kind === 'qa-board' ||
    kind === 'agenda' ||
    kind === 'roll-call'
  ) {
    // Deliberately NO fill / stroke / text colour: the card takes the tab
    // theme's element colours like a plain square does, so a dark theme gives
    // a dark card. Pinning white here made them the only elements on the canvas
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
      // No scale: the card asks for one on the canvas (estimateScalePending).
      return { ...seed, label: 'Estimate' };
    }
    if (kind === 'temperature') return { ...seed, label: 'How are we feeling?' };
    if (kind === 'idea-box') return { ...seed, label: 'Ideas' };
    if (kind === 'qa-board') return { ...seed, label: 'Questions' };
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
  // Decision record (docs/specs/012-collaboration/decision-record.md): the label IS the decision statement, so it
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
  // Document (docs/specs/009-elements/page-element.md): prose sits TOP-LEFT. Centred body text is the
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
  // Quiz (docs/specs/012-collaboration/quiz.md): arrives as a real question so a dropped card
  // demonstrates what it does, with its aspect locked because a stretched
  // ring stops being a ring.
  if (kind === 'quiz') {
    return {
      ...base,
      label: 'Which planet is closest to the sun?',
      quizOptions: ['Venus', 'Mercury', 'Mars', 'Earth'],
      quizCorrect: 1,
      quizSeconds: QUIZ_DEFAULT_SECONDS,
      aspectLocked: true,
    };
  }
  if (kind === 'done-check') {
    // The title states the QUESTION, because "Done" alone reads as a claim
    // that something is done rather than a request to say whether you are.
    return { ...base, label: 'Everyone done?' };
  }
  if (kind === 'comment-pin') {
    return {
      ...base,
      // No label: the panel's content IS the thread, and a caption above it
      // would be a title for a conversation nobody has had yet.
      label: '',
    };
  }
  if (kind === 'action-card') {
    return {
      ...base,
      // No label: the Assign Action dialog prefills the action's NAME from the
      // element's label (docs/specs/012-collaboration/assigned-actions.md §2), so a default caption here would become
      // every new action's name.
      label: '',
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
      // The title lives in the left gutter (docs/specs/009-elements/lane.md), so it aligns to the
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
      // rather than being drawn into it (docs/specs/008-canvas/element-shadows.md).
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
  // Stickers (docs/specs/010-palette/stickers.md): aspect-locked, because the plate + its content are
  // one drawn object and stretching it is never what anyone wants. No label
  // at all — a sticker says what it says in its own art, and the caption band
  // an icon carries would undo the die-cut look.
  if (kind === 'sticker') {
    return { ...base, aspectLocked: true };
  }
  // Frame: a container drawn around other elements. Its label sits in the
  // top-right (like a section title) rather than centred, and the body is
  // transparent by default (defaultFillColor) so content shows through.
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
  // (the rail draws its own dots + line). See docs/specs/009-elements/timeline-rail.md.
  if (kind === 'timeline-rail') {
    return { ...base, railCount: RAIL_DEFAULT_POINTS, strokeColor: '#64748b' };
  }
  // Rating: a row of stars, three filled by default, amber accent. See docs/specs/009-elements/rating.md.
  if (kind === 'rating') {
    return { ...base, rating: RATING_DEFAULT, strokeColor: '#f59e0b' };
  }
  // Pie + bar charts: start with three sample data points; edit from the menu.
  // See docs/specs/009-elements/pie-chart.md.
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
  // double-click-to-edit placeholder until code lands. See docs/specs/009-elements/code-block.md.
  if (kind === 'code-block') {
    return { ...base, codeLanguage: 'plain' };
  }
  // Checklist: starter rows so the affordance is obvious on drop. See docs/specs/009-elements/checklist.md.
  if (kind === 'checklist') {
    return { ...base, checklistItems: CHECKLIST_DEFAULT_ITEMS.map((i) => ({ ...i })) };
  }
  // Plan board: the blank preset's set-up; a palette tile or template swaps in its own
  // (docs/specs/026-plan/plan-mode.md). Plan card: its caller names the item.
  if (kind === 'plan-board') return { ...base, planBoard: presetSetup('blank') };
  if (kind === 'plan-card') return { ...base, planCard: { itemId: '' } };
  // Plan view: Cards by Field unless its caller names the view.
  if (kind === 'plan-view') return { ...base, planView: { view: 'workload' } };
  // Sheet: its caller makes the sheet in the store and names it.
  if (kind === 'plan-sheet') return { ...base, planSheet: { sheetId: '' } };
  // Web components (docs/specs/009-elements/web-components-and-no-groups.md): the starting content each one shows on drop,
  // so a new one reads as what it is. Colours come from the caller
  // (createComponent maps the theme); without one the renderer's fallbacks
  // apply, which is what an MCP- or AI-authored one gets.
  if (kind === 'banner') {
    return {
      ...base,
      label: 'Banner title',
      pageSubtitle: 'Subtitle or description',
      textSize: 'lg',
      textBold: true,
      textAlignX: 'center',
      textAlignY: 'middle',
      borderRadius: 'lg',
    };
  }
  // Concept graphics (docs/specs/009-elements/concept-graphics.md): rows to start from, so the first one reads as
  // what it is.
  if (kind === 'layer-stack')
    return {
      ...base,
      conceptRows: [
        { label: 'Presentation', note: 'Next.js' },
        { label: 'API', note: 'Workers' },
        { label: 'Domain', note: 'packages/document' },
        { label: 'Storage', note: 'D1' },
      ],
    };
  if (kind === 'pyramid')
    return {
      ...base,
      conceptRows: [
        { label: 'Vision' },
        { label: 'Strategy' },
        { label: 'Objectives' },
        { label: 'Daily work' },
      ],
    };
  if (kind === 'cycle')
    return {
      ...base,
      label: 'Weekly loop',
      textSize: 'sm',
      aspectLocked: true,
      conceptRows: [{ label: 'Plan' }, { label: 'Do' }, { label: 'Check' }, { label: 'Act' }],
    };
  if (kind === 'hub')
    return {
      ...base,
      label: 'Orders',
      textSize: 'sm',
      textBold: true,
      conceptRows: ['Payments', 'Stock', 'Email', 'Search', 'Analytics', 'Support'].map(
        (label) => ({
          label,
        }),
      ),
    };
  if (kind === 'onion')
    return {
      ...base,
      aspectLocked: true,
      conceptRows: [
        { label: 'Domain' },
        { label: 'Application' },
        { label: 'Adapters' },
        { label: 'Infrastructure' },
      ],
    };
  if (kind === 'chevrons')
    return {
      ...base,
      conceptRows: [
        { label: 'Commit', note: 'push to main' },
        { label: 'Build', note: '2 min' },
        { label: 'Test', note: '8,400 tests' },
        { label: 'Release', note: 'manual gate' },
      ],
    };
  // Boundary (docs/specs/009-elements/boundary.md): a titled, dashed container.
  if (kind === 'boundary')
    return {
      ...base,
      label: 'Region',
      strokeStyle: 'dashed',
      borderRadius: 'md',
      textSize: 'sm',
      textBold: true,
      // The title sits in its tab or corner (boundaryLayout), so the label takes the region whole.
      textAlignX: 'left',
      textAlignY: 'middle',
      padding: 'none',
    };
  // Badge (docs/specs/009-elements/badge.md): a word to start from; a step takes its number when it lands
  // (settleChips), so it starts with none.
  // Their text is centred with no padding: the face is the pill, the label its word.
  if (kind === 'badge')
    return { ...base, label: 'New', textSize: 'sm', textBold: true, padding: 'none' };
  if (kind === 'stack')
    return {
      ...base,
      label: '',
      strokeStyle: 'dashed',
      strokeWidth: 'thin',
      borderRadius: 'md',
      textSize: 'sm',
      textAlignX: 'left',
      textAlignY: 'top',
    };
  if (kind === 'sequence')
    return {
      ...base,
      label: '',
      strokeWidth: 'thin',
      sequenceParticipants: [
        { id: 'browser', label: 'Browser' },
        { id: 'api', label: 'API' },
        { id: 'db', label: 'Database' },
      ],
      sequenceMessages: [
        { from: 'browser', to: 'api', label: 'Place order', kind: 'call' },
        { from: 'api', to: 'api', label: 'Validate', kind: 'call' },
        { from: 'api', to: 'db', label: 'Insert order', kind: 'call' },
        { from: 'db', to: 'api', label: 'Order id', kind: 'reply' },
        { from: 'api', to: 'browser', label: '201 Created', kind: 'reply' },
      ],
    };
  if (kind === 'diagram-key')
    return {
      ...base,
      label: 'Key',
      textSize: 'sm',
      textBold: true,
      textAlignX: 'left',
      textAlignY: 'top',
      // The title sits in its own 20 px band (diagramKeyLayout); padding there clipped its descenders.
      padding: 'none',
      borderRadius: 'md',
      strokeWidth: 'thin',
    };
  if (kind === 'pointer-note')
    return {
      ...base,
      label: 'Stale for 60 s after a price change',
      textSize: 'sm',
      textAlignX: 'left',
      textAlignY: 'top',
      borderRadius: 'md',
      strokeColor: '#d97706',
      fillColor: '#fffbeb',
      textColor: '#78350f',
      pointerTip: { x: -24, y: 120 },
    };
  if (kind === 'step')
    return { ...base, aspectLocked: true, textSize: 14, textBold: true, padding: 'none' };
  // Card (docs/specs/009-elements/card.md): every slot but the band on, so the first one shows what a card is made of.
  if (kind === 'card') {
    return {
      ...base,
      cardMedia: 'tile',
      iconId: 'credit-card',
      pageTitle: 'Payments',
      pageSubtitle: 'Stripe, EU region',
      label: 'Takes card payments and issues refunds.',
      tags: ['PCI', 'v2'],
      textSize: 'sm',
      textAlignX: 'left',
      textAlignY: 'top',
      strokeWidth: 'thin',
      borderRadius: 'md',
    };
  }
  if (kind === 'callout') {
    return {
      ...base,
      pageTitle: 'Heads up',
      label: 'A short note with some supporting detail.',
      textSize: 'sm',
      textAlignX: 'left',
      textAlignY: 'top',
      strokeWidth: 'thin',
      borderRadius: 'md',
    };
  }
  if (kind === 'stat-row') {
    return { ...base, stats: STAT_DEFAULTS.map((st) => ({ ...st })), borderRadius: 'md' };
  }
  if (kind === 'process') {
    return { ...base, processSteps: [...PROCESS_DEFAULT_STEPS] };
  }
  if (kind === 'site-header') {
    return {
      ...base,
      label: 'Brand',
      navLinks: [...NAV_DEFAULT_LINKS],
      textSize: 'md',
      textBold: true,
      textAlignX: 'left',
      textAlignY: 'middle',
      borderRadius: 'md',
    };
  }
  // Legend: starter rows so the card is not an empty box on drop. Their
  // colours are left unset, so they take the chart palette by index and a
  // legend beside a chart matches it without being told to. See docs/specs/009-elements/pie-chart.md.
  if (kind === 'legend') {
    return { ...base, legendItems: LEGEND_DEFAULT_ITEMS.map((i) => ({ ...i })) };
  }
  // Sankey: the starter household budget (docs/specs/009-elements/sankey.md), so it drops as a real
  // diagram to edit rather than an empty box to fill. Copied, so no two diagrams share the array.
  if (kind === 'sankey') {
    return { ...base, sankeyFlows: SANKEY_DEFAULT_FLOWS.map((f) => ({ ...f })) };
  }
  return base;
}
