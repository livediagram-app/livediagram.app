'use client';

// An item's app, by its mark (liveworkspace/docs/specs/004-index/item-calls.md): the call's Open Item and the Inbox's
// call rows show which app the item is in by its logo, never its name as plain text.
import { BrandMark } from '@liveworkspace/brand';
import type { App } from '@liveworkspace/index-client';
import { APP_SITES } from '@liveworkspace/sites';

export function ItemAppMark({ app, className = 'size-4' }: { app: App; className?: string }) {
  const site = APP_SITES.find((s) => s.name === app);
  return <BrandMark app={app} accentColor={site?.accent} className={`shrink-0 ${className}`} />;
}
