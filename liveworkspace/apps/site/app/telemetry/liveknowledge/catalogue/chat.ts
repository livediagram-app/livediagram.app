// Slack and Teams (docs/specs/030-knowledgebase/chat-apps.md): knowledgebases connected to a Slack workspace or a
// Teams organisation, and the people who connected their own accounts to ask from there. Every event is a count
// with a preset type. Part of the knowledgebase catalogue, re-exported from ./knowledge.

import type { MetricStack } from '../../_shared/metric-series';
import { chart } from '../../_shared/catalogue-helpers';

export const CHAT_WORKSPACES_CONNECTED = chart(
  'UI',
  'Used',
  'Chat Workspaces Connected',
  'An Editor started connecting a knowledgebase to Slack or to Microsoft Teams, from Slack and Teams.',
  { types: ['ChatConnectSlack', 'ChatConnectTeams'] },
);

export const CHAT_WORKSPACES_DISCONNECTED = chart(
  'UI',
  'Used',
  'Chat Workspaces Disconnected',
  'An Editor disconnected a knowledgebase from a Slack workspace or a Teams organisation.',
  { types: ['ChatDisconnect'], rising: 'neutral' },
);

export const CHAT_ACCOUNTS_LINKED = chart(
  'UI',
  'Used',
  'Chat Accounts Connected',
  'Someone connected their liveknowledge account to Slack or Teams, so their answers there use the pages they can open.',
  { types: ['ChatAccountLinked'] },
);

export const CHAT_APPS: MetricStack = {
  stack: true,
  title: 'Slack and Teams',
  blurb:
    'Knowledgebases connected to chat, and the people who connected their own accounts to ask from there.',
  members: [CHAT_WORKSPACES_CONNECTED, CHAT_WORKSPACES_DISCONNECTED, CHAT_ACCOUNTS_LINKED],
  headline: [CHAT_WORKSPACES_CONNECTED],
};
