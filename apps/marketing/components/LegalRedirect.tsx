'use client';

import { useEffect } from 'react';

// Client-side redirect for a retired legal page. The Terms and Privacy Policy
// now live in the help centre; these stubs keep the historical /terms and
// /privacy URLs working by sending visitors there, with a visible link as a
// no-JS / crawler fallback.
export function LegalRedirect({
  href,
  heading,
  linkText,
}: {
  href: string;
  heading: string;
  linkText: string;
}) {
  useEffect(() => {
    window.location.replace(href);
  }, [href]);

  return (
    <main className="mx-auto flex min-h-[60vh] max-w-2xl flex-col items-center justify-center gap-3 px-6 text-center">
      <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">{heading}</h1>
      <p className="text-slate-600 dark:text-slate-400">
        It now lives in the help centre. If you are not redirected automatically,{' '}
        <a href={href} className="text-brand-600 underline hover:text-brand-700">
          {linkText}
        </a>
        .
      </p>
    </main>
  );
}
