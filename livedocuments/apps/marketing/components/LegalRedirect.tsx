'use client';

import { useEffect } from 'react';

// Client-side redirect for a retired legal page. The Terms and Privacy Policy
// now live in the help centre; these stubs keep the historical /terms and
// /privacy URLs working by sending visitors there, with a visible link as a
// no-JS / crawler fallback. /security, which never lived here, reuses it with
// its own `lead`.
export function LegalRedirect({
  href,
  heading,
  linkText,
  lead = 'It now lives in the help centre.',
}: {
  href: string;
  heading: string;
  linkText: string;
  lead?: string;
}) {
  useEffect(() => {
    window.location.replace(href);
  }, [href]);

  return (
    <main className="mx-auto flex min-h-[60vh] max-w-2xl flex-col items-center justify-center gap-3 px-6 text-center">
      <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">{heading}</h1>
      <p className="text-slate-600 dark:text-slate-400">
        {lead} If you are not redirected automatically,{' '}
        <a
          href={href}
          className="text-brand-700 underline hover:text-brand-800 dark:text-brand-300 dark:hover:text-brand-200"
        >
          {linkText}
        </a>
        .
      </p>
    </main>
  );
}
