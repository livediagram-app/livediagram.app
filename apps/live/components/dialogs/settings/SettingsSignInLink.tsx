'use client';

import { useAuthHrefs } from '@/components/chrome/auth-shared';
import { clerkEnabled } from '@/lib/clerk-config';

// The Sign In link every signed-out Settings message ends with
// (docs/specs/007-editor/user-preferences.md): the guest identity card, Delete
// Account, the email stand-in card and the API Tokens manager. It returns to
// the page the dialog was opened on. Absent where the deployment has no
// sign-in, since there would be nowhere for it to go.
export function SettingsSignInLink() {
  const { signInHref } = useAuthHrefs();
  if (!clerkEnabled) return null;
  return (
    <>
      {' '}
      <a
        href={signInHref}
        className="font-medium text-brand-600 underline-offset-2 hover:underline dark:text-brand-400"
      >
        Sign In
      </a>
    </>
  );
}
