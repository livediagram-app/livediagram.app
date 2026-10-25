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

  const update = useCallback<ShareLinksState['update']>(
    async (code, input) => {
      const old = latest.current.find((l) => l.code === code);
      if (!old) return false;
      replace({ ...old, ...input } as ShareLink);
      try {
        const { link } = await client.updateShareLink(code, input);
        replace(link);
        return true;
      } catch (e) {
        replace(old);
        onError(failureText(e, 'Couldn’t change that link. Try again.'));
        return false;
      }
    },
    [client, onError],
  );

  const revoke = useCallback<ShareLinksState['revoke']>(
    async (code) => {
      const old = latest.current.find((l) => l.code === code);
      setLinks((all) => all.filter((l) => l.code !== code));
      try {
        await client.revokeShareLink(code);
        return true;
      } catch (e) {
        if (old) setLinks((all) => [old, ...all]);
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
