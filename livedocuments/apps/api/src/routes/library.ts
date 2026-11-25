// /api/library: livedocuments's door onto the Library every app shares (liveworkspace/docs/specs/006-media/libraries.md
// "Each app's door"). @liveworkspace/media's handleLibraryDoor does the work; this binds what is livedocuments's: the
// kinds it draws, its element migration and check, its renderer for an item's preview, its media owner rule and the
// caller's teams claim. Saving is a person's act: an API token or a workbench session has no Library.

import {
  ELEMENT_TYPES,
  isSavedDesignElement,
  isValidElement,
  migrateIncomingElements,
  renderElementsToSvg,
  SAVED_DESIGN_KIND,
  savedDesignElement,
  savedDesignOf,
  savedDesignPreview,
  type Tab,
} from '@livedocuments/document';
import { resolveIconExportArt, resolveStickerArt } from '@liveworkspace/icons/resolve';
import { accountsTeamReader, createTeamAccess } from '@liveworkspace/index-app';
import {
  handleLibraryDoor,
  libraryActorOf,
  libraryKitOf,
  type LibraryDoorKit,
} from '@liveworkspace/media';
import { accountCredentials } from '../auth/accounts';
import { mediaClient, mediaOwner } from '../media';
import { json, missingAuth } from '../responses';
import type { RouteContext } from './context';

// The caller's teams as accounts has them now, remembered for a moment (@liveworkspace/index-app createTeamAccess).
const teamAccess = createTeamAccess();

// Elements drawn as a library tile: the canvas's own DOM-free renderer, on a transparent ground; a picture from the
// small copy the save sent (`imageHref`), else as its name.
export function drawLibraryElements(
  elements: readonly unknown[],
  name = '',
  imageHref?: (imageId: string) => string | undefined,
): string {
  return renderElementsToSvg({ id: 'library-item', name, elements } as unknown as Tab, {
    padding: 4,
    background: 'transparent',
    resolveIconArt: resolveIconExportArt,
    resolveStickerArt,
    resolveImageHref: imageHref,
  });
}

const elementKit = libraryKitOf({
  kinds: ELEMENT_TYPES,
  migrate: migrateIncomingElements,
  isValid: isValidElement,
  render: (elements, imageHref) => drawLibraryElements(elements, '', imageHref),
});

// The elements livedocuments keeps, and a saved Page Design (docs/specs/011-theme/page-designs.md "Saved designs"):
// one element of its own kind, kept whole, with a preview that carries the design. A saved design's element beside
// others is left out, so such a save is refused as any element that fails the check.
export const libraryKit: LibraryDoorKit = {
  kinds: new Set([...ELEMENT_TYPES, SAVED_DESIGN_KIND]),
  clean: (elements) => {
    const design = savedDesignOf(elements);
    if (design) return [savedDesignElement(design)];
    return elementKit.clean(elements.filter((el) => !isSavedDesignElement(el)));
  },
  preview: (elements, pictures) => {
    const design = savedDesignOf(elements);
    return design ? savedDesignPreview(design) : elementKit.preview(elements, pictures);
  },
};

export async function handleLibrary(ctx: RouteContext): Promise<Response> {
  // The door's verbs (handleLibraryDoor): GET the list, POST save and place, PUT rename, DELETE.
  const method = ctx.request.method;
  if (method !== 'GET' && method !== 'POST' && method !== 'PUT' && method !== 'DELETE') {
    return json({ error: 'not_found' }, { status: 404 });
  }
  const owner = ctx.resolveOwner();
  if (!owner || ctx.token || ctx.workbench) return missingAuth();
  const actor = libraryActorOf(await mediaOwner(owner), ctx.teams);
  return handleLibraryDoor({
    method,
    // Read by literal index, so the route parity probe can follow it.
    path: [ctx.segments[2], ctx.segments[3], ctx.segments[4]].filter(
      (s): s is string => s !== undefined,
    ),
    actor,
    library: mediaClient(ctx.env)?.library ?? null,
    // The caller's teams as they are now: the token's claim, and a team joined since it was minted (libraries.md "Who
    // may do what"), read from accounts, never from the request.
    currentActor: async (claimed) =>
      libraryActorOf(
        claimed.owner,
        await teamAccess.currentTeams(
          accountsTeamReader(accountCredentials(ctx.env)),
          owner,
          ctx.teams ?? null,
        ),
      ),
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
