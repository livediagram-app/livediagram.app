import { listPhotos, loadPhoto } from '../../../sticky-vision/scripts/photos';
import { photoDir, truthFor } from '../../../sticky-vision/scripts/truth';
import { idsFromBoxes, seamRadiusFor, threeClassMask, type Rect } from '../../src/mask';
import type { TileSource } from '../../src/train/tile';

// The eight labelled walls as training sources, each with the three-class
// mask its hand-traced boxes imply. Read from the private truth checkout at
// the detector's working size; nothing here is ever written anywhere.

export type RealWall = TileSource & { name: string; boxes: Rect[]; rgba: Uint8ClampedArray };

export const stemOf = (name: string) => name.replace(/\.[^.]+$/, '');

export function loadRealWalls(): RealWall[] {
  const dir = photoDir();
  return listPhotos(dir).flatMap((name) => {
    const truth = truthFor(name);
    if (!truth) return [];
    const image = loadPhoto(dir, name);
    const { width, height } = image;
    const rgb = new Uint8Array(width * height * 3);
    for (let p = 0; p < width * height; p += 1) {
      rgb[p * 3] = image.data[p * 4]!;
      rgb[p * 3 + 1] = image.data[p * 4 + 1]!;
      rgb[p * 3 + 2] = image.data[p * 4 + 2]!;
    }
    const boxes = truth.notes.map((n) => ({
      x: n.x * width,
      y: n.y * height,
      w: n.w * width,
      h: n.h * height,
    }));
    const ids = idsFromBoxes(boxes, width, height);
    const classes = threeClassMask(ids, width, height, (id) =>
      seamRadiusFor(boxes[id - 1]!.w, boxes[id - 1]!.h),
    );
    return [{ name: stemOf(name), width, height, rgb, classes, boxes, rgba: image.data }];
  });
}
