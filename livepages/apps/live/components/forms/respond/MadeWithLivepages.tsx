'use client';

// "Made with livepages" under a form on its page (docs/specs/030-forms/forms.md "Filling in a form"): the words and
// the real logo, its mark and wordmark (the shared Brand), linking to the marketing site.
import { Brand } from '@livepages/ui';

export function MadeWithLivepages() {
  return (
    <a
      href="/"
      aria-label="Made with livepages"
      className="inline-flex items-center gap-1.5 rounded-md text-[13px] text-slate-500 transition hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100"
    >
      <span>Made with</span>
      <Brand size="sm" />
    </a>
  );
}
