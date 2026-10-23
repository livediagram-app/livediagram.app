import { IndexError } from '@liveworkspace/index-client';

// A refusal from the index, said in words a person can act on.
export function failureText(error: unknown, fallback: string): string {
  if (error instanceof IndexError) {
    switch (error.code) {
      case 'forbidden':
      case 'not_team_member':
        return 'You can’t change that here.';
      case 'not_found':
      case 'folder_not_found':
        return 'That’s gone: it was moved or deleted elsewhere.';
      case 'folder_exists':
        return 'A folder with that name is already here.';
      case 'cycle':
        return 'A folder can’t go inside itself.';
      case 'share_link_limit':
        return 'This has as many passes as it can hold. Delete an old one first.';
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
