'use client';

// Creating an account (docs/specs/014-identity/auth-and-guest-access.md). The accounts site signs
// new and returning people in the same way, with an emailed code, so this is the sign-in hand-off
// with the new-design flow as its default destination.
import { AuthHandoff } from '@/components/chrome/AuthHandoff';
import { POST_AUTH_DEFAULT } from '@/components/chrome/auth-shared';

export default function GetStartedPage() {
  return <AuthHandoff defaultDestination={POST_AUTH_DEFAULT} />;
}
