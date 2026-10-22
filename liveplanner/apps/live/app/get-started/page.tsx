'use client';

// Creating an account (docs/specs/014-identity/auth-and-guest-access.md): the sign-in hand-off, opening
// the accounts site's registration page (first name, last name, email, then a code), with the
// new-document flow as its default destination.
import { AuthHandoff } from '@/components/chrome/AuthHandoff';
import { POST_AUTH_DEFAULT } from '@/components/chrome/auth-shared';

export default function GetStartedPage() {
  return <AuthHandoff defaultDestination={POST_AUTH_DEFAULT} signUp />;
}
