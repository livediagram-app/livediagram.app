// The knowledge routes' wire shapes (docs/specs/015-api/api.md "Knowledge"; docs/specs/030-knowledgebase): search,
// backlinks, a page's verification, the knowledgebase's summary, Ask, its settings and the AI Knowledge tab. Types
// only: the engine and its limits are `@liveknowledge/knowledge`.

/** A page's verified state, worked out when read (verification.md "States"). */
export type KnowledgeTrustState = 'verified' | 'review-due' | 'never-verified';
export type KnowledgeReviewEvery = 30 | 90 | 180 | 365 | 'never';

/** One search result: a page's title row, or a passage of its writing. `titleMarked` and `snippet` wrap each
 *  matched word in U+0002 and U+0003, so a client marks them without parsing HTML. */
export type KnowledgeSearchResult = {
  id: string;
  tab: string;
  isTitle: boolean;
  title: string;
  titleMarked: string;
  headings: string[];
  snippet: string;
  firstBlock: string;
  lastBlock: string;
  trust: KnowledgeTrustState;
  verifiedAt?: number;
  /** For an agent (an API token, the MCP, the CLI): the passage whole, when its page's review is or was due, and
   *  the pages an open conflict sets this passage against. */
  text?: string;
  reviewAt?: number;
  conflictsWith?: KnowledgePageRef[];
};
export type KnowledgeSearchResponse = { results: KnowledgeSearchResult[] };

/** A page by its id and current title. */
export type KnowledgePageRef = { tab: string; title: string };

/** A page that links here (links-and-embeds.md "Backlinks"), in tree order. */
export type KnowledgeBacklink = { tab: string; title: string };
export type KnowledgeBacklinksResponse = { backlinks: KnowledgeBacklink[] };

/** A page's knowledge fields with what is worked out from them. */
export type PageKnowledge = {
  tab: string;
  owner?: string;
  verifiedAt?: number;
  verifiedBy?: string;
  /** Absent is the default, 90 days. */
  reviewEvery?: KnowledgeReviewEvery;
  context?: true;
  state: KnowledgeTrustState;
  /** When the review comes due; absent for a page never verified or one that does not age. */
  reviewAt?: number;
  /** More than a fifth of the writing changed since it was verified. */
  changedSinceVerified: boolean;
  /** The page's size against the Always in Context budget. */
  tokens: number;
};
export type PageKnowledgeResponse = { knowledge: PageKnowledge };
/** Page Health (verification.md): the fields, and the reads of the last seven days. */
export type PageHealthResponse = PageKnowledgeResponse & {
  reads: { people: number; agents: number };
};
/** `PUT .../pages/<tab>/knowledge`: each field optional; `owner: null` clears it. */
export type PageKnowledgePatch = {
  owner?: string | null;
  reviewEvery?: KnowledgeReviewEvery;
  context?: boolean;
};

export type KnowledgeHealthCounts = {
  verified: number;
  reviewDue: number;
  neverVerified: number;
  total: number;
};
export type KnowledgeRecentPage = { tab: string; title: string; updatedAt: number };
/** `GET .../summary` (knowledgebase-home.md): what Home shows of one knowledgebase. */
export type KnowledgeSummaryResponse = {
  pages: number;
  health: KnowledgeHealthCounts;
  recent: KnowledgeRecentPage[];
};

/** `GET .../ai` (search-and-ask.md "Ask"): never the key, only whether one is set and its last characters. */
export type KnowledgeAiSettings = {
  hasKey: boolean;
  keyHint: string;
  model: string;
  models: { id: string; label: string }[];
};

export type AskTurn = { question: string; answer: string };
export type AskRequest = { question: string; turns?: AskTurn[] };
/** A passage an answer cites, or one it found and set aside. */
export type AskSource = {
  number: number;
  passageId: string;
  tab: string;
  title: string;
  headings: string[];
  text: string;
  trust: KnowledgeTrustState;
  verifiedAt?: number;
  firstBlock: string;
  lastBlock: string;
};
export type AskNotUsed = AskSource & { reason: string };
/** Ask answers as server-sent events, in this order: `delta` (the answer's next piece), then one `done`; or one
 *  `error` in place of either. */
export type AskEvent =
  | { type: 'delta'; text: string }
  | {
      type: 'done';
      text: string;
      sources: AskSource[];
      notUsed: AskNotUsed[];
      gaps: string[];
      model: string;
    }
  | { type: 'error'; kind: string; message: string };

export type KnowledgeAgent = {
  name: string;
  /** Pages read in the last seven days. */
  readsThisWeek: number;
  /** The pages it read most this week, at most three. */
  topPages: { tab: string; title: string }[];
};
export type KnowledgeQuestion = {
  key: string;
  question: string;
  asked: number;
  /** Asks by people: a count of asks, not of distinct people (no asker's identity is kept). */
  byPeople: number;
  agents: { name: string; asked: number }[];
  lastAt: number;
};
export type KnowledgeConflictSide = {
  passageId: string;
  tab: string;
  title: string;
  text: string;
  trust: KnowledgeTrustState;
  verifiedAt?: number;
};
export type KnowledgeConflict = {
  id: string;
  question: string;
  a: KnowledgeConflictSide;
  b: KnowledgeConflictSide;
  foundAt: number;
};
/** An agent's edit waiting for an Editor (ai-knowledge.md "Edits suggested by agents"): a passage of the page's
 *  Markdown (`before`) replaced by `after`, or `after` appended to the page (`before` is then empty). */
