'use client';

// One item's share links and whether it has a password, for the Share dialog: one request when it opens,
// each change applied at once and taken back on a refusal.

import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  CreateShareLinkInput,
  IndexClient,
  ShareLink,
  UpdateShareLinkInput,
} from '@liveworkspace/index-client';
import { failureText } from './errors';

export type ShareLinksState = {
  links: ShareLink[];
  passwordSet: boolean;
  loading: boolean;
  error: boolean;
  busy: boolean;
  create: (input: CreateShareLinkInput) => Promise<ShareLink | null>;
  update: (code: string, input: UpdateShareLinkInput) => Promise<boolean>;
  revoke: (code: string) => Promise<boolean>;
  extend: (code: string) => Promise<boolean>;
  setPassword: (password: string | null) => Promise<boolean>;
};

export function useShareLinks(
  client: IndexClient,
  itemId: string,
  onError: (text: string) => void,
): ShareLinksState {
  const [links, setLinks] = useState<ShareLink[]>([]);
  const [passwordSet, setPasswordSet] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const latest = useRef(links);
  latest.current = links;

  useEffect(() => {
    let live = true;
    setLoading(true);
    client
      .listShareLinks(itemId)
      .then((res) => {
        if (!live) return;
        setLinks(res.links);
        setPasswordSet(res.passwordSet);
        setError(false);
      })
      .catch(() => live && setError(true))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [client, itemId]);

  const create = useCallback<ShareLinksState['create']>(
    async (input) => {
      setBusy(true);
      try {
        const { link } = await client.createShareLink(itemId, input);
        setLinks((all) => [link, ...all]);
        return link;
      } catch (e) {
        onError(failureText(e, 'Couldn’t make a link. Try again.'));
        return null;
      } finally {
        setBusy(false);
      }
    },
    [client, itemId, onError],
  );

  const replace = (link: ShareLink) =>
    setLinks((all) => all.map((l) => (l.code === link.code ? link : l)));

  // The newest change to each link's field, by `code:field`. A change that settles after a newer one to the same
  // field leaves that field alone: a refusal takes back only the fields it was still the newest change to, and
  // an answer keeps any field changed since it was sent. Entries go once their change settles.
  const newest = useRef(new Map<string, number>());
  const seq = useRef(0);

  const update = useCallback<ShareLinksState['update']>(
    async (code, input) => {
      const old = latest.current.find((l) => l.code === code);
      if (!old) return false;
      const mine = ++seq.current;
      const keys = Object.keys(input) as (keyof UpdateShareLinkInput)[];
      for (const k of keys) newest.current.set(`${code}:${k}`, mine);
      // Read when the answer comes (not inside the state updater, which may run after a newer change settles).
      const changedSince = () => {
        const later = new Set<string>();
        for (const [key, at] of newest.current) {
          if (at > mine && key.startsWith(`${code}:`)) later.add(key.slice(code.length + 1));
        }
        for (const k of keys) {
          if (newest.current.get(`${code}:${k}`) === mine) newest.current.delete(`${code}:${k}`);
        }
        return later;
      };
      setLinks((all) => all.map((l) => (l.code === code ? ({ ...l, ...input } as ShareLink) : l)));
      try {
        const { link } = await client.updateShareLink(code, input);
        const later = changedSince();
        setLinks((all) =>
          all.map((l) => {
            if (l.code !== code) return l;
            const next = { ...link } as Record<string, unknown>;
            for (const k of later) next[k] = (l as Record<string, unknown>)[k];
            return next as ShareLink;
          }),
        );
        return true;
      } catch (e) {
        const later = changedSince();
        setLinks((all) =>
          all.map((l) => {
            if (l.code !== code) return l;
            const next = { ...l } as Record<string, unknown>;
            for (const k of keys) if (!later.has(k)) next[k] = old[k];
            return next as ShareLink;
          }),
        );
        onError(failureText(e, 'Couldn’t change that link. Try again.'));
        return false;
      }
    },
    [client, onError],
  );

  const revoke = useCallback<ShareLinksState['revoke']>(
    async (code) => {
      const at = latest.current.findIndex((l) => l.code === code);
      const old = latest.current[at];
      setLinks((all) => all.filter((l) => l.code !== code));
      try {
        await client.revokeShareLink(code);
        return true;
      } catch (e) {
        // Back where it was in the list, not at the top (the top is where a new link goes).
        if (old) {
          setLinks((all) =>
            all.some((l) => l.code === code) ? all : [...all.slice(0, at), old, ...all.slice(at)],
          );
        }
        onError(failureText(e, 'Couldn’t turn that link off. Try again.'));
        return false;
      }
    },
    [client, onError],
  );

  const extend = useCallback<ShareLinksState['extend']>(
    async (code) => {
      try {
        const { link } = await client.extendShareLink(code);
        replace(link);
        return true;
      } catch (e) {
        onError(failureText(e, 'Couldn’t extend that link. Try again.'));
        return false;
      }
    },
    [client, onError],
  );

  const setPassword = useCallback<ShareLinksState['setPassword']>(
    async (password) => {
      setBusy(true);
      try {
        const res = await client.setSharePassword(itemId, password);
        setPasswordSet(res.passwordSet);
        return true;
      } catch (e) {
        onError(failureText(e, 'Couldn’t change the password. Try again.'));
        return false;
      } finally {
        setBusy(false);
      }
    },
    [client, itemId, onError],
  );

  return { links, passwordSet, loading, error, busy, create, update, revoke, extend, setPassword };
}
