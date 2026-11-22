// What makes liveknowledge a knowledgebase (docs/specs/030-knowledgebase): Ask, AI Knowledge, verification,
// search and getting around the pages, Describe to Set Up and the team's AI key, and the pages made from them.
// Every event here is a count with a preset type, never a question, an answer, a page or a key. Part of the metric
// catalogue: import from ../metric-catalogue.

import type { MetricStack } from '../../_shared/metric-series';
import { chart } from '../../_shared/catalogue-helpers';
import { openedChart } from './opened';

// ---- Ask (search-and-ask.md "Ask") ----------------------------------------------------------------------------

export const ASK_OPENED = openedChart(
  'Ask Opened',
  'The Ask view opened from the footer, to ask the knowledgebase a question.',
  (t) => t === 'AskView',
);

export const QUESTIONS_ASKED = chart(
  'UI',
  'Used',
  'Questions Asked',
  'A question sent to Ask, a follow-up included. The count only, never the words.',
  { types: ['AskQuestion'] },
);

export const ASKED_FROM_HOME = chart(
  'UI',
  'Used',
  'Asked From Home',
  'A question asked from the box on Home, which opens it in Ask.',
  { types: ['HomeAsk'] },
);

export const ANSWERS_STOPPED = chart(
  'UI',
  'Ended',
  'Answers Stopped',
  'Stop pressed while Ask was still writing an answer.',
  { types: ['AskStopped'], rising: 'neutral' },
);

export const ANSWERS_HELPFUL = chart(
  'UI',
  'Used',
  'Answers Marked Helpful',
  'An answer marked helpful with its thumbs up.',
  { types: ['AskHelpful'] },
);

export const ANSWERS_NOT_HELPFUL = chart(
  'UI',
  'Used',
  'Answers Marked Not Helpful',
  'An answer marked not helpful with its thumbs down.',
  { types: ['AskNotHelpful'], rising: 'bad' },
);

export const ANSWERS_ACCEPTED = chart(
  'UI',
  'Used',
  'Answers Accepted',
  'Accept Answer pressed: the chat moves to Completed Questions and the field is fresh.',
  { types: ['AskAccepted'] },
);

export const QUESTIONS_REOPENED = chart(
  'UI',
  'Used',
  'Questions Reopened',
  'A completed question opened again to carry on its chat.',
  { types: ['AskReopened'], rising: 'neutral' },
);

export const ASK_CHATS_DELETED = chart(
  'UI',
  'Removed',
  'Ask Chats Deleted',
  'A past question and its chat deleted from the recent questions.',
  { types: ['AskChat'], rising: 'neutral' },
);

export const ASK: MetricStack = {
  stack: true,
  title: 'Ask',
  blurb:
    'Questions put to the knowledgebase and how the answers landed: asked, stopped, marked helpful or not, accepted, reopened and deleted. Headed by the questions asked.',
  members: [
    QUESTIONS_ASKED,
    ASKED_FROM_HOME,
    ASK_OPENED,
    ANSWERS_STOPPED,
    ANSWERS_HELPFUL,
    ANSWERS_NOT_HELPFUL,
    ANSWERS_ACCEPTED,
    QUESTIONS_REOPENED,
    ASK_CHATS_DELETED,
  ],
  headline: QUESTIONS_ASKED,
};

// ---- AI Knowledge (ai-knowledge.md) ---------------------------------------------------------------------------

export const AI_KNOWLEDGE_OPENED = openedChart(
  'AI Knowledge Opened',
  'The AI Knowledge view opened from the footer: suggestions, conflicts and unanswered questions.',
  (t) => t === 'AiKnowledgeView',
);

export const SUGGESTIONS_ACCEPTED = chart(
  'UI',
  'Used',
  'Suggestions Accepted',
  'An Editor accepted an edit an agent suggested, changing the page.',
  { types: ['SuggestionAccepted'] },
);

export const SUGGESTIONS_DISMISSED = chart(
  'UI',
  'Used',
  'Suggestions Dismissed',
  'An Editor dismissed an edit an agent suggested, leaving the page as it was.',
  { types: ['SuggestionDismissed'], rising: 'neutral' },
);

