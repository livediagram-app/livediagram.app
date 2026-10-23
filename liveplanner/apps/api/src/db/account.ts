// account — owner-wide deletion. It touches every table keyed on an owner, so it lives here rather than under
// any one resource. The person's plans are the index's (liveworkspace/docs/one-explorer.md): routes/account.ts
// has the index purge them, and the index has each plan's Durable Object drop its content.

import type { Env } from '../types';

// Wipe every row this app keeps for an owner: every owner-keyed table in docs/specs/015-api/api.md "Owner-keyed
// data". account-owner-columns.test.ts holds this to that list against the real schema. Called from
// DELETE /api/account. Participants are owner-less in the schema but their id IS the owner id, so a single
// id-match delete clears the display-name / colour row too. Idempotent: re-running with the same owner id is a
// no-op once the rows are gone.
export async function deleteAccount(env: Env, ownerId: string): Promise<void> {
  const by = (sql: string) => env.DB.prepare(sql).bind(ownerId);
  await env.DB.batch([
    by('DELETE FROM participants WHERE id = ?'),
    // user_preferences (docs/specs/007-editor/user-preferences.md): their editor preference flags.
    by('DELETE FROM user_preferences WHERE owner_id = ?'),
    // Workbench rows (docs/specs/013-workspace/workbench-embeds.md), before the tokens they were minted from.
    by('DELETE FROM workbench_sessions WHERE owner_id = ?'),
    by('DELETE FROM workbench_tickets WHERE owner_id = ?'),
    by('DELETE FROM workbench_pairings WHERE owner_id = ?'),
    by('DELETE FROM workbench_pairing_requests WHERE owner_id = ?'),
    // api_tokens (docs/specs/015-api/public-api-and-tokens.md): no API credential outlives the account.
    by('DELETE FROM api_tokens WHERE owner_id = ?'),
    // email_lifecycle (docs/specs/014-identity/transactional-email.md): the address isn't retained, and a
    // re-signup starts the series fresh.
    by('DELETE FROM email_lifecycle WHERE owner_id = ?'),
    // auth_accounts (docs/specs/017-telemetry/telemetry.md): the first-seen row the sign-up count keys on.
    by('DELETE FROM auth_accounts WHERE owner_id = ?'),
    // form_reads (docs/specs/030-forms/forms.md "Hearing about responses"): what they had seen of forms.
    by('DELETE FROM form_reads WHERE owner_id = ?'),
  ]);
  // agent_changesets (docs/specs/024-agents/agent-changesets.md, CS27) they wrote on other people's plans are in
  // those plans' own stores (each plan's Durable Object), out of reach of one statement; they age out with the
  // 30-day changeset retention there.
}
