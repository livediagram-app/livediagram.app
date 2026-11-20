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
};
export type KnowledgeSearchResponse = { results: KnowledgeSearchResult[] };

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
export type KnowledgeSuggestion = {
  id: string;
  tab: string;
  title: string;
  agent: string;
  summary: string;
  createdAt: number;
};
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
