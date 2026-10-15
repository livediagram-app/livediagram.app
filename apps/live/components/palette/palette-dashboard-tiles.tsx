// A Dashboard's Layout tiles (docs/specs/026-plan/plan-tabs.md "Dashboard tab"), named for what they hold: a Metrics
// Row (four short slots), a Chart Row (two), a Board Row (one tall slot across the page) and a Slot. Dragged onto the
// page they land in the zone under the pointer (a row between rows, a slot at a gap in a row, or a row of its own);
// pressed, a row goes at the end and a slot in the last row with room. They ride the plan view action with a
// `layout:` choice, which only a Dashboard takes (hooks/plan/dashboard-drop.ts); the category shows on a Dashboard tab
// alone. Each tile's picture is the row it makes.
import type { ReactNode } from 'react';
import { Glyph, PlanIcon, lucideGlyph } from '@livediagram/ui';
import {
  lucideCalendar,
  lucideCircleCheck,
  lucideClipboardList,
  lucideHash,
  lucideLink,
  lucideWorkflow,
} from '@livediagram/icons/lucide';
import { SheetArt } from '@/components/sheets/sheet-art';
import {
  FORM_METRICS,
  SHEET_METRICS,
  type FormMetricKind,
  type SheetMetricKind,
} from '@livediagram/document';
import { FORM_METRIC_LINES, FORM_METRIC_NAMES, SHEET_METRIC_NAMES } from '@livediagram/plan-art';
import {
  DASHBOARD_CARD_KINDS,
  formMetricChoice,
  sheetMetricChoice,
  SHEET_CHART_CHOICE,
  dashboardCardChoice,
  dashboardTabChoice,
  type DashboardCardKind,
} from '@/hooks/plan/dashboard-drop';
import type { PlanTabEntry } from '@/hooks/plan/plan-tab-list-store';
import type { PaletteTileDef } from './palette-tile-defs';

// A row drawn small: `slots` slots across, at `h` of the 20-unit glyph's height; a Slot is one slot with a plus.
function LayoutGlyph({ slots, h, plus = false }: { slots: number; h: number; plus?: boolean }) {
  const gap = 1.5;
  const w = (17 - gap * (slots - 1)) / slots;
  const y = 10 - h / 2;
  return (
    <Glyph size={18} units={20}>
      {Array.from({ length: slots }, (_, i) => (
        <rect
          key={i}
          x={1.5 + i * (w + gap)}
          y={y}
          width={w}
          height={h}
          rx={1.6}
          fill="currentColor"
          fillOpacity={0.18}
        />
      ))}
      {plus ? <path d="M10 7.5v5M7.5 10h5" /> : null}
    </Glyph>
  );
}

// The rows the Layout tiles add (their height and slots are dashboard-drop DASHBOARD_LAYOUT_ROWS').
export const DASHBOARD_ROW_TILES = [
  {
    id: 'row-metrics',
    caption: 'Metrics Row',
    slots: 4,
    glyphH: 6,
    description: 'Four short slots side by side, for metrics: counts, completion, due soon.',
  },
  {
    id: 'row-charts',
    caption: 'Chart Row',
    slots: 2,
    glyphH: 10,
    description: 'Two slots side by side, for charts, a small board or sheet, or notes.',
  },
  {
    id: 'row-board',
    caption: 'Board Row',
    slots: 1,
    glyphH: 15,
    description: 'One tall slot across the page, for a board or sheet to work in.',
  },
] as const;

export const DASHBOARD_LAYOUT_TILES: PaletteTileDef[] = [
  ...DASHBOARD_ROW_TILES.map((r): PaletteTileDef => ({
    id: `dashboard:${r.id}`,
    section: 'dashboard-layout',
    label: `Add ${r.caption}`,
    caption: r.caption,
    description: r.description,
    noTint: true,
    action: { type: 'shape', kind: 'plan-view', plan: `layout:${r.id}` },
    icon: <LayoutGlyph slots={r.slots} h={r.glyphH} />,
  })),
  {
    id: 'dashboard:slot',
    section: 'dashboard-layout',
    label: 'Add Slot',
    caption: 'Slot',
    description:
      'One more slot: drop it at either end of a row or between two slots, or between rows for a row of its own.',
    noTint: true,
    action: { type: 'shape', kind: 'plan-view', plan: 'layout:slot' },
    icon: <LayoutGlyph slots={1} h={12} plus />,
  },
];

// A Title drawn small: a heavy heading line over two light lines of description.
function TitleGlyph() {
  return (
    <Glyph size={18} units={20}>
      <path d="M3 6.5h11" strokeWidth={2.6} />
      <path d="M3 11.5h14M3 15h9" strokeOpacity={0.55} />
    </Glyph>
  );
}

