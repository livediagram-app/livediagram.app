'use client';

import type { ReactNode } from 'react';
import { Tooltip } from '@/components/primitives/Tooltip';
import { helpArticleHref, helpArticleLeaf, type HelpArticleKey } from '@/lib/help-articles';
import { track } from '@/lib/telemetry';

type HelpArticleLinkProps = {
  /** Which help article to deep-link (key in HELP_ARTICLES). */
  article: HelpArticleKey;
  /** Tooltip title (custom Tooltip, never a native `title`). */
  title?: string;
  /** Optional one-line tooltip elaboration. */
  description?: string;
  /**
   * `icon` (default): a small `?` button to sit beside a control label.
   * `text`: a "Learn more" inline link for dialog headers / empty states.
   * `chrome`: a `?` ghost icon button sized to match a floating panel's
   *   header chrome (reset / minimise), for use in `MovablePanel` headers.
   * `button`: a full button (help glyph + "Help" label) that matches a
   *   neighbouring primary button's shape but stays neutral, not brand —
   *   for header action rows (e.g. beside the explorer "+ Create" button).
   */
  variant?: 'icon' | 'text' | 'chrome' | 'button';
  /** Override the visible text for the `text` and `button` variants. */
  label?: string;
  /** Leading icon for the `button` variant (defaults to the help glyph). */
  icon?: ReactNode;
  /** Extra classes merged onto the anchor. */
  className?: string;
};

// One affordance for every editor -> help-centre deep link (spec/56).
// Surfaces reference an article key, never a raw URL; the link opens the
// help centre in a new tab and fires a single UI/Opened telemetry event
// keyed by the article's leaf slug.
export function HelpArticleLink({
  article,
  title = 'Learn more',
  description,
  variant = 'icon',
  label = 'Learn more',
  icon,
  className,
}: HelpArticleLinkProps) {
  const href = helpArticleHref(article);
  const onClick = () => track('UI', 'Opened', helpArticleLeaf(article));
  const common = {
    href,
    target: '_blank',
    rel: 'noreferrer noopener',
    onClick,
  } as const;

  if (variant === 'text') {
    return (
      <Tooltip title={title} description={description}>
        <a
          {...common}
          className={`inline-flex items-center gap-1 text-xs font-medium text-blue-600 underline-offset-2 transition hover:text-blue-700 hover:underline dark:text-blue-400 dark:hover:text-blue-300${
            className ? ` ${className}` : ''
          }`}
        >
          {label}
          <ArrowOutIcon />
        </a>
      </Tooltip>
    );
  }

  if (variant === 'chrome') {
    // Matches MovablePanel's header buttons (reset / minimise) so a panel's
    // help affordance reads as a sibling of its chrome, not a stray circle.
    return (
      <Tooltip title={title} description={description}>
        <a
          {...common}
          aria-label={title}
          className={`flex h-5 w-5 items-center justify-center rounded text-[13px] font-semibold leading-none text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100${
            className ? ` ${className}` : ''
          }`}
        >
          ?
        </a>
      </Tooltip>
    );
  }

  if (variant === 'button') {
    // A real button (help glyph + "Help" label) that matches a neighbouring
    // primary button's shape (e.g. the explorer "+ Create") but stays neutral
    // slate/white rather than brand, so it reads as a secondary action.
    return (
      <Tooltip title={title} description={description}>
        <a
          {...common}
          aria-label={title}
          className={`inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 dark:hover:text-white${
            className ? ` ${className}` : ''
          }`}
        >
          {icon ?? <HelpMarkIcon />}
          {label === 'Learn more' ? 'Help' : label}
        </a>
      </Tooltip>
    );
  }

  return (
    <Tooltip title={title} description={description}>
      <a
        {...common}
        aria-label={title}
        className={`inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-slate-300 text-[10px] font-semibold leading-none text-slate-500 transition hover:border-blue-400 hover:bg-blue-50 hover:text-blue-600 dark:border-slate-600 dark:text-slate-400 dark:hover:border-blue-500 dark:hover:bg-blue-950/40 dark:hover:text-blue-300${
          className ? ` ${className}` : ''
        }`}
      >
        ?
      </a>
    </Tooltip>
  );
}

// A circled question mark for the `button` variant's leading icon (sized to
// sit beside a 12px label like the + on the Create button).
function HelpMarkIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      aria-hidden
    >
      <circle cx="8" cy="8" r="6.25" />
      <path
        d="M6.3 6.2a1.8 1.8 0 1 1 2.5 1.7c-.5.25-.9.65-.9 1.25v.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="8" cy="11.6" r="0.6" fill="currentColor" stroke="none" />
    </svg>
  );
}

// Tiny "opens in a new tab" glyph for the text variant.
function ArrowOutIcon() {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M8 4H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-3" />
      <path d="M12 4h4v4" />
      <path d="M16 4l-7 7" />
    </svg>
  );
}
