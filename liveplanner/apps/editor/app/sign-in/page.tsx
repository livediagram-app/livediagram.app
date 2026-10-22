'use client';

// Signing in (docs/specs/014-identity/auth-and-guest-access.md): never required to use the editor,
// which stays open to guests forever. Signing in only unlocks per-account persistence (projects
// travel across devices) and team workspaces. The accounts site does the signing in; a returning
// person with no `?redirect_url` lands on their Explorer.
import { AuthHandoff } from '@/components/chrome/AuthHandoff';
import { POST_AUTH_SIGNIN_DEFAULT } from '@/components/chrome/auth-shared';

export default function SignInPage() {
  return <AuthHandoff defaultDestination={POST_AUTH_SIGNIN_DEFAULT} />;
}
