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
/** A page of the caller's own that is due for review: `reviewAt` is when it came due (ms). */
export type KnowledgeDuePage = { tab: string; title: string; reviewAt: number };
/** `GET .../summary` (knowledgebase-home.md): what Home shows of one knowledgebase. `yoursToReview` is the caller's
 *  own pages whose review is due, oldest first, ten at most; empty for a caller with no account. */
export type KnowledgeSummaryResponse = {
  pages: number;
  health: KnowledgeHealthCounts;
  recent: KnowledgeRecentPage[];
  yoursToReview: KnowledgeDuePage[];
};

/** Whose API a knowledgebase's key is for (search-and-ask.md "Providers"). */
export type KnowledgeAiProvider = 'anthropic' | 'openai';
/** `GET .../ai` (search-and-ask.md "Ask", "Providers"): never the key, only whether one is set, whose it is and
 *  its last characters. `models` are the stored provider's; `providers` are the two a team may choose between. */
export type KnowledgeAiSettings = {
  provider: KnowledgeAiProvider;
  hasKey: boolean;
  keyHint: string;
  model: string;
  models: { id: string; label: string }[];
  providers: { id: KnowledgeAiProvider; label: string; keyPrefix: string }[];
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
  | { type: 'error'; kind: string; message: string; provider?: KnowledgeAiProvider };

/** `POST .../setup/suggest` (describe-to-set-up.md "The model"): what the knowledgebase is for and, when adding
 *  pages, the titles already there in tree order with their depth (1 is the top). */
export type KnowledgeSetupRequest = {
  description: string;
  existing?: { title: string; depth: number }[];
};
/** One proposed page. `parent` is the `id` of a page earlier in the list, or null at the top; `depth` is 1 to 3. */
export type KnowledgeSetupPage = {
  id: string;
  title: string;
  summary: string;
  headings: string[];
  parent: string | null;
  depth: number;
};
/** A proposed structure: a name for the knowledgebase and up to 30 pages in tree order. Plain text throughout. */
export type KnowledgeSetupSuggestion = { name: string; pages: KnowledgeSetupPage[] };

/** How an agent connects: the MCP server, the command line, or an API token used directly. */
export type KnowledgeAgentDoor = 'mcp' | 'cli' | 'token';
/** One connection of AI Knowledge's Connected Agents (ai-knowledge.md "Connected agents"). What the room knows of
 *  the token behind it (`door`, `scopes`, `lastSeenAt`, `canHoldWrite`) is absent for an agent counted only by its
 *  reads, before the room kept its token. */
export type KnowledgeAgent = {
  /** A stable id for the row: a hash, never the token or its id. */
  id: string;
  name: string;
  door?: KnowledgeAgentDoor;
  /** What the connection holds in this knowledgebase now: its token's kind, what an Editor granted it here, and
   *  the role of the person it acts for. */
  scopes?: AgentScope[];
  /** When it last called a knowledge route here, to the hour. */
  lastSeenAt?: number;
  /** Whether granting `write` would let it write: a full token acting for an Editor. */
  canHoldWrite?: boolean;
  /** The token's id, as `PUT agents/<tokenId>/scopes` takes it. Sent only to an Editor in person, who alone may
   *  call that route; it is an id, never the token. */
  tokenId?: string;
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
  /** The passage's first block on its page: where the page opens when this side is the one to fix. */
  firstBlock: string;
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
  /** When both pages' owners were emailed about it (Ask Both Owners): once a conflict. */
  askedAt?: number;
};
/** What `POST conflicts/<id>/ask-owners` and `POST knowledge/remind-owners` answer: what was sent, or why nothing
 *  was. `sent` counts the owners emailed of `owners` named; `no_recipients` is owners who turned the emails off,
 *  have no verified address or can no longer open the knowledgebase; `daily_limit` the knowledgebase's ceiling of
 *  emails a day; `unavailable` a deployment that sends no email. */
export type KnowledgeEmailResult =
  | { outcome: 'sent'; sent: number; owners: number }
  | { outcome: 'already_sent'; sentAt: number; nextAt?: number }
  | { outcome: 'no_owners' | 'nothing_due' | 'unavailable' | 'daily_limit' | 'no_recipients' };
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
  /** The Knowledgebase Reviews emails: whether this deployment sends email, and when the owners were last
   *  reminded (Remind the Owners is once a week). */
  reviewEmails: { available: boolean; remindedAt?: number };
};
/** `POST .../questions`: an agent's `report_gap`. */
export type ReportGapRequest = { question: string };
