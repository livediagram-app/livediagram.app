// Timeline components (spec/138 §7). Product-agnostic: they lay a feed
// out and know nothing about diagrams, teams, or routes. The consumer
// supplies a renderer registry keyed by source type.

export { Timeline, type TimelineProps } from './Timeline';
export { TimelineBubble } from './TimelineBubble';
export { TimelineGroup } from './TimelineGroup';
export { StackedBubble } from './StackedBubble';
export { TimelineCalendarView } from './TimelineCalendarView';
export { SourceTypeIcon, fallbackRenderer, pickRenderer } from './renderers';
export { buildStacks, bucketFor, stackLabel, type TimelineStack } from './stacking';
export {
  dateKey,
  groupByDay,
  useTimelineGrouping,
  type TimelineDayGroup,
} from './useTimelineGrouping';
export {
  buildMonthCells,
  formatMonth,
  monthKeyOf,
  nearestPopulatedMonth,
  shiftMonth,
  type MonthCell,
} from './monthCells';
export {
  SOURCE_TYPE_LABELS,
  sourceTypeColor,
  sourceTypeIconPath,
  sourceTypeLabel,
  sourceTypeSoftColor,
} from './sourceTypeMeta';
export type {
  TimelineBubbleAction,
  TimelineBubbleRender,
  TimelineEvent,
  TimelineMode,
  TimelineRenderer,
  TimelineRendererContext,
  TimelineRendererRegistry,
} from './types';
