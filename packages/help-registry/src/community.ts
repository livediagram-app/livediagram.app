// The Community's two help articles (docs/specs/025-community/community.md "Help"), for the surfaces that deep link
// them without loading the whole registry: the Community app, the landing page, and the editor's help map. Each is
// the article's path under /help, its absolute link, and the telemetry `type` a click on it sends (`UI·Opened·<id>`,
// as every help deep link does). The registry test checks both still name registered articles.

const SHARING_PATH = 'collaboration/sharing/community';
const FINDING_PATH = 'collaboration/sharing/finding-community-documents';

export const COMMUNITY_HELP = {
  // Sharing to the Community: publishing, editing, removing, and what happens when a post is hidden.
  sharing: { path: SHARING_PATH, href: `/help/${SHARING_PATH}/`, telemetryId: 'community' },
  // Finding Documents in the Community: searching, My Shares, liking, copying and reporting.
  finding: {
    path: FINDING_PATH,
    href: `/help/${FINDING_PATH}/`,
    telemetryId: 'finding-community-documents',
  },
} as const;

export type CommunityHelpArticle = keyof typeof COMMUNITY_HELP;
