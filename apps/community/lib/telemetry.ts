import { siteTrack } from '@livediagram/telemetry-client';

// Anonymous, first-party telemetry for the Community app (docs/specs/025-community/community.md
// "Telemetry"; docs/specs/017-telemetry/telemetry.md). The public sites' shared siteTrack(), the same
// instance PageViewBoot reports page views through, so the app runs one buffer. Every event is
// category `Community`; `type` is always a preset value, never post content (no titles, no tags, no
// search text).

export type CommunitySelection = 'Category' | 'Tag' | 'Sort';

export const communityTelemetry = {
  openedPost: () => siteTrack('Community', 'Opened', 'Post'),
  likedPost: () => siteTrack('Community', 'Liked', 'Post'),
  unlikedPost: () => siteTrack('Community', 'Unliked', 'Post'),
  copiedPost: () => siteTrack('Community', 'Copied', 'Post'),
  // `reasonType` is the reason's PascalCase type from COMMUNITY_REPORT_REASONS.
  reported: (reasonType: string) => siteTrack('Community', 'Reported', reasonType),
  searched: () => siteTrack('Community', 'Searched', 'Query'),
  selected: (what: CommunitySelection) => siteTrack('Community', 'Selected', what),
};
