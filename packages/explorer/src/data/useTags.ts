'use client';

// The person's tags (at most TAG_LIMIT, one request), kept for every row's chips, the Tags page and the tag
// picker. Tagging an item patches its tagIds in the overlay, so every list shows the chip at once.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { IndexClient, Tag } from '@liveworkspace/index-client';
import { failureText } from './errors';
import { newId } from './useFolders';

export type TagStore = {
  tags: Tag[];
  byId: Map<string, Tag>;
  loading: boolean;
  create: (name: string, colour: string) => Promise<Tag | null>;
  rename: (id: string, name: string) => Promise<boolean>;
  remove: (id: string) => Promise<boolean>;
};

export function useTagStore(client: IndexClient, onError: (text: string) => void): TagStore {
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const latest = useRef(tags);
  latest.current = tags;

  useEffect(() => {
    let live = true;
    client
      .listTags()
      .then((res) => live && setTags(res.tags))
      .catch(() => {})
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [client]);

  const byId = useMemo(() => new Map(tags.map((t) => [t.id, t])), [tags]);

  const create = useCallback<TagStore['create']>(
    async (name, colour) => {
      const id = newId();
      const before = latest.current;
      setTags([...before, { id, name, colour, createdAt: Date.now() }]);
      try {
        const { tag } = await client.createTag({ id, name, colour });
        setTags((all) => all.map((t) => (t.id === id ? tag : t)));
        return tag;
      } catch (e) {
        setTags((all) => all.filter((t) => t.id !== id));
        onError(failureText(e, 'Couldn’t make that tag. Try again.'));
        return null;
      }
    },
    [client, onError],
  );

  const rename = useCallback<TagStore['rename']>(
    async (id, name) => {
      const old = latest.current.find((t) => t.id === id);
      if (!old) return false;
      setTags((all) => all.map((t) => (t.id === id ? { ...t, name } : t)));
      try {
        await client.updateTag(id, { name });
        return true;
      } catch (e) {
        setTags((all) => all.map((t) => (t.id === id ? old : t)));
        onError(failureText(e, 'Couldn’t rename that tag. Try again.'));
        return false;
      }
    },
    [client, onError],
  );

  const remove = useCallback<TagStore['remove']>(
    async (id) => {
      const before = latest.current;
      setTags(before.filter((t) => t.id !== id));
      try {
        await client.deleteTag(id);
        return true;
      } catch (e) {
        setTags(before);
        onError(failureText(e, 'Couldn’t delete that tag. Try again.'));
        return false;
      }
    },
    [client, onError],
  );

  return useMemo(
    () => ({ tags, byId, loading, create, rename, remove }),
    [tags, byId, loading, create, rename, remove],
  );
}
