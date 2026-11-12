// Which apps' Explorers keep an Inbox (liveworkspace/docs/specs/004-index/one-explorer-contracts.md "Inbox"). The
// Inbox lists actions, mentions and replies, and livehuddle has none of them: comments, assigned actions, links and
// notes left it (livehuddle/docs/specs/002-project-scope/not-in-livehuddle.md "Comments, actions, links and notes").
// Its Explorer, the editor's panel and its pages alike, shows no Inbox row, section, badge or hero pill, never reads
// GET /inbox, and an address for the Inbox opens Home. Every other app keeps it.

import type { App } from '@liveworkspace/index-client';

// The apps with no Inbox, as APPS_WITHOUT_MCP (explorer/sign-in-reasons.ts) names the apps with no MCP server.
const APPS_WITHOUT_INBOX: ReadonlySet<App> = new Set<App>(['livehuddle']);

/** Whether the app's Explorer shows the Inbox. */
export function appHasInbox(app: App): boolean {
  return !APPS_WITHOUT_INBOX.has(app);
}
