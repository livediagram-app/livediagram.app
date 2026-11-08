'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { App } from '@liveworkspace/index-client';
import type { DocumentWebhooksApi } from './webhooks-api';

// The document a Webhooks dialog is for (liveworkspace/docs/specs/004-index/webhooks.md "Managing them"): its calls,
// bound to its id, and its app, whose events and words the dialog offers. Every part of the dialog reads it here, so
// none is handed the client or the id.
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
