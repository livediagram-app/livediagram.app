'use client';

// The Posters' pictures for Real3DLayer (poster-pictures.ts): one set of textured quads per scene and reader, fed the
// posters' places each time the pieces are built, moved with a drag, and put back when a drag ends without a change.
// Reads pictures as the Image element does (the reader's own identity, the share code a visitor carries).

import { useEffect, useMemo, useRef } from 'react';
import type * as THREE from 'three';
import { posterPicture, type Element } from '@livehuddle/document';
import { apiFetchImageBlobUrl, releaseImageBlobUrl } from '@/lib/api-client';
import {
  createPosterPictures,
  type PosterPictureEntry,
  type PosterPictures,
} from './poster-pictures';

/** Whose pictures to read: the reader, the document and a visitor's share code (BoxedElementView's imageContext). */
export type PosterPictureSource = { ownerId: string; documentId: string; shareCode: string | null };

/** Each poster's picture place (PiecesMesh.posterPictures) with the picture it frames now. */
export function posterEntries(
  places: ReadonlyMap<string, readonly number[]>,
  byId: ReadonlyMap<string, Element>,
): Map<string, PosterPictureEntry> {
  const out = new Map<string, PosterPictureEntry>();
  for (const [id, corners] of places)
    out.set(id, { corners, imageId: posterPicture(byId.get(id)) });
  return out;
}

export function usePosterPictures(
  scene: () => THREE.Scene | null,
  source: PosterPictureSource | undefined,
) {
  const pictures = useRef<PosterPictures | null>(null);
  const last = useRef<ReadonlyMap<string, PosterPictureEntry>>(new Map());
  const hiddenRef = useRef<ReadonlySet<string>>(new Set());
  const sourceRef = useRef(source);
  const sceneRef = useRef(scene);
  useEffect(() => {
    sourceRef.current = source;
    sceneRef.current = scene;
  });
  const key = source ? [source.ownerId, source.documentId, source.shareCode ?? ''].join('\0') : '';
  useEffect(() => {
    const s = sceneRef.current();
    const src = sourceRef.current;
    if (!s || !src || !key) return;
    const made = createPosterPictures({
      // Offline Mode keeps a picture's bytes in its id (a data: URI): nothing to fetch, nothing to give back.
      load: async (imageId, maxEdge) =>
        imageId.startsWith('data:')
          ? imageId
          : apiFetchImageBlobUrl(src.ownerId, imageId, {
              documentId: src.documentId,
              shareCode: src.shareCode,
              maxEdge,
            }),
      release: (url) => {
        if (!url.startsWith('data:')) releaseImageBlobUrl(url);
      },
    });
    s.add(made.object);
    pictures.current = made;
    made.set(last.current);
    made.hide(hiddenRef.current);
    return () => {
      s.remove(made.object);
      made.dispose();
      if (pictures.current === made) pictures.current = null;
    };
  }, [key]);
  return useMemo(
    () => ({
      /** Every poster now (the pieces were built). */
      set(entries: ReadonlyMap<string, PosterPictureEntry>) {
        last.current = entries;
        pictures.current?.set(entries);
      },
      /** Hides these posters' pictures, their wall cut down (wall-held-pieces.ts); the rest show. */
      hide(ids: ReadonlySet<string>) {
        hiddenRef.current = ids;
        pictures.current?.hide(ids);
      },
      /** The posters a drag carries, where it carries them. */
      move(places: ReadonlyMap<string, readonly number[]>) {
        pictures.current?.move(places);
      },
      /** The posters a drag carried, back where the board last built them. */
      restore(ids: Iterable<string>) {
        const back = new Map<string, readonly number[]>();
        for (const id of ids) {
          const entry = last.current.get(id);
          if (entry) back.set(id, entry.corners);
        }
        pictures.current?.move(back);
      },
    }),
    [],
  );
}
