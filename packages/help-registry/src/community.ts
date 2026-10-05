// The Community's two help articles (docs/specs/025-community/community.md "Help"), for the surfaces that deep link
// them without loading the whole registry: the Community app and the landing page. Each is the article's absolute
// path and the telemetry `type` a click on it sends (`UI·Opened·<id>`, as every help deep link does). The registry
// test checks both still name registered articles.

export const COMMUNITY_HELP = {
  // Sharing to the Community: publishing, editing, removing, and what happens when a post is hidden.
  sharing: { href: '/help/collaboration/sharing/community/', telemetryId: 'community' },
  // Finding Documents in the Community: searching, My Shares, liking, copying and reporting.
  finding: {
    href: '/help/collaboration/sharing/finding-community-documents/',
    telemetryId: 'finding-community-documents',
  },
} as const;

export type CommunityHelpArticle = keyof typeof COMMUNITY_HELP;