export const SUGGESTIONS_REVIEWED_FROM_PAGE = chart(
  'UI',
  'Used',
  'Suggested Edits Reviewed From a Page',
  "Review All pressed in a page's Suggested Edits, or a suggestion shown in the page from its card.",
  { types: ['ReviewAllSuggestions', 'SuggestionShownInPage'] },
);

export const CONFLICTS_DISMISSED = chart(
  'UI',
  'Used',
  'Conflicts Dismissed',
  'Two pages that disagree marked as fine by an Editor, so the conflict stops showing.',
  { types: ['ConflictDismissed'], rising: 'neutral' },
);

export const QUESTIONS_DISMISSED = chart(
  'UI',
  'Used',
  'Unanswered Questions Dismissed',
  'A question nobody could answer dismissed by an Editor without writing a page for it.',
  { types: ['QuestionDismissed'], rising: 'neutral' },
);

export const OWNERS_ASKED = chart(
  'UI',
  'Used',
  'Owners Asked',
  "An Editor emailed a page's owners to settle two pages that disagree.",
  { types: ['OwnersAsked'] },
);

export const OWNERS_REMINDED = chart(
  'UI',
  'Used',
  'Owners Reminded',
  "An Editor emailed a page's owners a reminder that its review is due.",
  { types: ['OwnersReminded'] },
);

// ---- Connect (mcp-connect.md) ----------------------------------------------------------------------------------

export const CONNECT_OPENED = openedChart(
  'Connect Opened',
  'The Connect view opened, from the footer or Connect an Agent: the steps to connect an AI app over MCP.',
  (t) => t === 'ConnectView' || t === 'ConnectAgent',
);

export const CONNECT_COPIED = chart(
  'UI',
  'Copied',
  'Connect Steps Copied',
  'An MCP address, command, config or first prompt copied from the Connect view.',
  { types: ['McpSetup', 'ConnectPrompt'] },
);

export const AI_KNOWLEDGE: MetricStack = {
  stack: true,
  title: 'AI Knowledge',
  blurb:
    'Keeping the knowledgebase right: agent suggestions accepted or dismissed, conflicts and unanswered questions settled, and owners emailed.',
  members: [
    AI_KNOWLEDGE_OPENED,
    CONNECT_OPENED,
    CONNECT_COPIED,
    SUGGESTIONS_ACCEPTED,
    SUGGESTIONS_DISMISSED,
    SUGGESTIONS_REVIEWED_FROM_PAGE,
    CONFLICTS_DISMISSED,
    QUESTIONS_DISMISSED,
    OWNERS_ASKED,
    OWNERS_REMINDED,
  ],
  headline: [
    SUGGESTIONS_ACCEPTED,
    SUGGESTIONS_DISMISSED,
    CONFLICTS_DISMISSED,
    QUESTIONS_DISMISSED,
    OWNERS_ASKED,
    OWNERS_REMINDED,
  ],
};

// ---- Verification (verification.md) ---------------------------------------------------------------------------

export const PAGES_VERIFIED = chart(
  'UI',
  'Used',
  'Pages Verified',
  'A page verified by a signed-in Editor: checked and marked as right until its review comes due.',
  { types: ['VerifyPage'] },
);

export const STILL_RIGHT_FROM_HOME = chart(
  'UI',
  'Used',
  'Still Right From Home',
  'A page due for review confirmed with Still Right on Home, verifying it again.',
  { types: ['HomeStillRight'] },
);

export const REVIEW_PERIODS_CHANGED = chart(
  'UI',
  'Used',
  'Review Periods Changed',
  "A knowledgebase's Review Period changed in its settings: how long a verified page stays verified.",
  { types: ['ReviewPeriodChanged'], rising: 'neutral' },
);

// Approval (approval.md): a page put Pending Approval, the request taken back, and a person's approval (which
// verifies it) or rejection, with or without a note.
export const APPROVALS_REQUESTED = chart(
  'Tab',
  'Changed',
  'Approvals Requested',
  'A page put Pending Approval, for a person on the team to approve or reject.',
  { types: ['ApprovalRequested'] },
);

