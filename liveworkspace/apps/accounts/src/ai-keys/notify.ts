// What a change of an AI key tells (liveworkspace/docs/specs/003-accounts/ai-keys.md "Changes are deliberate"): a team
// key's change goes to the team's audit log, in the change's own batch; a key set, replaced or removed is emailed to
// the account's owner, or to the team's admins, after the answer. Neither holds any part of a key, its hint included:
// only the provider, what changed, who and when.
import { MODEL_PROVIDERS, type KeyProviderId } from '@liveworkspace/ai';
import { escapeHtml, frame, paragraph, button, workspaceBrand } from '../email-layout.ts';
import { sendEmail } from '../email.ts';
import type { Env } from '../env.ts';
import { teamEvent } from '../teams/shared.ts';
import { withoutTrailingSlashes } from '@liveworkspace/api-schema/url-slashes';

export type AiKeyChange = 'set' | 'replaced' | 'model' | 'removed';

/** The audit log's `team_ai_key_changed`, for the batch that makes the change. */
export function teamAiKeyEvent(
  db: D1Database,
  change: {
    teamId: string;
    teamName: string;
    actor: { id: string; name?: string | null };
    change: AiKeyChange;
    provider: KeyProviderId;
    at: number;
  },
  // Written only when the batch's change took (teamEvent's guard).
  guard?: { sql: string; args: unknown[] },
): D1PreparedStatement {
  return teamEvent(
    db,
    {
      // Two changes in one millisecond are two events: the outbox ignores an id it has.
      id: `team_ai_key_changed:${change.teamId}:${change.at}:${crypto.randomUUID()}`,
      type: 'team_ai_key_changed',
      teamId: change.teamId,
      teamName: change.teamName,
      actor: change.actor,
      at: change.at,
      detail: { change: change.change, provider: change.provider },
    },
    guard,
  );
}

const providerName = (provider: KeyProviderId) =>
  MODEL_PROVIDERS.find((p) => p.id === provider)?.name ?? provider;

const WHAT: Record<Exclude<AiKeyChange, 'model'>, string> = {
  set: 'added',
  replaced: 'replaced',
  removed: 'removed',
};

/** "Your AI Key Was Changed": what changed, the provider, who, when. No key, no hint. */
export function aiKeyChangedEmail(
  baseUrl: string,
  change: {
    change: Exclude<AiKeyChange, 'model'>;
    provider: KeyProviderId;
    actorName: string;
    at: number;
    teamName?: string;
  },
) {
  const link = `${withoutTrailingSlashes(baseUrl)}/explorer?settings=ai`;
  const whose = change.teamName ? `The AI key of your team ${change.teamName}` : 'Your AI key';
  const who = change.actorName.trim() || 'Someone signed in to your account';
  const when = new Date(change.at).toUTCString();
  const lead = `${whose} for ${providerName(change.provider)} was ${WHAT[change.change]} by ${who} on ${when}.`;
  const advice =
    "If this wasn't you, remove the key in Settings, under AI, and revoke it with the provider.";
  const footer = 'You’re receiving this because an AI key on your liveworkspace account changed.';
  const subject = change.teamName
    ? `Your team’s AI key was changed`
    : 'Your liveworkspace AI key was changed';
  const text = [lead, '', advice, '', `Your AI settings: ${link}`, '', footer].join('\n');
  const html = frame(workspaceBrand({ BASE_URL: baseUrl }), {
    preheader: escapeHtml(lead),
    heading: change.teamName ? 'Your team’s AI key was changed' : 'Your AI key was changed',
    body: `${paragraph(escapeHtml(lead))}
        ${paragraph(escapeHtml(advice), 16)}
        ${button('Open AI settings', escapeHtml(link))}`,
    footer,
  });
  return { subject, text, html };
}

/** The addresses a change is emailed to: the account's own verified address, or every joined admin's of the team. */
export async function aiKeyRecipients(
  db: D1Database,
  owner: { kind: 'account' | 'team'; id: string },
): Promise<string[]> {
  const sql =
    owner.kind === 'account'
      ? `SELECT email FROM "user" WHERE id = ? AND emailVerified = 1`
      : `SELECT u.email AS email FROM team_member m JOIN "user" u ON u.id = m.userId
         WHERE m.teamId = ? AND m.status = 'joined' AND m.role = 'admin' AND u.emailVerified = 1 LIMIT 50`;
  const { results } = await db.prepare(sql).bind(owner.id).all<{ email: string }>();
  return (results ?? []).map((r) => r.email);
}

/** Emails a change to everyone it concerns. A failed send is logged with no address and no key, and never fails
 *  the change. */
export async function sendAiKeyChanged(
  env: Env,
  owner: { kind: 'account' | 'team'; id: string },
  change: Parameters<typeof aiKeyChangedEmail>[1],
): Promise<void> {
  try {
    const to = await aiKeyRecipients(env.AUTH_DB, owner);
    const email = aiKeyChangedEmail(env.BASE_URL, change);
    await Promise.all(to.map((address) => sendEmail(env, { to: address, ...email })));
  } catch {
    console.error('[ai-keys] change email failed', { kind: owner.kind });
  }
}
