// The Photo Edit sample's files (docs/specs/031-photo/photo-pages.md "The Photo Edit template"): the picture, the two
// vignette masks and the two previews, shipped with the editor as static files and fetched only when the template is
// picked (this module is imported lazily). Each is checked against its blob id as it arrives, so the photos never name
// bytes the store would refuse.
import type { PhotoBlobEntry } from '@livedesign/api-schema';
import { blobIdOf } from '@livedesign/photo-engine';
import type { SampleBlobIds } from './photo-edit-sample';

type SampleFile = {
  role: keyof SampleBlobIds;
  id: string;
  type: 'image/jpeg' | 'image/webp';
  url: URL;
};

// Made by drawing the scene and compositing each page's stack with the photo engine (the PR that added them says
// how); a change to a file changes its id here, which the load test checks.
export const SAMPLE_FILES: readonly SampleFile[] = [
  {
    role: 'picture',
    id: '4nAJc4TyegzpyyhWJXzv3g',
    type: 'image/jpeg',
    url: new URL('./photo-edit-sample/lakeside.jpg', import.meta.url),
  },
  {
    role: 'storyMask',
    id: 'cy4PauHa6yhDjKAkSX29JQ',
    type: 'image/jpeg',
    url: new URL('./photo-edit-sample/story-mask.jpg', import.meta.url),
  },
  {
    role: 'postMask',
    id: '_920gDaoey-08Of1u-FNMg',
    type: 'image/jpeg',
    url: new URL('./photo-edit-sample/post-mask.jpg', import.meta.url),
  },
  {
    role: 'storyPreview',
    id: 'PL1MteAlWBShR0YSuygtXQ',
    type: 'image/webp',
    url: new URL('./photo-edit-sample/story-preview.webp', import.meta.url),
  },
  {
    role: 'postPreview',
    id: 'b1BN6TKBcGxoI83K39DEmg',
    type: 'image/webp',
    url: new URL('./photo-edit-sample/post-preview.webp', import.meta.url),
  },
];

export const SAMPLE_IDS = Object.fromEntries(
  SAMPLE_FILES.map((f) => [f.role, f.id]),
) as SampleBlobIds;

export type LoadedSample = { ids: SampleBlobIds; entries: PhotoBlobEntry[] };

/** Every file of the sample, fetched and checked; null when any cannot be had (offline, a failed request, bytes
 *  that are not the file's), and the template then lands as an unstarted photo. */
export async function loadPhotoEditSample(
  get: (url: URL) => Promise<Response> = (url) => fetch(url),
): Promise<LoadedSample | null> {
  try {
    const entries = await Promise.all(
      SAMPLE_FILES.map(async (f): Promise<PhotoBlobEntry> => {
        const res = await get(f.url);
        if (!res.ok) throw new Error(`${f.role}: ${res.status}`);
        const bytes = new Uint8Array(await res.arrayBuffer());
        if ((await blobIdOf(bytes)) !== f.id) throw new Error(`${f.role}: not the sample's bytes`);
        return { id: f.id, type: f.type, bytes };
      }),
    );
    return { ids: SAMPLE_IDS, entries };
  } catch (err) {
    console.warn('[photo] sample-unavailable', { error: String(err) });
    return null;
  }
}
