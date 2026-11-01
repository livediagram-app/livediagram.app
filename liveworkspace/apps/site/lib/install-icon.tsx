import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ImageResponse } from 'next/og';

// liveworkspace.app's raster icons (liveworkspace/docs/specs/010-site/site.md "Installing"): its slate prism
// (app/icon.svg) drawn at the size a home screen, a notification or Apple's tile asks for, at export. `tile` paints
// it on white with a margin, for Apple's opaque tile (transparent pixels show as black there); without it the prism
// fills a transparent square, as the apps' own PNGs do.
const PRISM = `data:image/svg+xml,${encodeURIComponent(
  readFileSync(join(process.cwd(), 'app/icon.svg'), 'utf8'),
)}`;

export function installIconResponse(size: number, { tile = false } = {}): ImageResponse {
  const drawn = tile ? Math.round(size * 0.74) : size;
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: tile ? '#ffffff' : 'transparent',
      }}
    >
      <img src={PRISM} width={drawn} height={drawn} alt="" />
    </div>,
    { width: size, height: size },
  );
}
