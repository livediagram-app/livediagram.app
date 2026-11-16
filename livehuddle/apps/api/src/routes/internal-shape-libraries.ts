// GET /api/internal/shape-libraries?owner=: a person's read-only shape libraries for the Library's read in place, with
// the media key (liveworkspace/docs/specs/006-media/libraries.md "The old shape libraries, read in place"). The store
// is read as it is; nothing is written. Each shape is drawn as the Shape Libraries page draws it, a retired kind as its
// outline.

import { renderElementsToSvg, type Tab } from '@livehuddle/document';
import { resolveIconExportArt, resolveStickerArt } from '@liveworkspace/icons/resolve';
import { handleLegacyShapeLibrariesDoor } from '@liveworkspace/media';
import { personStore } from '../person-client';
import { json } from '../responses';
import type { Env } from '../types';

export function handleInternalShapeLibraries(request: Request, env: Env): Promise<Response> {
  return handleLegacyShapeLibrariesDoor({
    request,
    key: env.MEDIA_KEY,
    read: (owner) => personStore(env, owner).shapeLibraries(),
    draw: (item) =>
      renderElementsToSvg(
        {
          id: `library-item-${item.id}`,
          name: item.title,
          elements: item.elements,
        } as Tab,
        {
          padding: 4,
          background: 'transparent',
          resolveIconArt: resolveIconExportArt,
          resolveStickerArt,
          retiredOutlines: true,
        },
      ),
    json,
  });
}
