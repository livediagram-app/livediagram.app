'use client';

// Webhooks (liveworkspace/docs/specs/004-index/webhooks.md "Managing them"): one document's own webhooks, from its ⋯
// menu. The shared dialog (@liveworkspace/settings-ui/webhooks), with the Explorer's own picture of the item and its
// app's mark. Loaded when it is first opened.

import type { Item } from '@liveworkspace/index-client';
import { DocumentWebhooksDialog } from '@liveworkspace/settings-ui/webhooks';
import { useExplorer } from '../explorer/context';
import { AppMark } from '../explorer/badges';
import { ItemIcon } from '../ui/icons';

export function WebhooksDialog({ item, onClose }: { item: Item; onClose: () => void }) {
  const { client, renderThumbnail } = useExplorer();
  return (
    <DocumentWebhooksDialog
      onClose={onClose}
      client={client}
      itemId={item.id}
      app={item.app}
      title={item.title}
      share={item.sharedVia ? { code: item.sharedVia } : null}
      thumbnail={renderThumbnail?.(item, 'row') ?? <ItemIcon size={22} />}
      mark={<AppMark app={item.app} size={14} />}
    />
  );
}