// A Status drawn small: three lights, the first lit.
function StatusGlyph() {
  return (
    <Glyph size={18} units={20}>
      <circle cx={4.5} cy={10} r={2.6} fill="currentColor" />
      <circle cx={10} cy={10} r={2.6} strokeOpacity={0.55} />
      <circle cx={15.5} cy={10} r={2.6} strokeOpacity={0.55} />
    </Glyph>
  );
}

// A Checklist drawn small: two ticked rows over an open one.
function ChecklistGlyph() {
  return (
    <Glyph size={18} units={20}>
      <path d="M2.5 5.5l1.5 1.5 2.5-3M2.5 11l1.5 1.5 2.5-3" />
      <rect x={2.6} y={14.5} width={3.6} height={3.6} rx={0.8} strokeOpacity={0.55} />
      <path d="M9 5.5h8.5M9 11h8.5M9 16.3h6" strokeOpacity={0.55} />
    </Glyph>
  );
}

const KeyDateGlyph = lucideGlyph(lucideCalendar, 18);
const DiagramGlyph = lucideGlyph(lucideWorkflow, 18);
const LinksGlyph = lucideGlyph(lucideLink, 18);

// What each written card is called (the banner of a pressed tile, the picker, the slot menu).
export const DASHBOARD_CARD_NAMES: Record<DashboardCardKind, string> = {
  title: 'Title',
  status: 'Status',
  checklist: 'Checklist',
  'key-date': 'Key Date',
  links: 'Links',
};

const CARD_TILE_INFO: Record<DashboardCardKind, { description: string; icon: ReactNode }> = {
  title: {
    description: 'A big heading with a description, to name a section of the dashboard.',
    icon: <TitleGlyph />,
  },
  status: {
    description: 'On Track, At Risk or Off Track, with a line of why and when it last changed.',
    icon: <StatusGlyph />,
  },
  checklist: {
    description: 'Items ticked off right on the dashboard, with how many are done.',
    icon: <ChecklistGlyph />,
  },
  'key-date': {
    description: 'A date counted down to: “Launch in 12 days”, red once it has passed.',
    icon: <KeyDateGlyph />,
  },
  links: {
    description:
      'A short list of labelled links: the repo, the spec, the design, or this document’s tabs.',
    icon: <LinksGlyph />,
  },
};

// The cards a Dashboard takes besides a note (docs/specs/026-plan/plan-tabs.md "Cards"): written on the page itself
// rather than read from the document's work. The Title also sits in Layout, as a section's heading.
export const DASHBOARD_CARD_TILES: PaletteTileDef[] = DASHBOARD_CARD_KINDS.map((card) => ({
  id: `dashboard:card-${card}`,
  section: card === 'title' ? 'dashboard-layout' : 'dashboard-cards',
  label: `Add ${DASHBOARD_CARD_NAMES[card]}`,
  caption: DASHBOARD_CARD_NAMES[card],
  description: CARD_TILE_INFO[card].description,
  noTint: true,
  action: { type: 'shape', kind: 'plan-view', plan: dashboardCardChoice(card) },
  icon: CARD_TILE_INFO[card].icon,
}));

// Add to Slot's From a Sheet (docs/specs/026-plan/plan-tabs.md "Figures from a Sheet"): a figure read live from one of
// the document's Sheets. Not in any palette category (Plan shows none): Add to Slot reads them.
// Each figure's name, shared with its picture in an image export.
export { FORM_METRIC_NAMES, SHEET_METRIC_NAMES };
const SHEET_METRIC_LINES: Record<SheetMetricKind, string> = {
  figure: 'One cell’s value, large, with an optional target to measure it against.',
  summary: 'A column’s total, average, lowest, highest or count.',
  trend: 'A column’s latest number and how it moved from the one before.',
};
const SheetFigureGlyph = lucideGlyph(lucideHash, 18);
// A sum's sigma, and a line climbing to an arrow.
function SummaryGlyph() {
  return (
    <Glyph size={18} units={20}>
      <path d="M14.5 4.5h-9l5 5.5-5 5.5h9" />
    </Glyph>
  );
}
function TrendGlyph() {
  return (
    <Glyph size={18} units={20}>
      <path d="M2.5 14.5l5-5 3.5 3.5 6.5-6.5M12.5 6.5h5v5" />
    </Glyph>
  );
}
const SHEET_METRIC_GLYPHS: Record<SheetMetricKind, ReactNode> = {
  figure: <SheetFigureGlyph />,
  summary: <SummaryGlyph />,
  trend: <TrendGlyph />,
};
// A bar chart's three columns over its axis.
function SheetChartGlyph() {
  return (
    <Glyph size={18} units={20}>
      <path d="M3 3.5v13h14" />
      <path d="M7 13.5v-4M11 13.5v-8M15 13.5v-6" strokeWidth={2.2} />
    </Glyph>
  );
}
// A chart drawn from a Sheet's cells (plan-tabs.md "Sheet Chart"), its sheet and chart chosen as it is picked.
export const SHEET_CHART_NAME = 'Sheet Chart';
export const DASHBOARD_SHEET_TILES: PaletteTileDef[] = [
  ...SHEET_METRICS.map((metric): PaletteTileDef => ({
    id: `dashboard:sheet-${metric}`,
    section: 'dashboard-cards',
    label: `Add ${SHEET_METRIC_NAMES[metric]}`,
    caption: SHEET_METRIC_NAMES[metric],
    description: SHEET_METRIC_LINES[metric],
    noTint: true,
    action: { type: 'shape', kind: 'plan-view', plan: sheetMetricChoice(metric) },
    icon: SHEET_METRIC_GLYPHS[metric],
  })),
  {
    id: 'dashboard:sheet-chart',
    section: 'dashboard-cards',
    label: `Add ${SHEET_CHART_NAME}`,
    caption: SHEET_CHART_NAME,
    description: 'A bar, line or pie chart of a Sheet’s cells: one it already has, or a new one.',
    noTint: true,
    action: { type: 'shape', kind: 'plan-view', plan: SHEET_CHART_CHOICE },
    icon: <SheetChartGlyph />,
  },
];

