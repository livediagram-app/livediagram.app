'use client';

// A This Browser item's picture, on its own so an editor's thumbnail can draw it without the rest of the Explorer
// (`@liveworkspace/explorer/local-preview`).

import { memo, type CSSProperties } from 'react';
import type { App } from '@liveworkspace/index-client';
import { siteOf } from '../words';
import { BrowserIcon } from './host';

/**
 * A This Browser item's picture where a server item shows its snapshot (none leaves the browser): the browser it lives
 * in, tinted in the accent of the app that owns it, a wash of the accent behind the glyph in its deep shade (the
 * accent on dark). Fills its box; the caller sizes and rounds it.
 */
export const LocalPreview = memo(function LocalPreview({
  app,
  iconSize,
  className = '',
}: {
  app: App;
  iconSize: number;
  className?: string;
}) {
  const site = siteOf(app);
  return (
    <span
      aria-hidden
      data-local-preview={app}
      style={{ '--local-accent': site.accent, '--local-deep': site.deep } as CSSProperties}
      className={`flex items-center justify-center bg-[color-mix(in_srgb,var(--local-accent)_12%,white)] text-[var(--local-deep)] dark:bg-[color-mix(in_srgb,var(--local-accent)_18%,transparent)] dark:text-[var(--local-accent)] ${className}`}
    >
      <BrowserIcon size={iconSize} />
    </span>
  );
});
