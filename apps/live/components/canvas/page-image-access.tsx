'use client';

// Who is asking for a page's picture (docs/specs/007-editor/illustrate-pages.md "Image
// backgrounds"): the identity and share code the image store needs, handed to the pages by the
// canvas, and the pictures the sheets paint, each fetched once while it is on a page.
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { LaidOutPage } from '@livediagram/document';
import { apiFetchImageBlobUrl } from '@/lib/api-client';

export type PageImageAccess = { ownerId: string; documentId: string; shareCode: string | null };

const PageImageAccessContext = createContext<PageImageAccess | null>(null);

export function PageImageAccessProvider({
  access,
  children,
}: {
  access: PageImageAccess | null | undefined;
  children: ReactNode;
}) {
  return (
    <PageImageAccessContext.Provider value={access ?? null}>
      {children}
    </PageImageAccessContext.Provider>
  );
}

/** The image store's access for this canvas; null where it has none (a preview, a test), where a
 *  picture paints as its tone and the Image category offers nothing to pick with. */
export function usePageImageAccess(): PageImageAccess | null {
  return useContext(PageImageAccessContext);
}

// The gallery pictures the pages paint (an offline document's inline bytes need no fetch).
function galleryIds(pages: readonly LaidOutPage[]): string[] {
  const ids = new Set<string>();
  for (const p of pages) {
    const fill = p.background?.fill;
    if (fill?.kind === 'image' && !fill.imageId.startsWith('data:')) ids.add(fill.imageId);
  }
  return [...ids].sort();
}

/**
 * Each page picture's blob URL by gallery id, fetched once when it first appears on a page and
 * revoked once no page paints it (or the canvas goes). Never refetched by a pan, a zoom or a
 * re-render, nor when another picture comes or goes: each id is fetched on its own.
 */
export function usePageImageSources(
  pages: readonly LaidOutPage[],
): (imageId: string) => string | undefined {
  return useImageSources(galleryIds(pages));
}

/** Each gallery picture's blob URL by id (see usePageImageSources): fetched once while it is
 *  wanted, revoked once it is not. Inline bytes (`data:` ids) are left to the caller. */
export function useImageSources(ids: readonly string[]): (imageId: string) => string | undefined {
  const access = usePageImageAccess();
  const key = [...new Set(ids.filter((id) => !id.startsWith('data:')))].sort().join('\n');
  const accessKey = access ? `${access.ownerId}\0${access.documentId}\0${access.shareCode}` : '';
  const [sources, setSources] = useState<ReadonlyMap<string, string>>(new Map());
  // Every id asked for under this access, with its URL once it came.
  const held = useRef(new Map<string, string | null>());
  // A new access (another document, a share code) starts over.
  useEffect(() => {
    const mine = held.current;
    return () => {
      for (const url of mine.values()) if (url) URL.revokeObjectURL(url);
      held.current = new Map();
      setSources(new Map());
    };
  }, [accessKey]);
  useEffect(() => {
    if (!access) return;
    const wanted = new Set(key ? key.split('\n') : []);
    const mine = held.current;
    let dropped = false;
    for (const [id, url] of mine) {
      if (wanted.has(id)) continue;
      if (url) URL.revokeObjectURL(url);
      mine.delete(id);
      dropped = true;
    }
    if (dropped) setSources(new Map([...mine].filter((e): e is [string, string] => !!e[1])));
    for (const id of wanted) {
      if (mine.has(id)) continue;
      mine.set(id, null);
      apiFetchImageBlobUrl(access.ownerId, id, {
        documentId: access.documentId,
        shareCode: access.shareCode,
      })
        .then((url) => {
          if (!url) {
            console.warn('[illustrate-page] picture unavailable', { imageId: id });
            return;
          }
          // Dropped (or the access changed) while it was on its way.
          if (held.current !== mine || !mine.has(id)) return URL.revokeObjectURL(url);
          mine.set(id, url);
          setSources((prev) => new Map(prev).set(id, url));
        })
        .catch(() => console.warn('[illustrate-page] picture failed', { imageId: id }));
    }
    // The access is read through its key: a fresh object with the same values refetches nothing.
    // oxlint-disable-next-line react-hooks-js/exhaustive-deps
  }, [key, accessKey]);
  return useMemo(() => (id: string) => sources.get(id), [sources]);
}
