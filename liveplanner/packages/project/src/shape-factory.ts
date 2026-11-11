// How a shape of kind K is born: the factory that turns a kind into a
// ShapeElement with that kind's own starting content, at its default size
// (./shape-default-size). Lifted out of ./factories, which had reached 719 lines holding this
// alongside the factories for every OTHER element type; those stayed behind.
//
// Runtime constants come from the LEAF modules ('./data-shapes',
// './behaviour-config', './collab-shapes'), NOT from './index':
// a runtime read through the index cycle at module init TDZ-crashes plain-Node ESM consumers. Only TYPES
// come from './index', and those are erased at build.
import { presetSetup } from '@liveplanner/items';
import {
  DEFAULT_PICKER_SOURCE,
  DEFAULT_SESSION_TOOL,
  DEFAULT_TIMER_MINUTES,
} from './behaviour-config';
import {
  CHECKLIST_DEFAULT_ITEMS,
  LEGEND_DEFAULT_ITEMS,
  LINE_DEFAULT_CATEGORIES,
  LINE_DEFAULT_SERIES,
  PIE_DEFAULT_SLICES,
  RATING_DEFAULT,
} from './data-shapes';
import { DEFAULT_DECISION_STATUS } from './collab-shapes';
import { SANKEY_DEFAULT_FLOWS } from './sankey-model';
import { NAV_DEFAULT_LINKS, PROCESS_DEFAULT_STEPS, STAT_DEFAULTS } from './web-components';
import type { ShapeElement, ShapeKind } from './index';
import { SHAPE_DEFAULT_SIZE } from './shape-default-size';

// The default size table lives in ./shape-default-size; re-exported so callers' imports stay as they were.
export { SHAPE_DEFAULT_SIZE } from './shape-default-size';

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
  // Session button (docs/specs/012-collaboration/session-button.md): looks like a button, with a default
  // five-minute timer so a fresh one already does something.
  if (kind === 'session-button') {
    return {
      ...base,
      session: { tool: DEFAULT_SESSION_TOOL, minutes: DEFAULT_TIMER_MINUTES },
      // A button has to look pressable BEFORE anyone styles it, so it ships with a real UI button's lift off the
      // canvas (docs/specs/008-canvas/element-shadows.md). The skin is NOT stored: it is the kind's default per
      // surface (behaviourSkin in colors.ts), so an unstyled button follows light / dark and the tab theme.
      shadow: { offsetX: 0, offsetY: 2, blur: 6, opacity: 0.24 },
      borderRadius: 'lg',
      textSize: 'sm',
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
  // The temperature check (docs/specs/012-collaboration/temperature-check.md): a card with its own pressable
  // face — a soft shadow, a small top-aligned title. The label is the question, which belongs at the top of
  // the card rather than centred over the controls.
  if (kind === 'temperature') {
    // Deliberately NO fill / stroke / text colour: the card takes the tab
    // theme's element colours like a plain square does, so a dark theme gives
    // a dark card. Pinning white here made them the only elements on the canvas
    // that stayed bright when everything around them darkened.
    return {
      ...base,
      label: 'How are we feeling?',
      shadow: { offsetX: 0, offsetY: 2, blur: 6, opacity: 0.2 },
      borderRadius: 'lg',
      textSize: 'sm',
      textBold: true,
      textAlignX: 'left',
      textAlignY: 'top',
    };
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
      // Theme colours, like the temperature check above.
      borderRadius: 'lg',
      shadow: { offsetX: 0, offsetY: 2, blur: 6, opacity: 0.18 },
    };
  }
  // Project (docs/specs/009-elements/page-element.md): prose sits TOP-LEFT. Centred body text is the
  // strongest tell that something is a label pretending to be a project,
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
        { label: 'Domain', note: 'packages/project' },
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
  // A Timeline's milestones, each with its when (docs/specs/009-elements/concept-graphics.md "Timeline").
  if (kind === 'timeline-rail')
    return {
      ...base,
      conceptRows: [
        { label: 'Kick-off', note: 'Jan' },
        { label: 'First prototype', note: 'Mar' },
        { label: 'Beta with customers', note: 'Jun' },
        { label: 'Launch', note: 'Sep' },
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
