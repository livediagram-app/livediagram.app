'use client';

import { useEffect } from 'react';

// Sends the old profile address to the Explorer with Settings open on Notifications, which is what the link in a
// notification email meant. A page load rather than a router move, because the Explorer reads the Settings deep link
// (lib/settings-link.ts) as it mounts; `replace`, so Back does not bounce the reader straight back here. A redirect in
// the page because the app is a static export, which has no server redirects.
export const PROFILE_TARGET = '/explorer?settings=notifications';

export function ProfileRedirect() {
  useEffect(() => {
    window.location.replace(PROFILE_TARGET);
  }, []);
  return (
    <p role="status" className="sr-only">
      Taking you to your notification settings… <a href={PROFILE_TARGET}>Continue</a>
    </p>
  );
}
