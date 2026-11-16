// The Photo Edit template's sample (docs/specs/031-photo/photo-pages.md "The Photo Edit template"): a lakeside at
// dawn, already edited, in two sizes. Pure: the photos the sample's pages hold, given the blob ids of its files, and
// the tab with them set. The files themselves, and storing them, are photo-edit-sample-load.ts's.
import {
  newPhotoPage,
  nextPageId,
  pagesOf,
  photosOf,
  withPages,
  withPhoto,
  type Page,
  type Tab,
} from '@livedesign/design';
import type { Photo, PhotoLayer } from '@livedesign/photo-engine';

// The picture's size: an upright phone photo, an Instagram Story as it is.
export const SAMPLE_WIDTH = 1080;
export const SAMPLE_HEIGHT = 1920;
// The Instagram Post Make Sizes makes from it (make-sizes.ts PHOTO_SIZE_FORMATS): the same width, so cropped about
// the centre with no scaling.
export const POST_WIDTH = 1080;
export const POST_HEIGHT = 1350;

export const STORY_PAGE_NAME = 'Instagram Story';
export const POST_PAGE_NAME = 'Instagram Post';

// The sample's files by role, each named in the photos by its blob id.
export type SampleBlobIds = {
  picture: string;
  storyMask: string;
  postMask: string;
  storyPreview: string;
  postPreview: string;
};

// Fixed layer ids, unique in each photo.
export const SAMPLE_LAYER_IDS = {
  background: 'ly-5a3e0001',
  warm: 'ly-5a3e0002',
  vignette: 'ly-5a3e0003',
} as const;

// The stack of a page of the sample: the picture kept whole as its source (at `offset` when cropped), a Warm Up
// photo filter, and a Vignette that darkens the edges through its mask (black at the centre hides it there).
function sampleStack(
  picture: string,
  mask: { blob: string; width: number; height: number },
  offset?: { x: number; y: number },
): PhotoLayer[] {
  return [
    {
      id: SAMPLE_LAYER_IDS.background,
      name: 'Background',
      layerKind: 'pixel',
      pixels: { tiles: {}, source: { blob: picture, width: SAMPLE_WIDTH, height: SAMPLE_HEIGHT } },
      ...(offset ? { offset } : {}),
    },
    {
      id: SAMPLE_LAYER_IDS.warm,
      name: 'Warm Up',
      layerKind: 'adjustment',
      adjustment: {
        id: 'photo-filter',
        params: { colour: '#ec8a00', density: 0.2, preserveLuminosity: true },
      },
    },
    {
      id: SAMPLE_LAYER_IDS.vignette,
      name: 'Vignette',
      layerKind: 'adjustment',
      adjustment: { id: 'exposure', params: { exposure: -1.5, offset: 0, gamma: 1 } },
      mask: { pixels: { tiles: {}, source: mask } },
    },
  ];
}

/** The Story: the whole picture. */
export function sampleStory(ids: SampleBlobIds): Photo {
  return {
    width: SAMPLE_WIDTH,
    height: SAMPLE_HEIGHT,
    layers: sampleStack(ids.picture, {
      blob: ids.storyMask,
      width: SAMPLE_WIDTH,
      height: SAMPLE_HEIGHT,
    }),
    preview: ids.storyPreview,
  };
}

/** The Post: the Story as Make Sizes makes it, cropped about the centre (the picture past its top and bottom kept),
 *  its vignette's mask drawn for its own shape. */
export function samplePost(ids: SampleBlobIds): Photo {
  return {
    width: POST_WIDTH,
    height: POST_HEIGHT,
    layers: sampleStack(
      ids.picture,
      { blob: ids.postMask, width: POST_WIDTH, height: POST_HEIGHT },
      { x: 0, y: -Math.round((SAMPLE_HEIGHT - POST_HEIGHT) / 2) },
    ),
    preview: ids.postPreview,
  };
}

/** Whether the tab is the Photo Edit template as it lands: one photo page, not started. Only such a tab takes the
 *  sample, so an existing tab (a started photo, a page added) is never touched. */
export function takesPhotoEditSample(tab: Tab): boolean {
  const pages = pagesOf(tab);
  if (pages.length !== 1 || pages[0]!.kind !== 'photo') return false;
  const photo = photosOf(tab)[pages[0]!.id];
  return !photo || photo.layers.length === 0;
}

/** The tab with the sample set: its page the Story, a Post page after it. The same tab back when it takes none. */
export function withPhotoEditSample(tab: Tab, ids: SampleBlobIds): Tab {
  if (!takesPhotoEditSample(tab)) return tab;
  const [first] = pagesOf(tab);
  const story: Page = { ...first!, name: STORY_PAGE_NAME };
  const post: Page = {
    ...newPhotoPage(nextPageId([first!]), POST_WIDTH, POST_HEIGHT),
    name: POST_PAGE_NAME,
  };
  const paged = withPages(tab, [story, post]);
  return withPhoto(withPhoto(paged, story.id, sampleStory(ids)), post.id, samplePost(ids));
}
