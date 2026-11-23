import { IndexError, SHARE_DOMAINS_MAX, SHARE_PASSWORD_MIN } from '@liveworkspace/index-client';

// A refusal from the index, said in words a person can act on.
// `subject` names what was acted on (“Roadmap”), so a refusal still reads right in the
// notification list later.
export function failureText(error: unknown, fallback: string, subject?: string): string {
  if (error instanceof IndexError) {
    switch (error.code) {
      case 'forbidden':
      case 'not_team_member':
        return `You can’t change ${subject ?? 'that'} here.`;
      case 'not_found':
      case 'folder_not_found':
        return subject
          ? `${subject} is gone: it was moved or deleted elsewhere.`
          : 'That’s gone: it was moved or deleted elsewhere.';
      case 'folder_exists':
        return 'A folder with that name is already here.';
      case 'cycle':
        return 'A folder can’t go inside itself.';
      case 'level_not_offered':
        return 'This app doesn’t offer that kind of pass. Pick another role.';
      case 'share_link_limit':
        return 'This has as many passes as it can hold. Delete an old one first.';
      case 'password_too_short':
        return `A password needs at least ${SHARE_PASSWORD_MIN} characters.`;
      case 'invalid_domain':
        return 'One of those isn’t an email domain. Use names like acme.com.';
      case 'too_many_domains':
        return `Up to ${SHARE_DOMAINS_MAX} domains.`;
      case 'rate_limited':
        return 'Too many tries just now. Wait a minute and try again.';
      case 'unauthorized':
        return 'Your session ended. Sign in again and try once more.';
    }
  }
  return fallback;
}

export function isAbort(error: unknown): boolean {
  return error instanceof DOMException
    ? error.name === 'AbortError'
    : (error as { name?: string } | null)?.name === 'AbortError';
}
