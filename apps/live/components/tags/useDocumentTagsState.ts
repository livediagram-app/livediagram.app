'use client';

// The reader's tags and which documents carry them (docs/specs/013-workspace/tags.md), with every change applied at
// once and the request behind it ("Optimistic changes"). A failed request puts the change back and says so in a toast:
// a tag change that silently vanished would lose the reader's grouping work.
//
// `enabled` false loads nothing until `request()` is called: the editor mounts the provider lazily so opening a
// document costs no extra request (the spec's "The editor's Explorer panel").

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  TAG_LIMIT,
  nextTagColour,
  normaliseTagName,
  sortTags,
  tagNameKey,
  type Tag,
} from '@liveplanner/api-schema';
import {
  apiCreateTag,
  apiDeleteTag,
  apiListTags,
  apiSetDocumentTag,
  apiUpdateTag,
  tagErrorCopy,
} from '@/lib/api/tags';
import { useToast } from '@/hooks/ui/useToast';
import { useLatest } from '@/hooks/ui/useLatest';
import { track } from '@/lib/telemetry';

type TagsStatus = 'idle' | 'loading' | 'ready' | 'error';

// Which tags each document carries, by id. Kept as one immutable map so a change copies one entry.
type Links = ReadonlyMap<string, ReadonlySet<string>>;

const EMPTY_SET: ReadonlySet<string> = new Set();

function withLink(links: Links, documentId: string, tagId: string, on: boolean): Links {
  const next = new Map(links);
  const tags = new Set(links.get(documentId) ?? EMPTY_SET);
  if (on) tags.add(tagId);
  else tags.delete(tagId);
  if (tags.size === 0) next.delete(documentId);
  else next.set(documentId, tags);
  return next;
}

function withoutTag(links: Links, tagId: string): Links {
  const next = new Map<string, ReadonlySet<string>>();
  for (const [doc, tags] of links) {
    if (!tags.has(tagId)) next.set(doc, tags);
    else if (tags.size > 1) next.set(doc, new Set([...tags].filter((t) => t !== tagId)));
  }
  return next;
}

/** Why a name can't be used, in the words the dialog and picker show; null when it can. */
export function tagNameProblem(
  name: string,
  tags: readonly Tag[],
  exceptId?: string,
): string | null {
  const clean = normaliseTagName(name);
  if (!clean) return name.trim() ? 'Keep the name to 32 characters' : 'Give the tag a name';
  const taken = tags.find((t) => t.id !== exceptId && tagNameKey(t.name) === tagNameKey(clean));
  return taken ? `You already have a tag called ${taken.name}` : null;
}

