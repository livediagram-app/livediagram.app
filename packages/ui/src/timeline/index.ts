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
export { TimelineCard } from './TimelineCard';
export { TimelineGroup } from './TimelineGroup';
export { StackedCard } from './StackedCard';
export { ExpandedStack } from './ExpandedStack';
export { TimelineCalendarView } from './TimelineCalendarView';
export { TimelineErrorState } from './TimelineErrorState';
export { SourceTypeIcon, fallbackRenderer, pickRenderer } from './renderers';
export { TONE_LABELS, eventTone, toneColor, toneSoftColor, type TimelineTone } from './eventTone';
export { isNewEvent } from './newness';
export {
  CATEGORY_LABELS,
  eventCategory,
  sortCategories,
  type TimelineCategory,
} from './eventCategory';
export { buildStacks, bucketFor, stackLabel, type TimelineStack } from './stacking';
export { collapseSameDayCreate } from './sameDayCreate';
export {
  dateKey,
  groupByDay,
  timeLabel,
  useTimelineGrouping,
  type TimelineDayGroup,
} from './useTimelineGrouping';
export { buildMonthCells, formatMonth, monthKeyOf, shiftMonth, type MonthCell } from './monthCells';
export { sourceTypeIconPath } from './sourceTypeMeta';
export type {
  TimelineCardRender,
  TimelineCardSlots,
  TimelineCardSlotsFor,
  TimelineEvent,
  TimelineMode,
  TimelineRenderer,
  TimelineRendererContext,
  TimelineRendererRegistry,
  TimelineStackSlotsFor,
} from './types';
