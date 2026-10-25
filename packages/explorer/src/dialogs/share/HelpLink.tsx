// A small "?" that opens a help article in a new tab; nothing where the host has no article.

import { HelpMarkIcon } from '../../ui/icons';

export function HelpLink({ href, label }: { href: string | undefined; label: string }) {
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      aria-label={label}
      title={label}
      className="inline-flex h-4 w-4 items-center justify-center rounded-full text-slate-400 transition hover:text-brand-700 dark:hover:text-brand-300"
    >
      <HelpMarkIcon />
    </a>
  );
}
