'use client';

import { useEffect } from 'react';

// Sends the old profile URL to the Explorer with Settings open on
// Notifications, which is what the link in a notification email meant. A
// client redirect rather than a server one because the app is a static export
// (no redirects available), and `replace` so Back does not bounce the reader
// straight back here.
const TARGET = '/explorer?settings=notifications';

export function ProfileRedirect() {
  useEffect(() => {
    window.location.replace(TARGET);
  }, []);

  return (
    <main className="flex min-h-dvh items-center justify-center px-6">
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Taking you to your notification settings…{' '}
        <a href={TARGET} className="font-medium text-blue-600 dark:text-blue-400">
          Continue
        </a>
      </p>
    </main>
  );
}
