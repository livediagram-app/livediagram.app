'use client';

import { lazy, Suspense } from 'react';
import type { App } from '@liveworkspace/index-client';
import { indexClient } from '../../lib/index-client';

// The open document's Webhooks (liveworkspace/docs/specs/004-index/webhooks.md "Managing them"), from its own menu
// in every editor: the same shared dialog the Explorer's ⋯ menu opens (@liveworkspace/settings-ui/webhooks), asked
// of the index through this site's client, with the share link the page opened the document through. Its code loads
// when it is first opened, so an editor that never opens it never downloads it.

const Shared = lazy(() =>
  import('@liveworkspace/settings-ui/webhooks').then((m) => ({
    default: m.DocumentWebhooksDialog,
  })),
);

export function DocumentWebhooksDialog({
  open,
  onClose,
  documentId,
  app,
  title,
  shareCode,
}: {
  open: boolean;
  onClose: () => void;
  documentId: string;
  app: App;
  title: string;
  // The link the page was opened through, for an Editor who isn't the owner or in its team.
  shareCode?: string | null;
}) {
  if (!open) return null;
  return (
    <Suspense fallback={null}>
      <Shared
        onClose={onClose}
        client={indexClient}
        itemId={documentId}
        app={app}
        title={title}
        share={shareCode ? { code: shareCode } : null}
      />
    </Suspense>
  );
}

/** The menu row's glyph: Lucide's webhook, at a menu row's 14px. */
export function WebhooksGlyph() {
  return (
    <svg
      aria-hidden
      width={14}
      height={14}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M18 16.98h-5.99c-1.1 0-1.95.94-2.48 1.9A4 4 0 0 1 2 17c.01-.7.2-1.4.57-2" />
      <path d="m6 17 3.13-5.78c.53-.97.1-2.18-.5-3.1a4 4 0 1 1 6.89-4.06" />
      <path d="m12 6 3.13 5.73C15.66 12.7 16.9 13 18 13a4 4 0 0 1 0 8" />
    </svg>
  );
}
