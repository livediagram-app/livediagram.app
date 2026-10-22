// How a shape of kind K is born: the per-kind default size table, and the
// factory that turns a kind into a ShapeElement with that kind's own starting
// content. Lifted out of ./factories, which had reached 719 lines holding this
// alongside the factories for every OTHER element type; those stayed behind.
//
// Runtime constants come from the LEAF modules ('./data-shapes',
// './sankey-model', './web-components'), NOT from './index':
// SHAPE_DEFAULT_SIZE reads RAIL_* at module-init time, and a runtime read
// through the index cycle TDZ-crashes plain-Node ESM consumers. Only TYPES
// come from './index', and those are erased at build.
import {
  CHECKLIST_DEFAULT_ITEMS,
  LEGEND_DEFAULT_ITEMS,
  LINE_DEFAULT_CATEGORIES,
  LINE_DEFAULT_SERIES,
  PIE_DEFAULT_SLICES,
  RATING_DEFAULT,
} from './data-shapes';
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
  // Stadium / pill — the conventional flowchart "Start / End" terminator
  // shape. Wider than tall by default; the CSS `border-radius: 9999px`
  // render path means the ends stay perfectly semicircular at any
  // aspect ratio the user resizes to.
  stadium: { width: 160, height: 64 },
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
  // Progress bar: a wide, short pill. Progress ring: a square donut
  // (aspect-locked on create so it stays circular).
  'progress-bar': { width: 220, height: 44 },
  'progress-ring': { width: 130, height: 130 },
  // Timeline (docs/specs/009-elements/concept-graphics.md "Timeline"): four milestones, words above and below.
  'timeline-rail': { width: 720, height: 240 },
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
  // Tab window (docs/specs/009-elements/tab-window.md): 16:9, TAB_WINDOW_SIZE.
  'tab-window': { width: 640, height: 360 },
  // Web components (docs/specs/009-elements/web-components-and-no-groups.md), at the sizes the grouped composites they
  // replace arrived at, so a canvas built from either reads the same.
  banner: { width: 440, height: 104 },
  callout: { width: 380, height: 116 },
  // Card (docs/specs/009-elements/card.md): room for a title, a meta line, two body lines and a tag row.
  card: { width: 300, height: 150 },
  // Badge (docs/specs/009-elements/badge.md): fitted to its text on every commit (badgeSize); this is "New" (BADGE_NEW_LABEL).
  badge: { width: 40, height: 24 },
  // Step number (docs/specs/009-elements/step-number.md): a small disc.
  step: { width: 28, height: 28 },
  // Pointer note (docs/specs/009-elements/pointer-note.md): a short note; its tip hangs below it (D190).
  'pointer-note': { width: 180, height: 64 },
  // Stack (docs/specs/009-elements/stack.md): an empty row to drop into (D192).
  stack: { width: 360, height: 160 },
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
  // Document (docs/specs/009-elements/page-element.md): prose sits TOP-LEFT. Centred body text is the
  // strongest tell that something is a label pretending to be a document,
  // and every other shape defaults to centred.
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
