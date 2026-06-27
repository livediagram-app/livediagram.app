'use client';

import { useEffect } from 'react';

// Client-side redirect for a help URL that has moved. The help app is a static
// export (no server redirects), so a retired path keeps resolving via this
// stub: it sends visitors to the new location and shows a visible link as a
// no-JS / crawler fallback. `href` is an absolute path including the `/help`
// basePath, since window.location is not basePath-aware.
export function Redirect({ href, label }: { href: string; label: string }) {
  useEffect(() => {
    window.location.replace(href);
  }, [href]);

  return (
    <main className="mx-auto flex min-h-[60vh] max-w-2xl flex-col items-center justify-center gap-3 px-6 text-center">
      <h1 className="text-xl font-semibold text-slate-900">This page has moved</h1>
      <p className="text-slate-600">
        If you are not redirected automatically,{' '}
        <a href={href} className="text-brand-600 underline hover:text-brand-700">
          read the {label} here
        </a>
        .
      </p>
    </main>
  );
}
