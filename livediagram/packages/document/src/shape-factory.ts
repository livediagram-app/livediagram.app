// How a shape of kind K is born: the factory that turns a kind into a ShapeElement with
// that kind's own starting content. Lifted out of ./factories, which had reached 719 lines
// holding this alongside the factories for every OTHER element type; those stayed behind.
// The per-kind size table is ./shape-default-size, and the starting content of the data,
// chart, web-component and concept-graphic kinds is ./shape-graphic-seeds.
//
// Runtime constants come from the LEAF modules ('./data-shapes',
// './selection-mode', './collab-shapes'), NOT from './index': a runtime read
// through the index cycle TDZ-crashes plain-Node ESM consumers. Only TYPES
// come from './index', and those are erased at build.
import {
  NEW_BUTTON_MODE,
  DEFAULT_PICKER_SOURCE,
  DEFAULT_SESSION_TOOL,
  DEFAULT_TIMER_MINUTES,
} from './selection-mode';
import { REACTION_DEFAULT } from './data-shapes';
import { AGENDA_DEFAULT_MINUTES, DEFAULT_DECISION_STATUS } from './collab-shapes';
import { QUIZ_DEFAULT_SECONDS } from './quiz';
import { SHAPE_DEFAULT_SIZE } from './shape-default-size';
import { seedGraphicShape } from './shape-graphic-seeds';
import type { ShapeElement, ShapeKind } from './index';

export { SHAPE_DEFAULT_SIZE };

// --- Factories -------------------------------------------------------------

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
  // with a call to action already written and pointed at NEW_BUTTON_MODE (Spotlight); Avatar mode moved to
  // livehuddle (docs/specs/002-project-scope/not-in-livediagram.md). The author retypes the label like any
  // other shape's, and picks a different mode from the element menu.
  if (kind === 'mode-button') {
    return {
      ...base,
      // NO default label: the face reads "Switch to <Mode>", derived from the
      // mode it carries, so re-pointing a button relabels it instead of leaving
      // yesterday's copy on it. An author who types their own label wins — it
      // is still a shape's label — but the useful default is the derived one.
      mode: NEW_BUTTON_MODE,
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
      // wins over the number. See portalName in apps/editor/lib/portals.ts.
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
        { name: 'id', type: 'string', key: 'pk' },
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
  return seedGraphicShape(kind, base);
}
