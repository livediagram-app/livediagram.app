import { describe, expect, it } from 'vitest';
import { pagesOf, photosOf, type Tab } from '@livedesign/design';
import { photoBlobIdsOf } from '@livedesign/photo-engine';
import { templateCanvasOverrides } from '@livedesign/templates';
import {
  POST_HEIGHT,
  POST_PAGE_NAME,
  SAMPLE_HEIGHT,
  STORY_PAGE_NAME,
  samplePost,
  sampleStory,
  takesPhotoEditSample,
  withPhotoEditSample,
  type SampleBlobIds,
} from './photo-edit-sample';

// docs/specs/031-photo/photo-pages.md "The Photo Edit template".
const ids: SampleBlobIds = {
  picture: 'picture_______________',
  storyMask: 'storyMask_____________',
  postMask: 'postMask______________',
  storyPreview: 'storyPreview__________',
  postPreview: 'postPreview___________',
};
// The tab the template lands: its one unstarted photo page.
const landed = (): Tab => ({
  id: 't1',
  name: 'Photo Edit',
  elements: [],
  ...templateCanvasOverrides('photo-edit'),
});

describe('the Photo Edit sample', () => {
  it('stacks the picture, a warm-up and a vignette through its mask, each read back as stored', () => {
    const story = sampleStory(ids);
    expect(story.layers.map((l) => [l.name, l.layerKind])).toEqual([
      ['Background', 'pixel'],
      ['Warm Up', 'adjustment'],
      ['Vignette', 'adjustment'],
    ]);
    expect(story.layers[2]!.mask?.pixels.source).toEqual({
      blob: 'storyMask_____________',
      width: 1080,
      height: 1920,
    });
    // Every field survives the defensive read a stored tab gets.
    expect(photosOf({ photos: { p: story } }).p).toEqual(story);
    expect(photosOf({ photos: { p: samplePost(ids) } }).p).toEqual(samplePost(ids));
  });

  it('crops the Post about the centre, keeping the picture past its edges', () => {
    const post = samplePost(ids);
    const bg = post.layers[0]!;
    expect([post.width, post.height]).toEqual([1080, POST_HEIGHT]);
    expect(bg.layerKind === 'pixel' && bg.offset).toEqual({
      x: 0,
      y: -(SAMPLE_HEIGHT - POST_HEIGHT) / 2,
    });
    expect(bg.layerKind === 'pixel' && bg.pixels.source?.height).toBe(SAMPLE_HEIGHT);
    expect(post.layers[2]!.mask?.pixels.source).toEqual({
      blob: 'postMask______________',
      width: 1080,
      height: 1350,
    });
  });

  it('sets the Story and a Post page after it, naming every file the store must hold', () => {
    const tab = withPhotoEditSample(landed(), ids);
    const pages = pagesOf(tab);
    expect(pages.map((p) => [p.name, p.kind])).toEqual([
      [STORY_PAGE_NAME, 'photo'],
      [POST_PAGE_NAME, 'photo'],
    ]);
    expect(pages[0]!.id).toBe(pagesOf(landed())[0]!.id);
    expect(pages[1]!.orientation).toBe('portrait');
    const photos = photosOf(tab);
    expect(photos[pages[0]!.id]).toEqual(sampleStory(ids));
    expect(photos[pages[1]!.id]).toEqual(samplePost(ids));
    expect(photoBlobIdsOf(tab)).toEqual(
      new Set([
        'picture_______________',
        'storyMask_____________',
        'postMask______________',
        'storyPreview__________',
        'postPreview___________',
      ]),
    );
  });

  it('leaves an existing tab as it is: a started photo, another page, another kind', () => {
    const once = withPhotoEditSample(landed(), ids);
    expect(takesPhotoEditSample(once)).toBe(false);
    expect(withPhotoEditSample(once, ids)).toBe(once);
    const started = {
      ...landed(),
      photos: {
        [pagesOf(landed())[0]!.id]: { width: 10, height: 10, layers: sampleStory(ids).layers },
      },
    } as Tab;
    expect(withPhotoEditSample(started, ids)).toBe(started);
    const logo: Tab = {
      id: 't2',
      name: 'Logo',
      elements: [],
      ...templateCanvasOverrides('blank-logo'),
    };
    expect(withPhotoEditSample(logo, ids)).toBe(logo);
    const plain: Tab = { id: 't3', name: 'Tab', elements: [] };
    expect(withPhotoEditSample(plain, ids)).toBe(plain);
  });
});
