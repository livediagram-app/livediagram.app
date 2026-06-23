'use client';

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
   */
  variant?: 'icon' | 'text' | 'chrome';
  /** Override the visible text for the `text` variant. */
  label?: string;
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
