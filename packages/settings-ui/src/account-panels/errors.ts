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
  // AI keys (liveworkspace/docs/specs/003-accounts/ai-keys.md "The account API").
  invalid_provider: 'Choose Anthropic or OpenAI.',
  invalid_model: 'Choose one of the listed models.',
  invalid_key: 'That doesn’t look like an API key. Paste it again, with nothing around it.',
  key_rejected: 'The provider didn’t accept that key. Check it and try again.',
  key_no_credit: 'That key works, but its account has no credit left. Add some with the provider.',
  key_model_unavailable:
    'That key can’t use this model. Choose another, or check the key’s access.',
  key_check_failed: 'Couldn’t reach the provider to check the key. Try again in a moment.',
  no_key: 'There’s no key there any more. It may have changed elsewhere.',
  ai_keys_unavailable: 'AI keys can’t be kept here just now. Built-in AI still works.',
};

/** What to tell the person when the accounts API says no. */
export function accountErrorMessage(error: string): string {
  return MESSAGES[error] ?? 'Something went wrong. Please try again.';
}

/** "3 Nov 2026", in the reader's locale. */
export function formatAccountDate(ms: number): string {
  return DAY_MONTH_YEAR.format(ms);
}
