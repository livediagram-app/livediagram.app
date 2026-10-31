// Every app's Community help articles (liveworkspace/docs/specs/007-community/community.md "Every app's Community"),
// for the surfaces that deep link them without loading a whole registry: the Community pages, the landing section and
// an editor's help map. Each app's help centre keeps them at the same two addresses under Collaboration, Sharing. Each
// is the article's path under /help, its link, and the telemetry `type` a click on it sends (`UI·Opened·<id>`, as
// every help deep link does). Each app's registry test checks both still name its registered articles.

const SHARING_PATH = 'collaboration/sharing/community';
const FINDING_PATH = 'collaboration/sharing/finding-community-documents';

export const COMMUNITY_HELP = {
  // Sharing to the Community: publishing, editing, removing, and what happens when a post is hidden.
  sharing: { path: SHARING_PATH, href: `/help/${SHARING_PATH}/`, telemetryId: 'community' },
  // Finding work in the Community: searching, My Shares, liking, copying and reporting.
  finding: {
    path: FINDING_PATH,
    href: `/help/${FINDING_PATH}/`,
    telemetryId: 'finding-community-documents',
  },
} as const;

export type CommunityHelpArticle = keyof typeof COMMUNITY_HELP;
