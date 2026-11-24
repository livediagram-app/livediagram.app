'use client';

// The picture box of another app's item with no picture to show (one-explorer-contracts.md "Inbox", the reading
// pane): an editor's thumbnail would draw its own app's empty sketch ("Nothing drawn yet" under a diagram) for a plan
// or a page, so it draws this instead: the neutral box the Explorer page shows, with the item's app mark. Each app's
// thumbnail takes it as its `fallback` for an item that is not its own (`<app>/…/lib/explorer-thumbnail.tsx`).
import type { App } from '@liveworkspace/index-client';
import { AppMark } from './badges';

export function OtherAppThumbnail({ app, size }: { app: App; size: 'row' | 'card' }) {
  return (
    <span
      data-preview-fallback=""
      className="flex h-full w-full items-center justify-center opacity-80"
    >
      <AppMark app={app} size={size === 'card' ? 28 : 14} />
    </span>
  );
}
