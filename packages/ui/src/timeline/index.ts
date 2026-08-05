// Timeline components (spec/138 §7). Product-agnostic: they lay a feed
// out and know nothing about diagrams, teams, or routes. The consumer
// supplies a renderer registry keyed by source type.
//
// The controls and the feed are separate exports on purpose — the host
// puts the controls in its own page-header row and the feed in the
// body, sharing one `useTimelineControls()` state between them.

export { Timeline, type TimelineProps } from './Timeline';
export { TimelineControls } from './TimelineControls';
export {
  useTimelineControls,
  type TimelineControls as TimelineControlsState,
} from './useTimelineControls';
export { TimelineBubble } from './TimelineBubble';
export { TimelineGroup } from './TimelineGroup';
export { StackedBubble } from './StackedBubble';
export { ExpandedStack } from './ExpandedStack';
export { TimelineCalendarView } from './TimelineCalendarView';
export { SourceTypeIcon, fallbackRenderer, pickRenderer } from './renderers';
export { TONE_LABELS, eventTone, toneColor, toneSoftColor, type TimelineTone } from './eventTone';
export {
  CATEGORY_LABELS,
  eventCategory,
  sortCategories,
  type TimelineCategory,
} from './eventCategory';
export { buildStacks, bucketFor, stackLabel, type TimelineStack } from './stacking';
export {
  dateKey,
  groupByDay,
  timeLabel,
  useTimelineGrouping,
  type TimelineDayGroup,
} from './useTimelineGrouping';
export {
  buildMonthCells,
  buildWeekCells,
  formatMonth,
  formatWeek,
  monthKeyOf,
  nearestPopulatedMonth,
  shiftMonth,
  shiftWeek,
  weekStartOf,
  type MonthCell,
} from './monthCells';
export { SOURCE_TYPE_LABELS, sourceTypeIconPath, sourceTypeLabel } from './sourceTypeMeta';
export type {
  TimelineBubbleAction,
  TimelineBubbleRender,
  TimelineEvent,
  TimelineMode,
  TimelineRenderer,
  TimelineRendererContext,
  TimelineRendererRegistry,
} from './types';
