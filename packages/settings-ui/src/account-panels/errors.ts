import { DAY_MONTH_YEAR } from '@liveworkspace/ui/date-format';

// The accounts API's refusals in words, as every account panel (and liveworkspace.app's own account pages) says
// them: a code the API answers with, else the one general line.
const MESSAGES: Record<string, string> = {
  name_required: 'Give it a name.',
  email_invalid: 'That doesn’t look like an email address.',
  already_invited: 'That address is already in the team, or invited.',
  member_limit_reached: 'A team can have up to 200 members and invitations.',
  team_limit_reached: 'You can be in up to 50 teams.',
  token_limit_reached: 'You can have up to 20 tokens. Revoke one to make another.',
  last_admin: 'A team needs an admin. Make someone else an admin first.',
  admin_only: 'Only the team’s admins can do that.',
  email_unverified: 'Sign in with the invited address to answer this.',
  not_found: 'That’s no longer there. It may have changed elsewhere.',
  invite_not_found: 'This link isn’t valid any more. Ask the team for a new one.',
  already_joined: 'You’re already in this team.',
  rate_limited: 'Too many tries just now. Wait a minute and try again.',
  signed_out: 'You’ve been signed out. Sign in again to carry on.',
  offline: 'Couldn’t reach liveworkspace. Check your connection and try again.',
};

/** What to tell the person when the accounts API says no. */
export function accountErrorMessage(error: string): string {
  return MESSAGES[error] ?? 'Something went wrong. Please try again.';
}

/** "3 Nov 2026", in the reader's locale. */
export function formatAccountDate(ms: number): string {
  return DAY_MONTH_YEAR.format(ms);
}