export const APPROVALS_WITHDRAWN = chart(
  'Tab',
  'Changed',
  'Approvals Withdrawn',
  'A request for approval taken back while it was pending.',
  { types: ['ApprovalWithdrawn'], rising: 'neutral' },
);

export const PAGES_APPROVED = chart(
  'Tab',
  'Changed',
  'Pages Approved',
  'A pending page approved, which verifies it.',
  { types: ['Approved'] },
);

export const PAGES_REJECTED = chart(
  'Tab',
  'Changed',
  'Pages Rejected',
  'A pending page rejected, with or without a note for its owner.',
  { types: ['Rejected', 'RejectedWithNote'], rising: 'neutral' },
);

export const HEADINGS_ADDED_FROM_HEALTH = chart(
  'UI',
  'Used',
  'Headings Added From Health',
  "Add a Heading pressed in the Health Score's breakdown, to give a long page some structure.",
  { types: ['HealthAddHeading'] },
);

// Watching (watching.md): a page or a section watched from its menu or the Page Info rail, and a watch stopped.
export const PAGES_WATCHED = chart(
  'UI',
  'Toggled',
  'Pages Watched',
  'A page, or a section with every page under it, watched to hear when it changes.',
  { types: ['WatchPageOn', 'WatchSectionOn'] },
);

export const WATCHES_STOPPED = chart(
  'UI',
  'Toggled',
  'Watches Stopped',
  'A watch on a page or a section stopped.',
  { types: ['WatchPageOff', 'WatchSectionOff'], rising: 'neutral' },
);

// Required Reading (required-reading.md): a page required or stopped, a confirmation, a reminder and a save that asks
// everyone again.
export const READING_REQUIRED = chart(
  'UI',
  'Used',
  'Pages Made Required Reading',
  'A page an Editor asked everyone, or chosen people, to confirm they read; a change of who counts too.',
  { types: ['RequiredReadingSet'] },
);

export const READING_STOPPED = chart(
  'UI',
  'Used',
  'Required Reading Stopped',
  'A page that stopped being Required Reading, its confirmations cleared.',
  { types: ['RequiredReadingStopped'], rising: 'neutral' },
);

export const READS_CONFIRMED = chart(
  'UI',
  'Used',
  'Reads Confirmed',
  "I've Read This pressed on a Required Reading page.",
  { types: ['ReadConfirmed'] },
);

export const READERS_REMINDED = chart(
  'UI',
  'Used',
  'Readers Reminded',
  'Remind pressed on a Required Reading page, emailing those who have not confirmed.',
  { types: ['ReadingReminded'], rising: 'neutral' },
);

export const READING_ASKED_AGAIN = chart(
  'UI',
  'Used',
  'Asked to Read Again',
  'A Required Reading page saved with Ask Everyone to Read Again, clearing its confirmations.',
  { types: ['ReadingAskedAgain'], rising: 'neutral' },
);

export const ISSUES_OPENED_FROM_HEALTH = chart(
  'UI',
  'Used',
  'Open Issues Shown From Health',
  "Show Conflicts, Show Comments or Show Suggested Edits pressed in a page's Health Score breakdown.",
  { types: ['HealthShowConflicts', 'HealthShowComments', 'HealthShowSuggestions'] },
);

export const VERIFICATION: MetricStack = {
  stack: true,
  title: 'Verification',
  blurb:
    'Pages checked and marked right, from the page or from Home, how long a knowledgebase lets a page stay verified, approvals asked for, taken back, given and refused, and pages watched for changes. Headed by the pages verified.',
  members: [
    PAGES_VERIFIED,
    STILL_RIGHT_FROM_HOME,
    REVIEW_PERIODS_CHANGED,
    APPROVALS_REQUESTED,
    APPROVALS_WITHDRAWN,
    PAGES_APPROVED,
    PAGES_REJECTED,
    HEADINGS_ADDED_FROM_HEALTH,
    ISSUES_OPENED_FROM_HEALTH,
    PAGES_WATCHED,
    WATCHES_STOPPED,
    READING_REQUIRED,
    READING_STOPPED,
    READS_CONFIRMED,
    READERS_REMINDED,
    READING_ASKED_AGAIN,
  ],
  headline: [PAGES_VERIFIED, STILL_RIGHT_FROM_HOME],
};

