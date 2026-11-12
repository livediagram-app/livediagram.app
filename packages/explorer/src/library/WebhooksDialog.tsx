'use client';

// Webhooks (liveworkspace/docs/specs/004-index/webhooks.md "Managing them"): one document's own webhooks, from its ⋯
// menu. The shared dialog (@liveworkspace/settings-ui/webhooks), with the Explorer's own mark for the item's app.
// Loaded when it is first opened.

import type { Item } from '@liveworkspace/index-client';
import { DocumentWebhooksDialog } from '@liveworkspace/settings-ui/webhooks';
import { useExplorer } from '../explorer/context';
import { AppMark } from '../explorer/badges';

export function WebhooksDialog({ item, onClose }: { item: Item; onClose: () => void }) {
  const { client } = useExplorer();
  return (
    <DocumentWebhooksDialog
      onClose={onClose}
      client={client}
      itemId={item.id}
      app={item.app}
      title={item.title}
      share={item.sharedVia ? { code: item.sharedVia } : null}
      mark={<AppMark app={item.app} size={14} />}
    />
  );
}
