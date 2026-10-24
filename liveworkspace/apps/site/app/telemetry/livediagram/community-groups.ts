// livediagram's Community tab charts (docs/specs/025-community/community.md "Telemetry"), apart from
// CommunityView so the app's config can name them without loading the view.

import type { MetricGroup } from '../_shared/MetricCards';
import {
  COMMUNITY_COPIES,
  COMMUNITY_DISCOVERY,
  COMMUNITY_FILTERS,
  COMMUNITY_MODERATION,
  COMMUNITY_PUBLISHING,
  COMMUNITY_LIKES,
  COMMUNITY_POSTS_OPENED,
  COMMUNITY_POSTS_SHARED,
  COMMUNITY_REPORTS,
  COMMUNITY_SEARCHES,
} from './metric-catalogue';

// Headline cards for what goes in and what people do with it, then the stacks the Dashboard leaves out.
export const COMMUNITY_GROUPS: MetricGroup[] = [
  {
    title: 'Community',
    metrics: [
      COMMUNITY_POSTS_SHARED,
      COMMUNITY_POSTS_OPENED,
      COMMUNITY_LIKES,
      COMMUNITY_COPIES,
      COMMUNITY_SEARCHES,
      COMMUNITY_FILTERS,
      COMMUNITY_REPORTS,
    ],
  },
  // The stacks the Dashboard leaves out (it keeps Community Engagement).
  {
    title: 'Publishing, discovery and reports',
    metrics: [COMMUNITY_PUBLISHING, COMMUNITY_DISCOVERY, COMMUNITY_MODERATION],
  },
];
