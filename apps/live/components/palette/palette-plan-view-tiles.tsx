// The plan view tiles (docs/specs/025-plan/plan-views.md): a metric per read-out widget kind and a
// tile per visualisation, each placing a 'plan-view' element whose `plan` choice is the view id. Made from
// the view catalogue, so a new view is a tile with no edit here. Spread into PALETTE_TILES via PLAN_TILES.
import {
  METRIC_KINDS,
  PLAN_VISUALISATIONS,
  PLAN_VISUALISATION_LABELS,
  type MetricKind,
  type PlanVisualisation,
} from '@livediagram/items';
import { BoardWidgetArt } from '@/components/plan/plan-tile-art';
import { PlanViewArt } from '@/components/plan/plan-view-art';
import { BOARD_WIDGET_INFO } from '@/components/plan/board-widget-catalogue';
import type { PaletteTileDef } from './palette-tile-defs';

const GLYPH_PX = 18;

const VISUALISATION_INFO: Record<PlanVisualisation, { caption: string; description: string }> = {
  gantt: {
    caption: 'Gantt Chart',
    description:
      'Every Project card on a timeline, from its start to its due date, with its cards’ progress.',
  },
  calendar: {
    caption: 'Due Calendar',
    description: 'This month as a calendar, each day listing the cards due then.',
  },
  workload: {
    caption: 'Workload',
    description:
      'A bar per person of the cards they have, split by not started, in progress and done.',
  },
  'status-mix': {
    caption: 'Status Breakdown',
    description: 'A donut of every card by status, with each status’s count.',
  },
  'priority-matrix': {
    caption: 'Priority Matrix',
    description: 'How many cards of each priority are not started, in progress and done.',
  },
};

// What each metric reads out, over every live card in the document.
const METRIC_DESCRIPTIONS: Record<MetricKind, string> = {
  count: 'A metric over every card in the document: how many there are.',
  progress: 'A metric over every card in the document: the share that is done.',
  people: 'A metric over every card in the document: who has cards, most first.',
  types: 'A metric over every card in the document: how many of each type.',
  priorities:
    'A metric over every card in the document: how many are urgent, high, medium and low.',
  due: 'A metric over every card in the document: overdue, and due in the next 7 days.',
  unassigned: 'A metric over every card in the document: the cards nobody has picked up.',
  points: 'A metric over every card in the document: estimate points done out of all.',
  'top-voted': 'A metric over every card in the document: the most voted card; press it to open.',
  stale: 'A metric over every card in the document: cards not done and unchanged in two weeks.',
};

export const PLAN_VIEW_TILES: PaletteTileDef[] = [
  ...METRIC_KINDS.map((w): PaletteTileDef => ({
    id: `plan:view-metric-${w}`,
    section: 'plan-metrics',
    label: `Add ${BOARD_WIDGET_INFO[w].label} Metric`,
    caption: BOARD_WIDGET_INFO[w].label,
    description: METRIC_DESCRIPTIONS[w],
    noTint: true,
    action: { type: 'shape', kind: 'plan-view', plan: `metric:${w}` },
    icon: <BoardWidgetArt kind={w} size={GLYPH_PX} />,
  })),
  ...PLAN_VISUALISATIONS.map((v): PaletteTileDef => ({
    id: `plan:view-${v}`,
    section: 'plan-visualisations',
    label: `Add ${PLAN_VISUALISATION_LABELS[v]}`,
    caption: VISUALISATION_INFO[v].caption,
    description: VISUALISATION_INFO[v].description,
    noTint: true,
    action: { type: 'shape', kind: 'plan-view', plan: v },
    icon: <PlanViewArt view={v} size={GLYPH_PX} />,
  })),
];
