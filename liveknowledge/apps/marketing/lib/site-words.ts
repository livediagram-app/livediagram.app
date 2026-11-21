// What liveknowledge is, in the words this site uses (docs/specs/019-marketing/marketing-site.md "SEO and
// metadata"): the landing page's title and description (also the web app manifest's), the pitch line the social
// card and the share images' alt text build on, and the hero's headline. Kept in one place so they cannot drift
// between the page, its metadata and its card.
//
// @liveknowledge/ui/site carries the same title, description and pitch for the editor and its share rail.

export const PITCH_LINE = 'A team knowledgebase, for people and for AI.';

// Lower case, without its full stop: it follows "liveknowledge: " in a title and an image's alt text.
export const SITE_PITCH = 'a team knowledgebase, for people and for AI';

export const SITE_TITLE = 'liveknowledge: A team knowledgebase, for people and for AI';

export const SITE_DESCRIPTION =
  'An open-source team knowledgebase. Pages with owners and verified dates, cited answers on your own Claude or OpenAI key, and an MCP server your agents read.';

export const HERO_HEADLINE = 'Knowledge your team and its AI can trust.';

// The hero's lead: one sentence (owner, 2026-11-21: "the description is too long").
export const HERO_LEAD =
  'A team knowledgebase where every page has an owner and a verified date, and every answer names its source.';