export function useDocumentTagsState(ownerId: string | null, enabled: boolean) {
  const toast = useToast();
  const [wanted, setWanted] = useState(enabled);
  const [tags, setTags] = useState<Tag[]>([]);
  const [links, setLinks] = useState<Links>(() => new Map());
  const [loaded, setLoaded] = useState<{ owner: string; ok: boolean } | null>(null);
  // Mirrors for the writers, which must read the current state to choose a direction or revert, and a state updater
  // is the wrong place for that (it may run during a later render).
  // A writer that changes the list also sets the mirror at once, so a second change before the re-render reads it.
  const tagsRef = useLatest(tags);
  const linksRef = useLatest(links);
  // Another owner (a sign-in, a sign-out) starts from nothing, dropped during render.
  const [forOwner, setForOwner] = useState(ownerId);
  if (ownerId !== forOwner) {
    setForOwner(ownerId);
    setTags([]);
    setLinks(new Map());
  }
  // A tag made a moment ago has no server row until its create lands, so a link to it waits for that.
  const pendingCreates = useRef(new Map<string, Promise<boolean>>());

  const status: TagsStatus =
    !ownerId || !wanted
      ? 'idle'
      : loaded?.owner !== ownerId
        ? 'loading'
        : loaded.ok
          ? 'ready'
          : 'error';

  const load = useCallback(async (owner: string, alive: () => boolean = () => true) => {
    try {
      const list = await apiListTags(owner);
      if (!alive()) return;
      const next = new Map<string, Set<string>>();
      for (const { tagId, documentId } of list.links) {
        const set = next.get(documentId) ?? new Set<string>();
        set.add(tagId);
        next.set(documentId, set);
      }
      setTags(sortTags(list.tags));
      setLinks(next);
      setLoaded({ owner, ok: true });
    } catch (error) {
      console.warn('[tags] list failed', { message: (error as Error).message });
      if (alive()) setLoaded({ owner, ok: false });
    }
  }, []);

  useEffect(() => {
    if (!ownerId || !wanted) return;
    let alive = true;
    void (async () => {
      await load(ownerId, () => alive);
    })();
    return () => {
      alive = false;
    };
  }, [ownerId, wanted, load]);

  const request = useCallback(() => setWanted(true), []);
  const reload = useCallback(async () => {
    if (ownerId) await load(ownerId);
  }, [ownerId, load]);

  const fail = useCallback(
    (op: string, error: unknown, revert: () => void) => {
      console.warn('[tags] save failed', { op, message: (error as Error).message });
      revert();
      toast.error(tagErrorCopy(error));
    },
    [toast],
  );

  const setDocumentTag = useCallback(
    (documentId: string, tagId: string, on: boolean) => {
      if (!ownerId) return;
      setLinks((l) => withLink(l, documentId, tagId, on));
      track('Explorer', on ? 'Added' : 'Removed', 'Tag');
      void (async () => {
        try {
          if ((await pendingCreates.current.get(tagId)) === false) return;
          await apiSetDocumentTag(ownerId, tagId, documentId, on);
        } catch (error) {
          fail('link', error, () => setLinks((l) => withLink(l, documentId, tagId, !on)));
        }
      })();
    },
    [ownerId, fail],
  );

  // Make a tag (and put it on `applyTo` when given). Returns the tag at once, or null when the name or the limit
  // refuses it; the server's answer lands behind.
  const createTag = useCallback(
    (name: string, opts: { colour?: string; applyTo?: string } = {}): Tag | null => {
      const clean = normaliseTagName(name);
      const current = tagsRef.current;
      if (!ownerId || !clean || current.length >= TAG_LIMIT) return null;
      if (tagNameProblem(clean, current)) return null;
      const tag: Tag = {
        id: crypto.randomUUID(),
        name: clean,
        colour: opts.colour ?? nextTagColour(current.map((t) => t.colour)),
        createdAt: Date.now(),
      };
      const next = sortTags([...current, tag]);
      tagsRef.current = next;
      setTags(next);
      track('Explorer', 'Created', 'Tag');
      const created = apiCreateTag(ownerId, { id: tag.id, name: tag.name, colour: tag.colour })
        .then(() => true)
        .catch((error: unknown) => {
          fail('create', error, () => {
            setTags((t) => t.filter((x) => x.id !== tag.id));
            setLinks((l) => withoutTag(l, tag.id));
          });
          return false;
        })
        .finally(() => pendingCreates.current.delete(tag.id));
      pendingCreates.current.set(tag.id, created);
      if (opts.applyTo) setDocumentTag(opts.applyTo, tag.id, true);
      return tag;
    },
    [ownerId, fail, setDocumentTag, tagsRef],
  );

  const updateTag = useCallback(
    (id: string, patch: { name?: string; colour?: string }) => {
      const before = tagsRef.current.find((t) => t.id === id);
      if (!ownerId || !before) return;
      const name = patch.name === undefined ? undefined : normaliseTagName(patch.name);
      if (patch.name !== undefined && (!name || tagNameProblem(name, tagsRef.current, id))) return;
      const after = {
        ...before,
        ...(name ? { name } : {}),
        ...(patch.colour ? { colour: patch.colour } : {}),
      };
      setTags((t) => sortTags(t.map((x) => (x.id === id ? after : x))));
      if (name && name !== before.name) track('Explorer', 'Renamed', 'Tag');
      if (patch.colour && patch.colour !== before.colour) track('Explorer', 'Changed', 'TagColour');
      void (async () => {
        try {
          await pendingCreates.current.get(id);
          await apiUpdateTag(ownerId, id, {
            ...(name ? { name } : {}),
            ...(patch.colour ? { colour: patch.colour } : {}),
          });
        } catch (error) {
          fail('update', error, () =>
            setTags((t) => sortTags(t.map((x) => (x.id === id ? before : x)))),
          );
        }
      })();
    },
    [ownerId, fail, tagsRef],
  );

  const deleteTag = useCallback(
    (id: string) => {
      const before = tagsRef.current.find((t) => t.id === id);
      if (!ownerId || !before) return;
      const linksBefore = linksRef.current;
      setTags((t) => t.filter((x) => x.id !== id));
      setLinks((l) => withoutTag(l, id));
      track('Explorer', 'Deleted', 'Tag');
      void (async () => {
        try {
          await pendingCreates.current.get(id);
          await apiDeleteTag(ownerId, id);
        } catch (error) {
          fail('delete', error, () => {
            setTags((t) => sortTags([...t, before]));
            setLinks(linksBefore);
          });
        }
      })();
    },
    [ownerId, fail, tagsRef, linksRef],
  );

  // The derived indexes every surface reads: a document's tags in tag order, and a tag's documents.
  const derived = useMemo(() => {
    const byId = new Map(tags.map((t) => [t.id, t]));
    const order = new Map(tags.map((t, i) => [t.id, i]));
    const documentsByTag = new Map<string, Set<string>>();
    for (const [doc, ids] of links) {
      for (const id of ids) {
        if (!byId.has(id)) continue;
        const set = documentsByTag.get(id) ?? new Set<string>();
        set.add(doc);
        documentsByTag.set(id, set);
      }
    }
    const tagsFor = (documentId: string): Tag[] => {
      const ids = links.get(documentId);
      if (!ids) return [];
      return [...ids]
        .map((id) => byId.get(id))
        .filter((t): t is Tag => t !== undefined)
        .sort((a, b) => order.get(a.id)! - order.get(b.id)!);
    };
    const documentsFor = (tagId: string): ReadonlySet<string> =>
      documentsByTag.get(tagId) ?? EMPTY_SET;
    return { tagById: byId, tagsFor, documentsFor };
  }, [tags, links]);

  // One stable object per change, so the context only re-renders its readers when the tags do.
  return useMemo(
    () => ({
      status,
      tags,
      ...derived,
      request,
      reload,
      createTag,
      updateTag,
      deleteTag,
      setDocumentTag,
    }),
    [status, tags, derived, request, reload, createTag, updateTag, deleteTag, setDocumentTag],
  );
}

export type DocumentTagsState = ReturnType<typeof useDocumentTagsState>;
