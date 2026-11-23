// The knowledge routes' wire shapes (docs/specs/015-api/api.md "Knowledge"; docs/specs/030-knowledgebase): search,
// backlinks, a page's verification, the knowledgebase's summary, Ask, its settings and the AI Knowledge tab. Types
// only: the engine and its limits are `@liveknowledge/knowledge`.

import type { KnowledgeStyle, PageApproval } from '@liveknowledge/document';
import type { AgentCover, AgentPageIcon } from './pages';

/** The Knowledgebase Style (docs/specs/030-knowledgebase/page-surface.md "Knowledgebase Style"): the one look every
 *  page is drawn in. In a document read (always whole), the `document-meta` op when it changed, and the metadata
 *  write (`PUT /api/documents/<id>`), which takes any of its fields and `accent: null` to clear a picked accent. */
export type KnowledgeStyleWire = KnowledgeStyle;
export type KnowledgeStyleWrite = Partial<Omit<KnowledgeStyle, 'accent'>> & {
  accent?: string | null;
};

/** A page's verified state, worked out when read (verification.md "States"). */
export type KnowledgeTrustState = 'verified' | 'review-due' | 'never-verified';
/** A page's trust as a reader is shown it: its state, or `off` where the knowledgebase's Review Period is Never and
 *  verification is off (verification.md "Under a Review Period of Never"): then no date and no `stale`. */
export type KnowledgeTrustShown = KnowledgeTrustState | 'off';
export type KnowledgeReviewEvery = 30 | 90 | 180 | 365 | 'never';
/** What a knowledgebase decides for every page (verification.md "The Review Period"): how long after it was last
 *  verified a page comes due for review. In a document read, the `document-meta` op and the routes below. */
export type KnowledgeSettingsWire = {
  reviewEvery: KnowledgeReviewEvery;
  labels?: KnowledgeLabelWire[];
};
/** One of the knowledgebase's labels (page-surface.md "Page labels"): its colour a standard colour's name ("blue")
 *  or a custom `#rrggbb`. Kept with the settings, so a rename is one write and no page's. */
export type KnowledgeLabelWire = { id: string; name: string; colour: string };
/** `GET .../labels`: the labels, most used first, each with how many pages carry it. */
export type KnowledgeLabelsResponse = { labels: (KnowledgeLabelWire & { pages: number })[] };
/** `POST .../labels`: a new label (no colour: the next one; no id: the api makes one). A Writer's. */
export type CreateLabelRequest = { name: string; colour?: string; id?: string };
/** `PUT .../labels/<label>`: a rename, a new colour, or both. A Writer's. */
export type UpdateLabelRequest = { name?: string; colour?: string };
/** What a label write answers: the label made or changed (absent after a delete), and every label now. */
export type KnowledgeLabelChangeResponse = {
  label?: KnowledgeLabelWire;
  labels: KnowledgeLabelWire[];
};
/** `PUT .../knowledge-settings`: Editor only. Answers the settings as stored. */
export type KnowledgeSettingsRequest = { reviewEvery: KnowledgeReviewEvery };
export type KnowledgeSettingsResponse = { knowledgeSettings: KnowledgeSettingsWire };
/** `GET .../knowledge-settings/preview?reviewEvery=`: how many pages are Review Due now and how many would be
 *  under the period asked about, so a dialog can say so before a shorter period is applied. */
export type KnowledgeSettingsPreviewResponse = {
  reviewEvery: KnowledgeReviewEvery;
  reviewDue: number;
  reviewDueNow: number;
};

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
  trust: KnowledgeTrustShown;
  verifiedAt?: number;
  /** For an agent (an API token, the MCP, the CLI): the passage whole, when its page's review is or was due, and
   *  the pages an open conflict sets this passage against. */
  text?: string;
  reviewAt?: number;
  conflictsWith?: KnowledgePageRef[];
  /** For an agent: the page's Health Score. */
  health?: KnowledgePageHealth;
};
export type KnowledgeSearchResponse = { results: KnowledgeSearchResult[] };

