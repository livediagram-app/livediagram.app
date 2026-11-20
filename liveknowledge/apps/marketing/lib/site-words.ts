// What liveknowledge is, in the words this site uses (docs/specs/019-marketing/marketing-site.md "SEO and
// metadata"): the landing page's title and description (also the web app manifest's), the pitch line the social
// card and the share images' alt text build on, and the hero's headline. Kept in one place so they cannot drift
// between the page, its metadata and its card.
//
// @liveknowledge/ui still carries the fork's words (SITE_TITLE, SITE_DESCRIPTION, SITE_PITCH), which the help
// centre and the editor's share rail read; these belong there once that package is free to change.

export const PITCH_LINE = 'A team knowledgebase, for people and for AI.';

// Lower case, without its full stop: it follows "liveknowledge: " in a title and an image's alt text.
export const SITE_PITCH = 'a team knowledgebase, for people and for AI';

export const SITE_TITLE = 'liveknowledge: A team knowledgebase, for people and for AI';

export const SITE_DESCRIPTION =
  'A free, open-source team knowledgebase. Pages with owners and verified dates, cited answers on your own Claude key, and an MCP server your agents read.';

export const HERO_HEADLINE = 'The knowledgebase your team and its AI both trust.';
