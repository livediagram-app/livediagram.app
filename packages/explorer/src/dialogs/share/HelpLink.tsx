// A help article, opened in a new tab; nothing where the host has no article. Three looks, livediagram's
// HelpArticleLink from before the Explorer split: `icon`, a bare "?" beside a label; `labelled`, "? Help" in a
// dialog's header row; `text`, "Learn more" after a hint. A hover card names it.

import { HoverCard } from '@liveworkspace/ui';
import { ArrowOutGlyph } from './glyphs';

export function HelpLink({
  href,
  label,
  description,
  variant = 'icon',
}: {
  href: string | undefined;
  // Its name, and the hover card's title.
  label: string;
  description?: string;
  variant?: 'icon' | 'labelled' | 'text';
}) {
  if (!href) return null;
  const common = { href, target: '_blank', rel: 'noreferrer noopener' } as const;
  if (variant === 'text') {
    return (
      <HoverCard title={label} description={description}>
        <a
          {...common}
          className="relative touch-target inline-flex items-center gap-1 text-xs font-medium text-blue-600 underline-offset-2 transition duration-micro hover:text-blue-700 hover:underline dark:text-blue-400 dark:hover:text-blue-300"
        >
          Learn more
          <ArrowOutGlyph />
        </a>
      </HoverCard>
    );
  }
  if (variant === 'labelled') {
    return (
      <HoverCard title={label} description={description}>
        <a
          {...common}
          aria-label={label}
          className="relative touch-target inline-flex h-8 shrink-0 items-center gap-1 rounded-md px-2 text-[12px] font-medium text-slate-500 transition duration-micro hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
        >
          <span aria-hidden className="text-[14px] font-semibold leading-none">
            ?
          </span>
          Help
        </a>
      </HoverCard>
    );
  }
  return (
    <HoverCard title={label} description={description}>
      <a
        {...common}
        aria-label={label}
        className="relative touch-target inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-[13px] font-semibold leading-none text-slate-400 transition duration-micro hover:bg-slate-100 hover:text-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100"
      >
        ?
      </a>
    </HoverCard>
  );
}