/** A page's Health Score (verification.md "Health Score"), as agents and Ask read it: 0 to 100, its word, the
 *  factor that lost the most, and each factor's points of its maximum with what would raise it when short. */
export type KnowledgeHealthLabel = 'healthy' | 'fair' | 'needs-work';
export type KnowledgeHealthFactorName =
  'verification' | 'freshness' | 'owner' | 'length' | 'structure' | 'links' | 'issues' | 'use';
export type KnowledgePageHealth = {
  score: number;
  label: KnowledgeHealthLabel;
  reason: string;
  factors: { factor: KnowledgeHealthFactorName; points: number; max: number; raise?: string }[];
};
/** The counts Page Health's read adds for the score, which the editor cannot see itself. */
export type PageHealthSignals = {
  openConflicts: number;
  openThreads: number;
  suggestions: number;
  backlinks: number;
};
/** One of Knowledge Health's pages with low health. */
export type KnowledgeLowHealthPage = {
  tab: string;
  title: string;
  score: number;
  label: KnowledgeHealthLabel;
  reason: string;
};

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
  context?: true;
  /** Asked for, approved or rejected (approval.md); absent for a page never asked about. */
  approval?: PageApproval;
  state: KnowledgeTrustState;
  /** When the review comes due under the knowledgebase's Review Period; absent for a page never verified or a
   *  knowledgebase whose period is Never. */
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
  /** The names of the accounts this page names (its creator, its last writer, its editors, its owner, who verified
   *  it), by account id, so every reader can name them (verification.md "Created and Updated"); absent when none has
   *  a name. */
  names?: Record<string, string>;
  /** Who made the page and who last saved it (verification.md "Created and Updated"), by account id; absent for a
   *  page not saved since the server began keeping them. */
  created?: PageAuthorStamp;
  updated?: PageAuthorStamp;
  /** Everyone who made or changed the page, the first writer first, 12 at most (page-surface.md "Who made the
   *  page"); `at` is when each first wrote it. Absent for a page not saved since the server began keeping them. */
  editors?: PageAuthorStamp[];
  /** The questions Ask answered citing this page in the last 30 days, the most asked first, 3 at most
   *  (ai-knowledge.md "AI Context on a page"). */
  answered?: PageAnsweredQuestion[];
  /** The agents that read this page in the last 7 days, the most reads first, 3 at most. */
  agents?: PageAgentReads[];
  /** What the Health Score counts that the editor cannot see itself; absent from an older api. */
  signals?: PageHealthSignals;
  /** Page Insights (ai-knowledge.md "Page Insights"); absent from an older api. */
  insights?: PageInsightsWire;
  /** The page's suggested edits waiting, newest first, the knowledgebase's cap at most (ai-knowledge.md "On the
   *  page"); absent from an older api. */
  suggestions?: KnowledgeSuggestion[];
  /** How many suggested edits wait on each page the reader may see, by page id, none at 0 (the tree's dots); absent
   *  from an older api. */
  suggestionCounts?: Record<string, number>;
};
/** A page's use: its reads by day over the last 30 days, oldest first, and how many times Ask cited it in that time
 *  (absent through a link confined to one page, which has no Ask). */
export type PageInsightsWire = { days: KnowledgeReadsDay[]; cited?: number };
/** One question answered from a page: the asker's words (the latest day's of like questions) and how many times. */
export type PageAnsweredQuestion = { question: string; asked: number };
/** One agent's reads of a page this week, by the agent's name. */
export type PageAgentReads = { agent: string; reads: number };
/** What kind of writer made a stamp (verification.md "Made by a person or an agent"). */
export type PageAuthorKind = 'human' | 'ai';
/** The door an agent's write came through; `suggestion` is an agent's suggestion a person accepted; `automation` a
 *  rule's step from another app, its `agent` the rule and the item it came from. */