// ---- Search (search-and-ask.md "Search") -----------------------------------------------------------------------

export const KNOWLEDGE_SEARCH_OPENED = openedChart(
  'Knowledgebase Search Opened',
  'The search panel opened to search this knowledgebase.',
  (t) => t === 'KnowledgeSearch',
);

export const SEARCH_PAGES_OPENED = chart(
  'UI',
  'Used',
  'Page Results Opened',
  'A page whose title matched picked from the search results.',
  { types: ['SearchResultPage'] },
);

export const SEARCH_PASSAGES_OPENED = chart(
  'UI',
  'Used',
  'Passage Results Opened',
  'A passage of writing picked from the search results, opening its page there.',
  { types: ['SearchResultPassage'] },
);

export const SEARCH_RECENT_OPENED = chart(
  'UI',
  'Used',
  'Recent Pages Opened',
  'A recently opened page picked from the search panel before anything was typed.',
  { types: ['SearchRecentPage'] },
);

export const KNOWLEDGE_SEARCH: MetricStack = {
  stack: true,
  title: 'Knowledgebase Search',
  blurb:
    'Searching this knowledgebase: the panel opened, and the pages, passages and recent pages picked from it.',
  members: [
    KNOWLEDGE_SEARCH_OPENED,
    SEARCH_PAGES_OPENED,
    SEARCH_PASSAGES_OPENED,
    SEARCH_RECENT_OPENED,
  ],
  headline: KNOWLEDGE_SEARCH_OPENED,
};

// ---- Getting around the pages (knowledgebases-and-pages.md, links-and-embeds.md) ------------------------------

export const PAGE_LINKS_FOLLOWED = chart(
  'UI',
  'Used',
  'Page Links Followed',
  'A link in the writing to another page of the knowledgebase followed.',
  { types: ['PageLink'] },
);

export const BACKLINKS_FOLLOWED = chart(
  'UI',
  'Used',
  'Backlinks Followed',
  'A page opened from Linked From, the pages that link to the one being read.',
  { types: ['Backlink'] },
);

export const ON_THIS_PAGE_JUMPS = chart(
  'UI',
  'Used',
  'On This Page Jumps',
  "A heading picked in the page's On This Page list, scrolling the page to it.",
  { types: ['OnThisPage'], rising: 'neutral' },
);

export const PAGE_LINKS_COPIED = chart(
  'UI',
  'Used',
  'Page Links Copied',
  "A page's link copied from its menu in the page tree.",
  { types: ['CopyPageLink'] },
);

export const PAGES_RESTORED = chart(
  'UI',
  'Used',
  'Pages Restored From the Trash',
  "A page brought back from the knowledgebase's page Trash to where it was.",
  { types: ['RestorePage'] },
);

export const PAGES_DELETED_FOREVER = chart(
  'UI',
  'Used',
  'Pages Deleted Forever',
  'A page removed for good from the page Trash, one at a time or the whole Trash emptied, by an Editor.',
  { types: ['DeletePageForever', 'EmptyPageTrash'], rising: 'neutral' },
);

export const PAGE_TREE_FOLDED = chart(
  'UI',
  'Changed',
  'Page Tree Folded',
  'The page tree folded away or opened out again.',
  { types: ['PageTreeCollapsed', 'PageTreeExpanded'], rising: 'neutral' },
);

export const PAGE_NAVIGATION: MetricStack = {
  stack: true,
  title: 'Getting Around',
  blurb:
    'How people move through a knowledgebase: links between pages followed both ways, headings jumped to, page links copied and the page tree folded.',
  members: [
    PAGE_LINKS_FOLLOWED,
    BACKLINKS_FOLLOWED,
    ON_THIS_PAGE_JUMPS,
    PAGE_LINKS_COPIED,
    PAGES_RESTORED,
    PAGES_DELETED_FOREVER,
    PAGE_TREE_FOLDED,
  ],
  headline: [PAGE_LINKS_FOLLOWED, BACKLINKS_FOLLOWED, ON_THIS_PAGE_JUMPS],
};

