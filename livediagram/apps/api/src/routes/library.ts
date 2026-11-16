// /api/library: livediagram's door onto the Library every app shares (liveworkspace/docs/specs/006-media/libraries.md
// "Each app's door"). @liveworkspace/media's handleLibraryDoor does the work; this binds what is livediagram's: the
// kinds it draws, its element migration and check, its renderer for an item's preview, its media owner rule and the
// caller's teams claim. Saving is a person's act: an API token or a workbench session has no Library.

import {
  ELEMENT_TYPES,
  isValidElement,
  migrateIncomingElements,
  renderElementsToSvg,
  type Tab,
} from '@livediagram/document';
import { resolveIconExportArt, resolveStickerArt } from '@liveworkspace/icons/resolve';
import {
  handleLegacyShapeLibrariesDoor,
  handleLibraryDoor,
  libraryActorOf,
  libraryKitOf,
} from '@liveworkspace/media';
import { mediaClient, mediaOwner } from '../media';
import { personStore } from '../person-client';
import { json, missingAuth } from '../responses';
import type { Env } from '../types';
import type { RouteContext } from './context';

// Elements drawn as a library tile: the canvas's own DOM-free renderer, on a transparent ground.
export function drawLibraryElements(elements: readonly unknown[], name = ''): string {
  return renderElementsToSvg({ id: 'library-item', name, elements } as unknown as Tab, {
    padding: 4,
    background: 'transparent',
    resolveIconArt: resolveIconExportArt,
    resolveStickerArt,
  });
}

export const libraryKit = libraryKitOf({
  kinds: ELEMENT_TYPES,
  migrate: migrateIncomingElements,
  isValid: isValidElement,
  render: (elements) => drawLibraryElements(elements),
});

export async function handleLibrary(ctx: RouteContext): Promise<Response> {
  const owner = ctx.resolveOwner();
  if (!owner || ctx.token || ctx.workbench) return missingAuth();
  const actor = libraryActorOf(await mediaOwner(owner), ctx.teams);
  return handleLibraryDoor({
    method: ctx.request.method,
    path: ctx.segments.slice(2),
    actor,
    library: mediaClient(ctx.env)?.library ?? null,
    kit: libraryKit,
    readBody: async () => {
      const body: unknown = await ctx.request.json().catch(() => null);
      return typeof body === 'object' && body !== null && !Array.isArray(body)
        ? (body as Record<string, unknown>)
        : null;
    },
    json,
  });
}

// GET /api/internal/shape-libraries?owner=: a person's shape libraries for the Library's read in place, with the media
// key (libraries.md "The old shape libraries, read in place"). The store is read as it is; nothing is written.
export function handleInternalShapeLibraries(request: Request, env: Env): Promise<Response> {
  return handleLegacyShapeLibrariesDoor({
    request,
    key: env.MEDIA_KEY,
    read: (owner) => personStore(env, owner).shapeLibraries(),
    draw: (item) => drawLibraryElements(item.elements, item.title),
    json,
  });
}
