// Is this image a photograph, or a drawing (a screenshot of a digital board, a
// wall drawn in a test)? A camera's sensor noise, the paper's grain and JPEG's
// wobble leave almost no two neighbouring pixels of a photograph exactly equal
// (0.09-0.30 of them on the eight labelled walls, the most on a whiteboard's
// blown-out white); a screen fills whole regions with one colour to the bit
// (0.95 and more on every drawn board). The boundary model learnt
// photographs: a flat drawing is not asked of it (docs/research/vision/experiments/o-flat.md).

type Rgba = { width: number; height: number; data: Uint8ClampedArray };

// Anywhere between the photographs' 0.30 and the drawings' 0.95 separates the
// two sets alike; the middle keeps the widest berth on both sides.
export const FLAT_IMAGE_SHARE = 0.6;

// The share of horizontally neighbouring pixel pairs whose RGB is exactly
// equal.
export function flatShareOf(image: Rgba): number {
  const { width, height, data } = image;
  if (width < 2 || height < 1) return 0;
  let same = 0;
  for (let y = 0; y < height; y += 1) {
    let o = y * width * 4;
    for (let x = 0; x + 1 < width; x += 1, o += 4) {
      if (data[o] === data[o + 4] && data[o + 1] === data[o + 5] && data[o + 2] === data[o + 6])
        same += 1;
    }
  }
  return same / ((width - 1) * height);
}

export function isFlatImage(image: Rgba): boolean {
  return flatShareOf(image) >= FLAT_IMAGE_SHARE;
}
