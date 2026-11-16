// Who a Plan Members address takes mail from (docs/specs/026-plan/email-to-board.md "Which mail is taken" step 7):
// the verified addresses of the plan's owner and of its team's joined members, asked of accounts on every message,
// never kept. Unlike the notification reads, a fault here is said, so the message is refused rather than let in.
import { accountEmails, isAccountId, readTeamPeople } from '@liveworkspace/auth-client';
import { accountCredentials } from '../auth/accounts';
import type { Env } from '../types';

/** The plan's members' addresses, lower-cased, or 'unavailable' when accounts can't say. */
export async function planMemberAddresses(
  env: Env,
  ownerId: string,
  teamId: string | null,
): Promise<Set<string> | 'unavailable'> {
  const credentials = accountCredentials(env);
  if (!credentials) return 'unavailable';
  try {
    const [owners, team] = await Promise.all([
      isAccountId(ownerId)
        ? accountEmails(credentials, [ownerId])
        : Promise.resolve<Record<string, string>>({}),
      teamId ? readTeamPeople(credentials, teamId) : Promise.resolve(null),
    ]);
    const out = new Set<string>();
    for (const address of Object.values(owners)) out.add(address.toLowerCase());
    for (const m of team?.members ?? [])
      if (m.status === 'joined' && m.userId) out.add(m.email.toLowerCase());
    return out;
  } catch (error) {
    console.warn('[email-intake] members_unavailable', { error: String(error) });
    return 'unavailable';
  }
}
