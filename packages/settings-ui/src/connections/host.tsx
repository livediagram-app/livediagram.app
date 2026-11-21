'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { App } from '@liveworkspace/index-client';
import type { DocumentWebhooksApi } from './connections-api';

// The item a Connections list is for (liveworkspace/docs/specs/004-index/webhooks.md "Managing them"): its calls,
// bound to its id, and its app, whose word for the item the list uses. Every part of the list reads it here, so none
// is handed the client or the id.
export type DocumentWebhooksHost = { api: DocumentWebhooksApi; app: App };

const Host = createContext<DocumentWebhooksHost | null>(null);

export function DocumentWebhooksProvider({
  value,
  children,
}: {
  value: DocumentWebhooksHost;
  children: ReactNode;
}) {
  return <Host.Provider value={value}>{children}</Host.Provider>;
}

export function useDocumentWebhooks(): DocumentWebhooksHost {
  const host = useContext(Host);
  if (!host) throw new Error('useDocumentWebhooks needs a DocumentWebhooksProvider');
  return host;
}