// ---- Pages made from somewhere other than the page tree --------------------------------------------------------

export const PAGES_FROM_ANSWERS = chart(
  'Tab',
  'Created',
  'Pages From Answers',
  'An answer from Ask saved as a new page.',
  { types: ['FromAnswer'] },
);

export const PAGES_FROM_GAPS = chart(
  'Tab',
  'Created',
  'Pages From Unanswered Questions',
  'A page drafted for a question nobody could answer, from AI Knowledge.',
  { types: ['FromGap'] },
);

export const PAGES_FROM_LINKS = chart(
  'Tab',
  'Created',
  'Pages From Links',
  'A link to a page that did not exist yet, followed to make that page.',
  { types: ['FromPageLink'] },
);

export const PAGES_FROM_SETUP = chart(
  'Tab',
  'Created',
  'Pages From Describe to Set Up',
  'Describe to Set Up making the pages it suggested, counted once per set-up that made any.',
  { types: ['FromSetup'] },
);

export const PAGES_FROM_STRUCTURE = chart(
  'Tab',
  'Created',
  'Pages From a Structure',
  'A whole knowledgebase shape picked on the start or from a template link (Team Handbook, Engineering Handbook and the rest), counted once per pick.',
  { types: ['FromStructure'] },
);

// ---- Reading and editing a page (editing.md) and AI Context (ai-knowledge.md "AI Context on a page") ----------

export const EDITS_STARTED = chart(
  'Tab',
  'Started',
  'Edits Started',
  "Someone pressed Edit (or E, or double-clicked the writing) to open a page's shared draft.",
  { types: ['Edit'] },
);

export const EDITS_SAVED = chart(
  'Tab',
  'Ended',
  'Drafts Saved',
  "Someone saved a page's draft, publishing it for every reader.",
  { types: ['Save'] },
);

export const EDITS_DISCARDED = chart(
  'Tab',
  'Ended',
  'Drafts Discarded',
  'The last person editing a page threw its unsaved draft away.',
  { types: ['Discard'], rising: 'neutral' },
);

export const EDITS_JOINED = chart(
  'Tab',
  'Started',
  'Edits Joined',
  'Someone reading a page was brought into its edit mode when another person started editing it, so both work in the one shared draft.',
  { types: ['EditJoined'], rising: 'neutral' },
);

export const PAGE_EDITING: MetricStack = {
  stack: true,
  title: 'Editing Pages',
  blurb:
    'Pages open to read; Edit opens their one shared draft, which others editing join, and which is saved for every reader or thrown away.',
  members: [EDITS_STARTED, EDITS_JOINED, EDITS_SAVED, EDITS_DISCARDED],
  headline: [EDITS_STARTED, EDITS_SAVED],
};

export const PAGES_BY_SOURCE: MetricStack = {
  stack: true,
  title: 'New Pages by Source',
  blurb:
    'Pages made from somewhere other than adding one by hand: an answer saved, a draft for an unanswered question, a link to a missing page, Describe to Set Up, and a structure picked on the start. Pages added by hand are in Page Actions.',
  members: [
    PAGES_FROM_ANSWERS,
    PAGES_FROM_GAPS,
    PAGES_FROM_LINKS,
    PAGES_FROM_SETUP,
    PAGES_FROM_STRUCTURE,
  ],
};

// ---- Describe to Set Up and the team's AI key (describe-to-set-up.md, search-and-ask.md "The AI key") ----------

export const SETUPS_SUGGESTED = chart(
  'UI',
  'Used',
  'Set-Ups Suggested',
  "Describe to Set Up suggested a page tree from what someone described, on the team's own key or on built-in AI when there is none.",
  { types: ['SetupSuggested', 'SetupSuggestedBuiltIn'] },
);

export const STRUCTURES_DRAFTED = chart(
  'UI',
  'Used',
  'Page Structures Drafted',
  "Describe Structure drafted an empty page's headings into its draft, on the team's own key or on built-in AI.",
  { types: ['DescribeStructure'] },
);