export type KnowledgeSuggestion = {
  id: string;
  tab: string;
  title: string;
  agent: string;
  /** Why, in the agent's words; `summary` is its first line, for a card's heading. */
  reason: string;
  summary: string;
  kind: 'replace' | 'append';
  before: string;
  after: string;
  createdAt: number;
};
export type KnowledgeSuggestionsResponse = { suggestions: KnowledgeSuggestion[] };
/** `POST .../pages/<tab>/suggestions`: `before` absent or empty appends `after` to the page. */
export type SuggestEditRequest = { reason: string; after: string; before?: string };
export type SuggestEditResponse = { suggestion: KnowledgeSuggestion; pending: number };
/** `POST .../suggestions/<id>/accept`: the page's new revision. */
export type AcceptSuggestionResponse = { tab: { id: string; rev: number } };

/** What an agent may do in a knowledgebase (knowledgebase-for-agents.md "Scopes"). */
export type AgentScope = 'read' | 'suggest' | 'write';

/** How far a page or passage can be trusted, as every agent answer carries it. `stale` is review due. */
export type KnowledgePageTrust = {
  state: KnowledgeTrustState;
  verifiedAt?: number;
  /** The verifier's name, where the api has one. */
  verifiedBy?: string;
  reviewAt?: number;
  stale: boolean;
  /** The pages an open conflict sets this one against. */
  conflictsWith?: KnowledgePageRef[];
};
/** One row of `GET .../pages`: the page tree in order. `depth` is 1 at the top level. */
export type KnowledgePageRow = KnowledgePageRef & {
  depth: number;
  parent?: string;
  subpages: number;
  /** The owner's account id. */
  owner?: string;
  context?: true;
  trust: KnowledgePageTrust;
};
export type KnowledgePagesResponse = { pages: KnowledgePageRow[] };
/** `GET .../pages/<tab>`: one page as Markdown, its page links by their current titles. `heading` and `maxChars`
 *  narrow it; `leftOut` counts the characters not sent and `headings` lists the page's sections. */
export type KnowledgePageRead = KnowledgePageRef & {
  rev: number;
  markdown: string;
  chars: number;
  leftOut: number;
  headings: string[];
  trust: KnowledgePageTrust;
  parent?: string;
  backlinks: KnowledgePageRef[];
  subpages: KnowledgePageRef[];
};
export type KnowledgePageReadResponse = { page: KnowledgePageRead };
/** `GET .../context`: the Always in Context pages as Markdown in tree order, within the budget, with what the
 *  caller may do here. */
export type KnowledgeAgentContextResponse = {
  name: string;
  role: 'edit' | 'participate' | 'view';
  scopes: AgentScope[];
  budget: number;
  tokens: number;
  pages: (KnowledgePageRef & { markdown: string; tokens: number; trust: KnowledgePageTrust })[];
  leftOut: (KnowledgePageRef & { tokens: number })[];
  pageCount: number;
};
/** `POST .../pages`: a new page from Markdown, under `parent` (a page's id or title; the top level when absent). */
export type CreatePageRequest = {
  title: string;
  markdown?: string;
  parent?: string;
  /** An import's own id for the page (a UUID), minted before its first page is written. */
  id?: string;
  /** Titles the Markdown may link to with `[[Title]]` beside the knowledgebase's own pages, each with its page's id:
   *  an import's pages, some not written yet. */
  pageIds?: Record<string, string>;
};
export type CreatePageResponse = { page: KnowledgePageRef & { parent?: string; rev: number } };
/** `PUT .../pages/<tab>`: the page's writing replaced by the Markdown, or the Markdown added after it. Answers as
 *  the article write does (`PagesAnswer`). */
export type WritePageRequest = { markdown: string; mode?: 'replace' | 'append' };
/** `POST .../pages/<tab>/move`: under `parent` (a page's id or title; null for the top level), before its subpage
 *  `before` (last when absent). With `before` and no `parent`, under that page's own parent. */
export type MovePageRequest = { parent?: string | null; before?: string };
export type MovePageResponse = { page: KnowledgePageRef & { parent?: string; depth: number } };
/** `PUT .../agents/<tokenId>/scopes`: what one API token may do in this knowledgebase. */
export type AgentScopesRequest = { scopes: AgentScope[] };
export type AgentScopesResponse = { tokenId: string; scopes: AgentScope[] };
export type KnowledgeContextPage = { tab: string; title: string; tokens: number };
/** `GET .../knowledge`: the AI Knowledge tab (ai-knowledge.md). */
export type KnowledgeOverviewResponse = {
  agents: KnowledgeAgent[];
  questions: KnowledgeQuestion[];
  conflicts: KnowledgeConflict[];
  suggestions: KnowledgeSuggestion[];
  context: { budget: number; used: number; pages: KnowledgeContextPage[] };
  health: KnowledgeHealthCounts;
  hasKey: boolean;
};
/** `POST .../questions`: an agent's `report_gap`. */
export type ReportGapRequest = { question: string };
