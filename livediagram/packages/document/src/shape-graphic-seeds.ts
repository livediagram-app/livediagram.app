// The starting content of the data, chart, web-component and concept-graphic shape kinds:
// what each shows the moment it is dropped. createShape (./shape-factory) hands every kind
// it does not seed itself to seedGraphicShape, which returns `base` for a plain shape.
// Runtime constants come from the LEAF modules, never './index' (see ./shape-factory).
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

export function seedGraphicShape(kind: ShapeKind, base: ShapeElement): ShapeElement {
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