export const AI_KEYS_ADDED = chart(
  'UI',
  'Added',
  'AI Keys Added',
  "A team's own Claude or OpenAI key added in AI Settings, switching on Ask and AI Knowledge. Never the key.",
  { types: ['AiKey'] },
);

export const AI_KEYS_REMOVED = chart(
  'UI',
  'Removed',
  'AI Keys Removed',
  "A knowledgebase's AI key removed in AI Settings.",
  { types: ['AiKey'], rising: 'neutral' },
);

export const SITES_PUBLISHED = chart(
  'UI',
  'Used',
  'Sites Published',
  'A knowledgebase, or one section of it, published to the web, or what is published changed (Publish to the Web).',
  { types: ['PublishSite'] },
);

export const SITES_UNPUBLISHED = chart(
  'UI',
  'Removed',
  'Sites Unpublished',
  "A knowledgebase's public site taken down with Unpublish.",
  { types: ['PublishSite'], rising: 'neutral' },
);

export const AI_PROVIDERS_CHANGED = chart(
  'UI',
  'Changed',
  'AI Providers Switched',
  "A knowledgebase's AI provider switched between Claude and OpenAI.",
  { types: ['AiProvider'], rising: 'neutral' },
);

export const AI_MODELS_CHANGED = chart(
  'UI',
  'Changed',
  'AI Models Picked',
  'Another model picked for Ask and AI Knowledge in AI Settings.',
  { types: ['AiModel'], rising: 'neutral' },
);

export const ASK_AI_CHOSEN = chart(
  'UI',
  'Changed',
  'Ask AI Chosen',
  "Which AI answers a person's questions switched on Ask, between built-in AI and the team's key.",
  { types: ['AskAiBuiltIn', 'AskAiKey'], rising: 'neutral' },
);

export const AI_SETUP: MetricStack = {
  stack: true,
  title: 'Set-Up and AI Key',
  blurb:
    "Getting a knowledgebase going: Describe to Set Up's suggestions, and the team's own AI key added, removed or pointed at another provider or model.",
  members: [
    SETUPS_SUGGESTED,
    STRUCTURES_DRAFTED,
    AI_KEYS_ADDED,
    AI_KEYS_REMOVED,
    AI_PROVIDERS_CHANGED,
    AI_MODELS_CHANGED,
    ASK_AI_CHOSEN,
  ],
  headline: [SETUPS_SUGGESTED, AI_KEYS_ADDED],
};

export const SITE_PUBLISHING: MetricStack = {
  stack: true,
  title: 'Publish to the Web',
  blurb: 'Knowledgebases put on the web as public help centres, and taken down again.',
  members: [SITES_PUBLISHED, SITES_UNPUBLISHED],
  headline: [SITES_PUBLISHED],
};

// ---- Agents' access, for Connections (ai-knowledge.md "Agents") -------------------------------------------------

export const AGENT_WRITES_ALLOWED = chart(
  'UI',
  'Used',
  'Agent Writes Allowed',
  'An Editor let a connected agent write pages directly, not only suggest.',
  { types: ['AgentWriteAllowed'] },
);

export const AGENT_WRITES_STOPPED = chart(
  'UI',
  'Used',
  'Agent Writes Stopped',
  'An Editor took back a connected agent’s right to write pages directly.',
  { types: ['AgentWriteStopped'], rising: 'neutral' },
);

export const CONTEXT_PAGES_ADDED = chart(
  'UI',
  'Added',
  'Always in Context Pages Added',
  'A page added to Always in Context, the pages every agent reads first.',
  { types: ['ContextPage'] },
);

export const CONTEXT_PAGES_REMOVED = chart(
  'UI',
  'Removed',
  'Always in Context Pages Removed',
  'A page taken out of Always in Context.',
  { types: ['ContextPage'], rising: 'neutral' },
);

export const AGENT_ACCESS: MetricStack = {
  stack: true,
  title: 'Agent Access',
  blurb:
    'What Editors let agents do in a knowledgebase: write pages directly or only suggest, and which pages every agent reads first.',
  members: [AGENT_WRITES_ALLOWED, AGENT_WRITES_STOPPED, CONTEXT_PAGES_ADDED, CONTEXT_PAGES_REMOVED],
};