export type PageAuthorVia = 'mcp' | 'cli' | 'api' | 'suggestion' | 'automation';
/** One stamp: the person (an agent's is its token's maker, or the Editor who accepted its suggestion), when, the
 *  kind, and an agent's name and door where they are known. */
export type PageAuthorStamp = {
  by: string;
  at: number;
  kind: PageAuthorKind;
  agent?: string;
  via?: PageAuthorVia;
};
/** `PUT .../pages/<tab>/knowledge`: each field optional; `owner: null` clears it. The Review Period is the
 *  knowledgebase's (`PUT .../knowledge-settings`): a `reviewEvery` here is refused. */
export type PageKnowledgePatch = {
  owner?: string | null;
  context?: boolean;
};

export type KnowledgeHealthCounts = {
  verified: number;
  reviewDue: number;
  neverVerified: number;
  total: number;
  /** The average Health Score of every page, a whole number; absent with no pages, and from an older api (and on
   *  Home's summary, which does not score). */
  average?: number;
};
export type KnowledgeRecentPage = { tab: string; title: string; updatedAt: number };
/** A page of the caller's own that is due for review: `reviewAt` is when it came due (ms). */
export type KnowledgeDuePage = { tab: string; title: string; reviewAt: number };
/** `GET .../summary` (knowledgebase-home.md): what Home shows of one knowledgebase. `yoursToReview` is the caller's
 *  own pages whose review is due, oldest first, ten at most; empty for a caller with no account. */
export type KnowledgeSummaryResponse = {
  pages: number;
  /** The knowledgebase's Review Period, which the counts and `yoursToReview` are worked out under. */
  reviewEvery: KnowledgeReviewEvery;
  health: KnowledgeHealthCounts;
  recent: KnowledgeRecentPage[];
  yoursToReview: KnowledgeDuePage[];
  /** Waiting for Your Approval (approval.md "Where it shows"): pages Pending Approval the caller did not ask for,
   *  oldest request first, ten at most; empty for a caller who may not decide. Absent from an older api. */
  awaitingApproval?: KnowledgeAwaitingPage[];
};
/** A page waiting for someone's approval: who asked (an account id, and an agent's name when one asked) and when. */
export type KnowledgeAwaitingPage = {
  tab: string;
  title: string;
  requestedBy: string;
  requestedAt: number;
  requestedByAgent?: string;
};

/** `POST .../pages/<tab>/approval` (approval.md): one action; `note` is a rejection's, up to 500 characters.
 *  Answers the page's knowledge as `PageKnowledgeResponse`. */
export type PageApprovalAction = 'request' | 'withdraw' | 'approve' | 'reject';
export type PageApprovalRequest = { action: PageApprovalAction; note?: string };

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
  /** Whether this deployment has built-in AI (search-and-ask.md "Built-in AI"): with no key, it answers. */
  builtIn: boolean;
  /** Which key answers the asker (search-and-ask.md "Which key answers"), and its model's id; on `GET ai` only, never
   *  in the overview. `usesModel` and its label are absent for built-in AI and for a key that will not open. */
  uses?: KnowledgeAiUses;
  usesModel?: string;
  /** `usesModel`'s name ("Claude Fable 5.2"), for "Answer With". */
  usesModelLabel?: string;
};
export type KnowledgeAiUses = 'knowledgebase' | 'team' | 'personal' | 'built-in';

export type AskTurn = { question: string; answer: string };
/** Which AI a person asked to answer (search-and-ask.md "Choosing which AI answers"): built-in AI even with a key
 *  set, or the team's key (built-in AI when none is set). */
