'use client';

import type { ReactNode } from 'react';
import { Tooltip } from '@/components/primitives/Tooltip';
import {
  HELP_LINK_COPY,
  helpArticleHref,
  helpArticleTelemetryId,
  type HelpArticleKey,
} from '@/lib/help-articles';
import { track } from '@/lib/telemetry';

type HelpArticleLinkProps = {
  /** Which help article to deep-link (key in HELP_ARTICLES). */
  article: HelpArticleKey;
  /**
   * Tooltip title (custom Tooltip, never a native `title`). Defaults to the
   * article's entry in HELP_LINK_COPY ("Learn about the Explorer"); pass one
   * only when the surface needs a different framing.
   */
  title?: string;
  /** One-line tooltip elaboration; defaults from HELP_LINK_COPY too. */
  description?: string;
  /**
   * `icon` (default): a bare `?` ghost button to sit beside a control label
   *   or in a panel's header chrome. ONE look everywhere (see below).
   * `text`: a "Learn more" inline link for dialog headers / empty states.
   * `button`: a full button (help glyph + "Help" label) that matches a
   *   neighbouring primary button's shape but stays neutral, not brand —
   *   for header action rows (e.g. beside the explorer "+ Create" button).
   */
  variant?: 'icon' | 'text' | 'button';
  /**
   * Hit-box for the `icon` variant, mirroring DialogCloseButton's own two
   * blessed shapes so the `?` and the `×` beside it are the same target:
   * `sm` (default) for panel header chrome and inline control labels, `md`
   * for a dialog header sitting next to a DialogCloseButton.
   */
  size?: 'sm' | 'md';
  /** Override the visible text for the `text` and `button` variants. */
  label?: string;
  /** Leading icon for the `button` variant (defaults to the help glyph). */
  icon?: ReactNode;
  /** Extra classes merged onto the anchor. */
  className?: string;
};

// One affordance for every editor -> help-centre deep link (docs/specs/018-help/contextual-help-links.md).
// Surfaces reference an article key, never a raw URL; the link opens the
// help centre in a new tab and fires a single UI/Opened telemetry event
// keyed by the article's registry telemetry id (docs/specs/017-telemetry/telemetry.md).
export function HelpArticleLink({
  article,
  title = HELP_LINK_COPY[article].title,
  description = HELP_LINK_COPY[article].description,
  variant = 'icon',
  size = 'sm',
  label = 'Learn more',
  icon,
  className,
}: HelpArticleLinkProps) {
  const href = helpArticleHref(article);
  const onClick = () => track('UI', 'Opened', helpArticleTelemetryId(article));
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

  // ONE `?` everywhere: a bare glyph that picks up a soft rounded hover
  // background, matching the Palette panel's header chrome (reset /
  // minimise). The old default drew a bordered circle around the mark, so a
  // dialog header's `?` and a panel's `?` read as two different affordances
  // for the same thing, and ShortcutsDialog had already resorted to a row of
  // `!important` overrides to cancel the ring and size up. Only the box
  // changes between the two sizes; the look does not.
  //
  // `md` is 28px to match DialogCloseButton's h-7, and its glyph runs a point
  // larger than that button's 14px `×` because a question mark carries less
  // visual mass than an X at the same type size. `shrink-0` so an inline
  // placement beside a long control label never squashes it.
  const box = size === 'md' ? 'h-7 w-7 text-[15px]' : 'h-5 w-5 text-[13px]';
  return (
    <Tooltip title={title} description={description}>
      <a
        {...common}
        aria-label={title}
        className={`inline-flex ${box} shrink-0 items-center justify-center rounded font-semibold leading-none text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100${
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
