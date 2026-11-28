// docs/specs/009-elements/poster.md "Performance": each poster's picture is a quad of its own with one bounded
// texture, loaded once per picture, released when the picture changes or the poster goes.
import { describe, expect, it, vi } from 'vitest';
import {
  boundedSize,
  coverUvs,
  createPosterPictures,
  placeAspect,
  POSTER_TEXTURE_EDGE,
} from './poster-pictures';

const corners = (x = 0) => [x, 0, 0, x + 40, 0, 0, x + 40, 0, 60, x, 0, 60];
const flush = () => new Promise((r) => setTimeout(r, 0));

function rig() {
  const load = vi.fn(async (id: string) => `blob:${id}`);
  const release = vi.fn();
  const decode = vi.fn(async (_url: string, edge: number) => {
    expect(edge).toBe(POSTER_TEXTURE_EDGE);
    return { width: 800, height: 600 } as unknown as HTMLCanvasElement;
  });
  const pics = createPosterPictures({ load, release }, decode);
  return { pics, load, release, decode };
}

describe('poster pictures', () => {
  it('crops a picture to fill its place (cover), never stretching it', () => {
    expect(Array.from(coverUvs(1, 1))).toEqual([0, 0, 1, 0, 1, 1, 0, 1]);
    // A landscape picture in a portrait place keeps its middle.
    const uv = coverUvs(2, 0.5);
    expect(uv[0]).toBeCloseTo(0.375);
    expect(uv[2]).toBeCloseTo(0.625);
    expect(uv[5]).toBe(1);
    expect(placeAspect(corners())).toBeCloseTo(40 / 60);
  });

  it('bounds a texture to the longest edge', () => {
    expect(boundedSize(4000, 3000, 1024)).toEqual({ width: 1024, height: 768 });
    expect(boundedSize(300, 200, 1024)).toEqual({ width: 300, height: 200 });
  });

  it('shows nothing for an empty poster, and loads a picture once', async () => {
    const { pics, load, release } = rig();
    pics.set(new Map([['p', { corners: corners(), imageId: null }]]));
    await flush();
    expect(load).not.toHaveBeenCalled();
    expect(pics.textures()).toBe(0);
    pics.set(new Map([['p', { corners: corners(), imageId: 'img_a' }]]));
    await flush();
    expect(pics.textures()).toBe(1);
    expect(pics.object.children[0]!.visible).toBe(true);
    // The URL goes back once decoded.
    expect(release).toHaveBeenCalledWith('blob:img_a');
    // The board rebuilding with the same picture loads nothing again; a move only moves it.
    pics.set(new Map([['p', { corners: corners(10), imageId: 'img_a' }]]));
    pics.move(new Map([['p', corners(20)]]));
    await flush();
    expect(load).toHaveBeenCalledTimes(1);
    expect(pics.textures()).toBe(1);
  });

  it('releases the old texture on a change, and everything when a poster goes or it closes', async () => {
    const { pics, load } = rig();
    pics.set(new Map([['p', { corners: corners(), imageId: 'img_a' }]]));
    await flush();
    const mesh = pics.object.children[0] as unknown as {
      material: { map: { dispose: () => void } };
    };
    const first = mesh.material.map;
    const gone = vi.spyOn(first, 'dispose');
    pics.set(new Map([['p', { corners: corners(), imageId: 'img_b' }]]));
    expect(gone).toHaveBeenCalledTimes(1);
    await flush();
    expect(load).toHaveBeenCalledTimes(2);
    expect(pics.textures()).toBe(1);
    pics.set(new Map());
    expect(pics.object.children).toHaveLength(0);
    expect(pics.textures()).toBe(0);
    pics.set(new Map([['q', { corners: corners(), imageId: 'img_c' }]]));
    pics.dispose();
    await flush();
    // A load that lands after it closed shows nothing.
    expect(pics.textures()).toBe(0);
  });

  it('drops a load that finishes after its picture changed', async () => {
    let finish: (v: string) => void = () => {};
    const load = vi
      .fn<(id: string) => Promise<string | null>>()
      .mockImplementationOnce(() => new Promise((r) => (finish = r)))
      .mockImplementation(async (id) => `blob:${id}`);
    const pics = createPosterPictures(
      { load, release: vi.fn() },
      async () => ({ width: 10, height: 10 }) as unknown as HTMLCanvasElement,
    );
    pics.set(new Map([['p', { corners: corners(), imageId: 'slow' }]]));
    pics.set(new Map([['p', { corners: corners(), imageId: null }]]));
    finish('blob:slow');
    await flush();
    expect(pics.textures()).toBe(0);
  });
});
