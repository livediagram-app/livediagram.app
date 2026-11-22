// A share link's visitor turned away by the item's sign-in rule (liveworkspace/docs/specs/004-index/
// one-explorer-contracts.md "Sharing and access"): why, and who the item is for, as each editor's share resolve reads
// the api's refusal and its restricted page (components/dialogs/ShareRestricted) shows it.

export type ShareRestriction = {
  // `sign_in`: a guest or nobody, asked to sign in; `domain`: an account at a domain the rule does not list.
  reason: 'sign_in' | 'domain';
  domains: string[];
};

/** A refusal's code and domains as the restricted page reads them, or null for any other refusal. */
export function shareRestrictionOf(
  code: string | null | undefined,
  domains: unknown,
): ShareRestriction | null {
  const list = Array.isArray(domains)
    ? domains.filter((d): d is string => typeof d === 'string' && d !== '').slice(0, 20)
    : [];
  if (code === 'sign_in_required') return { reason: 'sign_in', domains: list };
  if (code === 'domain_not_allowed') return { reason: 'domain', domains: list };
  return null;
}

/** The share gate a refusal opens: the password prompt (none sent yet, or a wrong one) or the restricted page (the
 *  item's sign-in rule). Null for any other refusal. One reading for every editor's share resolve. */
export function shareGateOf(
  code: string | null | undefined,
  domains: unknown = null,
): { passwordRequired: true; invalid: boolean; restricted?: ShareRestriction } | null {
  if (code === 'password_required') return { passwordRequired: true, invalid: false };
  if (code === 'password_invalid') return { passwordRequired: true, invalid: true };
  const restricted = shareRestrictionOf(code, domains);
  return restricted ? { passwordRequired: true, invalid: false, restricted } : null;
}

/** An editor's share gate while it shows: the password prompt (`invalid` after a wrong one, `changed` when the
 *  remembered one was refused) or, with `restricted`, the restricted page. */
export type ShareGate = { invalid: boolean; changed?: boolean; restricted?: ShareRestriction };
