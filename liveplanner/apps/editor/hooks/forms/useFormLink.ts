'use client';

// A Form tab's link as its page shows it (docs/specs/030-forms/forms.md "Publishing and the form link", "Hearing
// about responses"): read when the tab opens (which marks its responses seen for this reader), polled while it stays
// open so the count moves as responses arrive, and changed by Publish, the Accepting Responses switch and Delete Link.
import { useCallback, useEffect, useState } from 'react';
import type { FormLinkResponse } from '@liveplanner/api-schema';
import {
  apiDeleteFormLink,
  apiFormLink,
  apiMarkFormSeen,
  apiPublishForm,
  apiSetFormOpen,
} from '@/lib/api/forms';
import { ApiError } from '@/lib/api-client';
import { track } from '@/lib/telemetry';

// How often an open Form tab rereads its count (a cheap read: three small queries). Safe range 15..120 s.
const FORM_LINK_POLL_MS = 30_000;

export type FormLinkState = {
  link: FormLinkResponse | null;
  status: 'loading' | 'ready' | 'failed' | 'offline';
  busy: boolean;
  error: string | null;
  publish: () => Promise<boolean>;
  setOpen: (open: boolean) => Promise<void>;
  remove: () => Promise<void>;
  reload: () => void;
};

const PUBLISH_ERRORS: Record<string, string> = {
  form_destination_missing: 'Choose where responses go before publishing.',
  form_suspensions:
    'This project can’t publish more forms: its form links were suspended after reports.',
  form_already_published: 'This form is already published.',
  form_not_ready: 'Finish the form before publishing: Share Form lists what it needs.',
};

export function useFormLink(input: {
  projectId: string | null;
  tabId: string;
  ownerId: string;
  share: string | null;
  // Offline projects and guests with no server: nothing to publish.
  enabled: boolean;
  // Opening the Form tab marks its responses seen; a board's Form strip only reads (false).
  markSeen?: boolean;
}): FormLinkState {
  const { projectId, tabId, ownerId, share, enabled, markSeen = true } = input;
  const [link, setLink] = useState<FormLinkResponse | null>(null);
  const [loadStatus, setStatus] = useState<'loading' | 'ready' | 'failed'>('loading');
  // A project with no server has no link to read (the page is remounted per tab, so a tab's state starts fresh).
  const status: FormLinkState['status'] = enabled && projectId ? loadStatus : 'offline';
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // A reread (the poll, a reload): the count as it is now.
  const read = useCallback(async () => {
    if (!enabled || !projectId) return;
    try {
      const next = await apiFormLink(ownerId, projectId, tabId, share);
      setLink(next);
      setStatus('ready');
    } catch {
      setStatus((s) => (s === 'ready' ? s : 'failed'));
    }
  }, [enabled, projectId, tabId, ownerId, share]);

  useEffect(() => {
    if (!enabled || !projectId) return;
    // Opening the tab marks what is here seen; a reader elsewhere only reads.
    (markSeen
      ? apiMarkFormSeen(ownerId, projectId, tabId, share)
      : apiFormLink(ownerId, projectId, tabId, share)
    ).then(
      (next) => {
        setLink(next);
        setStatus('ready');
      },
      () => setStatus('failed'),
    );
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void read();
    }, FORM_LINK_POLL_MS);
    return () => window.clearInterval(timer);
  }, [enabled, projectId, tabId, ownerId, share, read, markSeen]);

  const run = useCallback(
    async (call: () => Promise<FormLinkResponse>, errors: Record<string, string> = {}) => {
      setBusy(true);
      setError(null);
      try {
        setLink(await call());
        return true;
      } catch (e) {
        const code = e instanceof ApiError ? e.code : undefined;
        setError(
          (code && errors[code]) || 'That didn’t work. Check your connection and try again.',
        );
        return false;
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  return {
    link,
    status,
    busy,
    error,
    publish: async () => {
      if (!projectId) return false;
      const ok = await run(() => apiPublishForm(ownerId, projectId, tabId, share), PUBLISH_ERRORS);
      if (ok) track('Form', 'Shared', 'Link');
      return ok;
    },
    setOpen: async (open) => {
      if (!projectId) return;
      // Fired before the change lands, so a close is counted even when it fails.
      track('Form', 'Toggled', open ? 'Open' : 'Closed');
      await run(() => apiSetFormOpen(ownerId, projectId, tabId, open, share));
    },
    remove: async () => {
      if (!projectId) return;
      await run(() => apiDeleteFormLink(ownerId, projectId, tabId, share));
    },
    reload: () => void read(),
  };
}