export type AskAiChoice = 'built-in' | 'key';
export type AskRequest = {
  question: string;
  turns?: AskTurn[];
  ai?: AskAiChoice;
  /** Answer only from the pages carrying any of these labels, each an id or a name (search-and-ask.md "By label"). */
  labels?: string[];
};
/** A passage an answer cites, or one it found and set aside. */
export type AskSource = {
  number: number;
  passageId: string;
  tab: string;
  title: string;
  headings: string[];
  text: string;
  trust: KnowledgeTrustShown;
  verifiedAt?: number;
  firstBlock: string;
  lastBlock: string;
  /** The page's Health Score and word (search-and-ask.md "Sources"); absent from an older answer. */
  health?: { score: number; label: KnowledgeHealthLabel };
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
      /** Which AI answered: built-in AI with no key, else the team's provider. */
      provider: KnowledgeSetupProvider;
    }
  | { type: 'error'; kind: string; message: string; provider?: KnowledgeSetupProvider };

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
/** Which AI answered a suggestion (describe-to-set-up.md "The model"): built-in AI with no key, else the team's. */
export type KnowledgeSetupProvider = 'built-in' | KnowledgeAiProvider;
/** A proposed structure: a name for the knowledgebase and up to 30 pages in tree order. Plain text throughout.
 *  `provider`: which AI answered; the route always says, and a structure picked on the start screen has none. */
export type KnowledgeSetupSuggestion = {
  name: string;
  pages: KnowledgeSetupPage[];
  provider?: KnowledgeSetupProvider;
};

/** `POST .../pages/<tab>/describe-structure` (describe-to-set-up.md "Describe Structure on a page"): what the page is
 *  for, in the person's words (may be empty when the page has a title), the draft's Title, and `ai: "built-in"` when
 *  the person chose built-in AI over the team's key. */
export type PageStructureRequest = {
  purpose: string;
  /** The draft's Title, when it is not yet the saved name; absent: the saved name. */
  title?: string;
  ai?: AskAiChoice;
};
/** One block of a drafted page structure. Plain text throughout. */
export type PageStructureBlock =
  | { kind: 'heading'; level: 2 | 3; text: string }
  | { kind: 'text'; text: string }
  | { kind: 'callout'; text: string }
  | { kind: 'bullets' | 'numbered' | 'checklist'; items: string[] }
  | { kind: 'table'; columns: string[] };
/** A drafted structure for one empty page, and which AI answered. Nothing is written by the route. */
export type PageStructureResponse = {
  blocks: PageStructureBlock[];
  provider: KnowledgeSetupProvider;
};

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
  trust: KnowledgeTrustShown;
  verifiedAt?: number;
  /** The page's Health Score: the higher side is the likelier right (ai-knowledge.md "Pages that disagree"). */
  health?: { score: number; label: KnowledgeHealthLabel };
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
  | {
      outcome:
        | 'no_owners'
        | 'nothing_due'
        | 'unavailable'
        | 'daily_limit'
        | 'no_recipients'
        // Remind the Owners under a Review Period of Never: nothing is verified, so nobody is reminded.
        | 'verification_off';
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
  state: KnowledgeTrustShown;
  verifiedAt?: number;
  /** The verifier's name, where the api has one. */
  verifiedBy?: string;
  reviewAt?: number;
  stale: boolean;
  /** The pages an open conflict sets this one against. */
  conflictsWith?: KnowledgePageRef[];
  /** The page's approval (approval.md "Where it shows"), without anyone's account id: its state, when it was asked
   *  for (and by which agent), when it was decided, and a rejection's note. */
  approval?: KnowledgeApprovalTrust;
  /** The page's Health Score, on `read_page` and `get_context` (not the tree's rows). */
  health?: KnowledgePageHealth;
};
export type KnowledgeApprovalTrust = {
  state: 'pending' | 'approved' | 'rejected';
  requestedAt: number;
  requestedByAgent?: string;
  decidedAt?: number;
  note?: string;
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
  /** The page's labels by name (page-surface.md "Page labels"); absent for none. */
  labels?: string[];
};
/** A connected file in the tree (links-and-embeds.md "Connected files in the sidebar"): another app's file placed
 *  among the pages, which is no page. It holds no subpages and no trust, and `read_page` does not read it. */
