'use client';

// The plan's webhooks as an outgoing action picks them (docs/specs/026-plan/automations.md "Outgoing actions"): read
// from the index (`GET /api/index/items/:id/webhooks`, through the site's index client and the share link the page
// holds) the first time a Send to Webhook, Post to Slack or Post to Teams panel opens, once per builder, and again
// when the Webhooks dialog the panel opened (Add a Webhook…) closes. The webhooks are an account's: a guest is told
// to sign in instead, and nothing is asked. The builder provides it; the panels read it.

import { createContext, use, useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Webhook } from '@liveworkspace/index-client';
import { indexClient } from '@liveworkspace/workbench/lib/index-client';
import { debugLog } from '@liveworkspace/workbench/lib/debug-log';
import type { AutomationsScope } from './automations-client';

export type PlanWebhooksStatus = 'idle' | 'loading' | 'ready' | 'error' | 'signed_out';

export type PlanWebhooks = {
  status: PlanWebhooksStatus;
  webhooks: readonly Webhook[];
  // Reads the list the first time it is asked for (a panel opening); later calls do nothing.
  load: () => void;
  // Reads the list again (Try Again after a failed read).
  retry: () => void;
  // Opens the plan's Webhooks dialog; the list is read again when it closes.
  openDialog: () => void;
};

const NO_WEBHOOKS: readonly Webhook[] = [];

export const PlanWebhooksContext = createContext<PlanWebhooks | null>(null);

export function usePlanWebhooks(): PlanWebhooks | null {
  return use(PlanWebhooksContext);
}

/** The list's state for one builder, and its reads. */
export function usePlanWebhooksState({
  scope,
  signedIn,
  onOpenDialog,
}: {
  scope: Pick<AutomationsScope, 'projectId' | 'shareCode'>;
  signedIn: boolean;
  // Opens the Webhooks dialog, calling back once it closes.
  onOpenDialog?: ((onClosed: () => void) => void) | undefined;
}): PlanWebhooks {
  const [status, setStatus] = useState<PlanWebhooksStatus>(signedIn ? 'idle' : 'signed_out');
  const [webhooks, setWebhooks] = useState<readonly Webhook[]>(NO_WEBHOOKS);
  const asked = useRef(false);
  const { projectId, shareCode } = scope;

  const read = useCallback(() => {
    setStatus('loading');
    indexClient.listWebhooks(projectId, shareCode ? { code: shareCode } : null).then(
      (got) => {
        setWebhooks(got.webhooks);
        setStatus('ready');
      },
      (error: unknown) => {
        debugLog('[automations] webhooks.failed', { error: String(error) });
        setStatus('error');
      },
    );
  }, [projectId, shareCode]);

  const load = useCallback(() => {
    if (!signedIn || asked.current) return;
    asked.current = true;
    read();
  }, [signedIn, read]);

  const openDialog = useCallback(() => {
    onOpenDialog?.(() => {
      if (signedIn) read();
    });
  }, [onOpenDialog, signedIn, read]);

  return useMemo(
    () => ({ status, webhooks, load, retry: read, openDialog }),
    [status, webhooks, load, read, openDialog],
  );
}

export function PlanWebhooksProvider({
  value,
  children,
}: {
  value: PlanWebhooks;
  children: ReactNode;
}) {
  return <PlanWebhooksContext.Provider value={value}>{children}</PlanWebhooksContext.Provider>;
}
