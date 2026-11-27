// Insights and Connect (docs/specs/030-knowledgebase/insights.md, mcp-connect.md): agents' suggested edits,
// conflicts and unanswered questions settled, owners emailed, and the ways to connect an agent. Every event is a
// count with a preset type. Part of the knowledgebase catalogue, re-exported from ./knowledge.

import type { MetricStack } from '../../_shared/metric-series';
import { chart } from '../../_shared/catalogue-helpers';
import { openedChart } from './opened';

export const INSIGHTS_OPENED = openedChart(
  'Insights Opened',
  'The Insights view opened from the footer: suggestions, conflicts and unanswered questions.',
  // AiKnowledgeView: what it sent before the rename (2026-11-23), so the history stays on the chart.
  (t) => t === 'InsightsView' || t === 'AiKnowledgeView',
);

export const INSIGHTS_TOPIC_OPENED = openedChart(
  'Insights Topics Opened',
  "A topic's page opened from the Insights dashboard: Needs Attention, Page Health, Reading or Agents.",
  (t) => t === 'InsightsTopic',
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

export const INSIGHTS: MetricStack = {
  stack: true,
  title: 'Insights',
  blurb:
    'Keeping the knowledgebase right: agent suggestions accepted or dismissed, conflicts and unanswered questions settled, and owners emailed.',
  members: [
    INSIGHTS_OPENED,
    INSIGHTS_TOPIC_OPENED,
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
