// Removing pictures from the user's gallery from an agent (docs/specs/009-elements/images.md "Agents"): the MCP's
// delete_image and the CLI's `image rm`. Only the caller's own pictures (their gallery, `GET /api/images`), and by
// default never one still placed: the Image Gallery's own "Used in" (`GET /api/images/usage`) is read once for the
// call, and a placed picture is kept, naming where it is used, unless the caller forces it. A forced removal leaves
// every element that places it showing a broken picture. Each id answers what happened to it.

import type { ApiClient } from '@liveworkspace/api-client';
import { ApiError } from '@liveworkspace/api-client';
import { VerbRefusal } from '../define';
import { imageName, type GalleryUpload } from './gallery';

// The most pictures one call removes.
export const IMAGE_REMOVE_MAX = 20;

export type ImageUse = { id: string; name: string; app: string };

export type RemovedImage = {
  id: string;
  // deleted: gone from the gallery. in_use: kept, because items place it (usedIn). not_found: not in the caller's
  // gallery (another person's, already gone, or never an id).
  outcome: 'deleted' | 'in_use' | 'not_found';
  name?: string;
  usedIn?: ImageUse[];
};

export type RemovalReport = { results: RemovedImage[]; deleted: number; kept: number };

// Remove each of `ids` (deduplicated, in order) from the caller's gallery, refusing a placed one unless `force`.
export async function removeFromGallery(
  api: ApiClient,
  ids: readonly string[],
  { force }: { force: boolean },
): Promise<RemovalReport> {
  const wanted = [...new Set(ids)];
  if (wanted.length === 0 || wanted.length > IMAGE_REMOVE_MAX) {
    throw new VerbRefusal({
      status: 400,
      code: 'invalid_ids',
      message: `Name between 1 and ${IMAGE_REMOVE_MAX} image ids a call.`,
      hint: 'split the ids over several calls',
    });
  }
  // The gallery and its usage, once for the whole call, side by side.
  const [listed, used] = await Promise.all([
    api.json<{ images?: GalleryUpload[] }>('/images'),
    api.json<{ usage?: Record<string, ImageUse[]> }>('/images/usage'),
  ]);
  const own = new Map((listed.images ?? []).map((i) => [i.id, i]));
  const usage = used.usage ?? {};
  const results = await Promise.all(
    wanted.map(async (id): Promise<RemovedImage> => {
      const image = own.get(id);
      if (!image) return { id, outcome: 'not_found' };
      const name = imageName(image);
      const usedIn = usage[id] ?? [];
      if (usedIn.length > 0 && !force) return { id, outcome: 'in_use', name, usedIn };
      try {
        // The answer's body is not read: the api's delete says only that it went.
        await api.text(`/images/${encodeURIComponent(id)}`, { method: 'DELETE' });
      } catch (err) {
        // Gone between the listing and the delete: what the caller asked for is true.
        if (err instanceof ApiError && err.status === 404) return { id, outcome: 'not_found' };
        throw err;
      }
      return { id, outcome: 'deleted', name, ...(usedIn.length > 0 ? { usedIn } : {}) };
    }),
  );
  const deleted = results.filter((r) => r.outcome === 'deleted').length;
  return { results, deleted, kept: results.length - deleted };
}

// Where a kept picture is used, as a line: `"Q3 plan" (livedocuments), "Roadmap" (livediagram)`.
export function usedInText(usedIn: readonly ImageUse[], max = 5): string {
  const named = usedIn
    .slice(0, max)
    .map((u) => `${JSON.stringify(u.name || 'Untitled')} (${u.app})`);
  const more = usedIn.length > max ? ` and ${usedIn.length - max} more` : '';
  return `${named.join(', ')}${more}`;
}
