// Who is offered the document's Webhooks in its menu (liveworkspace/docs/specs/004-index/webhooks.md "Who adds one"):
// a signed-in account that edits the whole document. Not a guest, a Viewer (read-only), a Participant, or an Editor whose
// link reaches one tab only. The index decides again on every call; this only keeps the entry out of reach.

export type WebhookManagerFacts = {
  // The editor's session has finished loading, so the facts below are the real ones.
  hydrated: boolean;
  // The signed-in account's id: empty for a guest.
  accountUserId: string | null | undefined;
  isReadOnly: boolean;
  participating: boolean;
  // The tab a link is limited to, or null for a link or account that reaches every tab.
  sessionTabScope: unknown;
};

export function canManageWebhooks(facts: WebhookManagerFacts): boolean {
  return (
    facts.hydrated &&
    Boolean(facts.accountUserId) &&
    !facts.isReadOnly &&
    !facts.participating &&
    facts.sessionTabScope === null
  );
}