export type KnowledgeConnectedRow = KnowledgePageRef & {
  kind: 'connected';
  /** The app the file is in ("livediagram", "liveplanner", ...). */
  app: string;
  depth: number;
  parent?: string;
  subpages: 0;
};
/** One row of the tree: a page, or a connected file. */
export type KnowledgeTreeRow = KnowledgePageRow | KnowledgeConnectedRow;
/** Whether a tree row is a page (not a connected file). */
export const isKnowledgePageRow = (row: KnowledgeTreeRow): row is KnowledgePageRow =>
  (row as { kind?: string }).kind !== 'connected';
/** `reviewEvery` is the knowledgebase's Review Period, said once for every page's `reviewAt`. `pages` is the tree in
 *  order, its connected files among its pages. */
export type KnowledgePagesResponse = {
  reviewEvery: KnowledgeReviewEvery;
  pages: KnowledgeTreeRow[];
};
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
  /** The page's cover (page-surface.md "The cover"): its kind, and its picture or its preset. */
  cover?: Exclude<AgentCover, null>;
  /** The page's icon (page-surface.md "The page icon"): an emoji or a catalogue icon. */
  icon?: AgentPageIcon;
  /** The page's labels by name (page-surface.md "Page labels"); absent for none. */
  labels?: string[];
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
  /** The knowledgebase's Review Period. */
  reviewEvery: KnowledgeReviewEvery;
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
/** `trust`: a new page is `never-verified`, or `off` where verification is off; absent from an older api. */
export type CreatePageResponse = {
  page: KnowledgePageRef & { parent?: string; rev: number };
  trust?: 'never-verified' | 'off';
};
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
/** One day of AI Knowledge's reads (ai-knowledge.md "Reads"): `day` is the UTC day, `YYYY-MM-DD`. */
export type KnowledgeReadsDay = { day: string; people: number; agents: number };
/** A page of Most Read: its reads in the last 7 days, by people and by agents. */
export type KnowledgeMostRead = { tab: string; title: string; people: number; agents: number };
/** `GET .../knowledge`: the AI Knowledge tab (ai-knowledge.md). */
export type KnowledgeOverviewResponse = {
  agents: KnowledgeAgent[];
  questions: KnowledgeQuestion[];
  conflicts: KnowledgeConflict[];
  suggestions: KnowledgeSuggestion[];
  context: { budget: number; used: number; pages: KnowledgeContextPage[] };
  health: KnowledgeHealthCounts;
  /** The knowledgebase's Review Period, which `health` is worked out under. */
  reviewEvery: KnowledgeReviewEvery;
  hasKey: boolean;
  /** Whether any AI answers here: the team's key, or built-in AI (the conflict check, Draft a Page). */
  hasAi: boolean;
  /** The Knowledgebase Reviews emails: whether this deployment sends email, and when the owners were last
   *  reminded (Remind the Owners is once a week). */
  reviewEmails: { available: boolean; remindedAt?: number };
  /** The last 14 days' reads by day, oldest first, and the pages read most in the last 7 (at most 5). */
  reads: { days: KnowledgeReadsDay[]; mostRead: KnowledgeMostRead[] };
  /** Pages With Low Health: the 5 lowest under the Healthy line; absent from an older api. */
  lowHealth?: KnowledgeLowHealthPage[];
  /** Not Read in 90 Days (ai-knowledge.md): the first 10, touched longest ago first, and how many; absent from an
   *  older api. */
  notRead?: { pages: KnowledgeNotReadPage[]; total: number };
};
/** A page nobody read in 90 days: `touchedAt` is its last edit, else when it was made, where either was kept. */
export type KnowledgeNotReadPage = { tab: string; title: string; touchedAt?: number };
/** `POST .../questions`: an agent's `report_gap`. */
export type ReportGapRequest = { question: string };