// Add to Slot's Form Metrics (docs/specs/026-plan/plan-tabs.md "Form Metrics"): a figure from one of the document's
// forms, offered only while it has one. Not in any palette category: Add to Slot reads them.
const ResponsesGlyph = lucideGlyph(lucideClipboardList, 18);
const FormStatusGlyph = lucideGlyph(lucideCircleCheck, 18);
const ClosesGlyph = lucideGlyph(lucideCalendar, 18);
const FormLinkGlyph = lucideGlyph(lucideLink, 18);
// A list with a new dot at its corner.
function NewResponsesGlyph() {
  return (
    <Glyph size={18} units={20}>
      <path d="M4 6.5h8M4 10.5h8M4 14.5h6" />
      <circle cx="15.5" cy="5" r="2.2" fill="currentColor" />
    </Glyph>
  );
}
// A bar filled part way to its end.
function LimitGlyph() {
  return (
    <Glyph size={18} units={20}>
      <rect x="2.5" y="8" width="15" height="4.5" rx="2.25" />
      <path d="M5 10.25h6" strokeWidth={2.4} />
    </Glyph>
  );
}
const FORM_METRIC_GLYPHS: Record<FormMetricKind, ReactNode> = {
  responses: <ResponsesGlyph />,
  new: <NewResponsesGlyph />,
  status: <FormStatusGlyph />,
  limit: <LimitGlyph />,
  closes: <ClosesGlyph />,
  link: <FormLinkGlyph />,
};
export const DASHBOARD_FORM_TILES: PaletteTileDef[] = FORM_METRICS.map(
  (metric): PaletteTileDef => ({
    id: `dashboard:form-${metric}`,
    section: 'dashboard-cards',
    label: `Add ${FORM_METRIC_NAMES[metric]}`,
    caption: FORM_METRIC_NAMES[metric],
    description: FORM_METRIC_LINES[metric],
    noTint: true,
    action: { type: 'shape', kind: 'plan-view', plan: formMetricChoice(metric) },
    icon: FORM_METRIC_GLYPHS[metric],
  }),
);

// The Tabs category's tiles (docs/specs/026-plan/plan-tabs.md "The Tabs category"): one per Board, Sheet or Diagram tab, named
// for it, that shows the tab in a slot, live (a `tab:` choice, which only a Dashboard takes).
export function dashboardTabTiles(tabs: readonly PlanTabEntry[]): PaletteTileDef[] {
  return tabs.map((t) => ({
    id: `dashboard-tab:${t.id}`,
    section: 'dashboard-tabs',
    label: `Show ${t.name}`,
    caption: t.name,
    description:
      t.of === 'board'
        ? `The ${t.name} tab’s board, live in a slot: its cards worked on right here.`
        : t.of === 'sheet'
          ? `The ${t.name} tab’s sheet, live in a slot: its cells edited right here.`
          : `The ${t.name} tab’s drawing, live in a slot: press it to open the tab.`,
    noTint: true,
    action: { type: 'shape', kind: 'plan-view', plan: dashboardTabChoice(t.of, t.id) },
    icon:
      t.of === 'board' ? (
        <PlanIcon size={18} />
      ) : t.of === 'sheet' ? (
        <SheetArt size={18} />
      ) : (
        <DiagramGlyph />
      ),
  }));
}
