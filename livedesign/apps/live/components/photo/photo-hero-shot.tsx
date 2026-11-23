// A photo as the photo dialogs' hero art draws it (liveworkspace/docs/specs/004-index/dialog-hero-header.md "Art"):
// a plate with two hills and a sun, in the hero's tokens. Shared by the art that shows the photo itself (Make
// Sizes, Image Size, Canvas Size, Rotate, the filters), so they read as one family.
import type { ReactNode } from 'react';

const n = (v: number) => Math.round(v * 10) / 10;

/**
 * A photo at (x, y), w by h. `ground` is where its hills stand: the band's foot (30) for a photo that runs off it,
 * the photo's own foot otherwise. `stroke` is its outline: the accent for the one the drawing is about.
 */
export function heroShot(
  x: number,
  y: number,
  w: number,
  h: number,
  { ground = y + h, stroke = 'var(--hero-line)' }: { ground?: number; stroke?: string } = {},
): ReactNode {
  const rise = ground - y;
  return (
    <>
      <rect x={x} y={y} width={w} height={h} rx="3" fill="var(--hero-plate)" stroke={stroke} />
      <path
        d={`M${n(x + 1)} ${n(ground)}L${n(x + w * 0.34)} ${n(y + rise * 0.5)}L${n(x + w * 0.56)} ${n(y + rise * 0.76)}L${n(x + w * 0.74)} ${n(y + rise * 0.58)}L${n(x + w - 1)} ${n(ground)}Z`}
        fill="var(--hero-wash)"
      />
      <circle
        cx={n(x + w * 0.72)}
        cy={n(y + rise * 0.28)}
        r={n(Math.max(1.2, Math.min(w, rise) * 0.09))}
        fill="var(--hero-mark)"
      />
    </>
  );
}
