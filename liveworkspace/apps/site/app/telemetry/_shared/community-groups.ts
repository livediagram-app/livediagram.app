import type { Metric, MetricGroup, MetricStack } from './metric-series';

// The Community tab's charts (liveworkspace/docs/specs/008-telemetry/telemetry.md "The dashboard", The tabs), the
// same shape for every app from its own catalogue: headline cards for what goes in and what people do with it,
// then the stacks.
export type CommunityCharts = {
  COMMUNITY_POSTS_SHARED: Metric;
  COMMUNITY_POSTS_OPENED: Metric;
  COMMUNITY_LIKES: Metric;
  COMMUNITY_COPIES: Metric;
  COMMUNITY_SEARCHES: Metric;
  COMMUNITY_FILTERS: Metric;
  COMMUNITY_REPORTS: Metric;
  COMMUNITY_PUBLISHING: MetricStack;
  COMMUNITY_ENGAGEMENT: MetricStack;
  COMMUNITY_DISCOVERY: MetricStack;
  COMMUNITY_MODERATION: MetricStack;
};

export const communityGroups = (c: CommunityCharts): MetricGroup[] => [
  {
    title: 'Community',
    metrics: [
      c.COMMUNITY_POSTS_SHARED,
      c.COMMUNITY_POSTS_OPENED,
      c.COMMUNITY_LIKES,
      c.COMMUNITY_COPIES,
      c.COMMUNITY_SEARCHES,
      c.COMMUNITY_FILTERS,
      c.COMMUNITY_REPORTS,
    ],
  },
  {
    title: 'Publishing, engagement, discovery and reports',
    metrics: [
      c.COMMUNITY_PUBLISHING,
      c.COMMUNITY_ENGAGEMENT,
      c.COMMUNITY_DISCOVERY,
      c.COMMUNITY_MODERATION,
    ],
  },
];
