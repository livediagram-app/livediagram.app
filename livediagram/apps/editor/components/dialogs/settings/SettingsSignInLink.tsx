'use client';

import { useAuthHrefs } from '@/components/chrome/auth-shared';

// The Sign In link every signed-out Settings message ends with
// (docs/specs/007-editor/user-preferences.md): the guest identity card, Delete
// Account, the email stand-in card and the API Tokens manager. It returns to
// the page the dialog was opened on.
export function SettingsSignInLink() {
  const { signInHref } = useAuthHrefs();
  return (
    <>
      {' '}
      <a
        href={signInHref}
        className="font-medium text-brand-700 underline-offset-2 hover:underline dark:text-brand-400"
      >
        Sign In
      </a>
    </>
  );
}
