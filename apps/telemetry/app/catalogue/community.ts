// The Community (docs/specs/025-community/community.md "Telemetry"; docs/specs/017-telemetry/telemetry.md).
// Part of the metric catalogue: import from ../metric-catalogue.

import { COMMUNITY_CATEGORIES } from '@livediagram/api-schema';
import type { MetricStack } from '../metric-series';
import { chart } from './helpers';

// The category types a published or edited post sends (`Community·Shared|Changed·<Category>`).
// `Community·Changed` also carries the Moderation page's `Hidden` / `Listed`, so the edit chart
// counts only the category types and the moderation charts only their own. Not exported: every
// export here is a chart (the catalogue is read as a list of them).
const COMMUNITY_CATEGORY_TYPES: readonly string[] = COMMUNITY_CATEGORIES.map((c) => c.type);

// Publishing, from the editor's Share dialog.
export const COMMUNITY_POSTS_SHARED = chart(
  'Community',
  'Shared',
  'Posts Shared',
  'Someone shared a document to the Community, in any category.',
);

export const COMMUNITY_LISTINGS_EDITED = chart(
  'Community',
  'Changed',
  'Listings Edited',
  "Someone saved changes to their post's title, description, category or tags.",
  { types: COMMUNITY_CATEGORY_TYPES },
);

export const COMMUNITY_POSTS_REMOVED = chart(
  'Community',
  'Removed',
  'Posts Removed',
  'Someone took their own post down from the Community.',
  { rising: 'neutral' },
);

// Engagement, in the Community app.
export const COMMUNITY_POSTS_OPENED = chart(
  'Community',
  'Opened',
  'Posts Opened',
  "Someone opened a post's own page in the Community.",
);

export const COMMUNITY_LIKES = chart(
  'Community',
  'Liked',
  'Likes',
  'Someone liked a post in the Community.',
);

export const COMMUNITY_UNLIKES = chart(
  'Community',
  'Unliked',
  'Likes Taken Back',
  'Someone took back a like they had given a post.',
  { rising: 'neutral' },
);

export const COMMUNITY_COPIES = chart(
  'Community',
  'Copied',
  'Copies Made',
  'Someone pressed Make a Copy on a post to start their own document from it.',
);

// Discovery: how people look for boards. Only the kind of filter, never what was typed or picked.
export const COMMUNITY_SEARCHES = chart(
  'Community',
  'Searched',
  'Community Searches',
  'Someone searched the Community gallery. Never what they typed.',
);

export const COMMUNITY_FILTERS = chart(
  'Community',
  'Selected',
  'Gallery Filters Picked',
  'Someone narrowed or reordered the gallery: picked a category, a tag or a sort order.',
);

// Moderation: reports in, and the operator's decisions on the Moderation page.
export const COMMUNITY_REPORTS = chart(
  'Community',
  'Reported',
  'Posts Reported',
  'Someone reported a post, for spam, offensive content, personal information, copyright or something else.',
  { rising: 'bad' },
);

export const COMMUNITY_HIDDEN = chart(
  'Community',
  'Changed',
  'Posts Hidden',
  'An operator hid a reported post from the Community on the Moderation page.',
  { types: ['Hidden'], rising: 'neutral' },
);

export const COMMUNITY_RELISTED = chart(
  'Community',
  'Changed',
  'Posts Listed Again',
  'An operator put a reported post back in the Community on the Moderation page.',
  { types: ['Listed'], rising: 'neutral' },
);

export const COMMUNITY_PUBLISHING: MetricStack = {
  stack: true,
  title: 'Community Publishing',
  blurb: 'Documents shared to the Community, listings edited, and posts taken down.',
  headline: COMMUNITY_POSTS_SHARED,
  members: [COMMUNITY_POSTS_SHARED, COMMUNITY_LISTINGS_EDITED, COMMUNITY_POSTS_REMOVED],
  seeAlso: { view: 'community', label: 'See Each Category on the Community Tab' },
};

export const COMMUNITY_ENGAGEMENT: MetricStack = {
  stack: true,
  title: 'Community Engagement',
  blurb: 'Posts opened, liked and copied: whether shared boards get read and reused.',
  headline: COMMUNITY_POSTS_OPENED,
  members: [COMMUNITY_POSTS_OPENED, COMMUNITY_LIKES, COMMUNITY_UNLIKES, COMMUNITY_COPIES],
  seeAlso: { view: 'community', label: 'See the Community Tab' },
};

export const COMMUNITY_DISCOVERY: MetricStack = {
  stack: true,
  title: 'Community Discovery',
  blurb: 'How people look for boards in the gallery: searching, and picking filters.',
  members: [COMMUNITY_SEARCHES, COMMUNITY_FILTERS],
  seeAlso: { view: 'community', label: 'See Each Filter on the Community Tab' },
};

export const COMMUNITY_MODERATION: MetricStack = {
  stack: true,
  rising: 'bad',
  title: 'Community Moderation',
  blurb: 'Posts reported, and what an operator decided: hidden, or listed again.',
  headline: COMMUNITY_REPORTS,
  members: [COMMUNITY_REPORTS, COMMUNITY_HIDDEN, COMMUNITY_RELISTED],
  seeAlso: { view: 'community', label: 'See Each Reason on the Community Tab' },
};
