'use client';

import { lazy, Suspense } from 'react';
import type { App } from '@liveworkspace/index-client';
import { lucideWebhook } from '@liveworkspace/icons/lucide';
import { lucideGlyph } from '@liveworkspace/ui';
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
export const WebhooksGlyph = lucideGlyph(lucideWebhook, 14);
