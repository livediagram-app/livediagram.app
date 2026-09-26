import { ImageResponse } from 'next/og';
import { brandMarkSvg } from '@livediagram/ui';

// iOS home-screen tile. Next.js convention: app/apple-icon.tsx →
// /apple-icon.png + the <link rel="apple-touch-icon"> tag at build
// time. We render it (rather than reuse public/livediagram-icon-*.png)
// because iOS composites apple-touch-icons onto an OPAQUE tile: a
// transparent PNG renders its empty pixels as black, which would frame
// the thin brand mark in a black square. So we paint a white
// background and centre the same glyph as app/icon.svg on it. iOS adds
// its own rounded-corner mask, so we ship a full-bleed square.
//
// `dynamic = 'force-static'` is required for `output: 'export'`: the
// route handler must resolve fully at build time, the same gate
// opengraph-image.tsx / robots.ts / sitemap.ts use.

export const dynamic = 'force-static';
export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

// The brand mark (the same shapes as app/icon.svg, from the shared Brand
// module). Passed to <img> as a data URI so next/og's resvg pass rasterises
// it with full SVG fidelity (including the decorative arc paths).
const ICON_DATA_URI = `data:image/svg+xml,${encodeURIComponent(brandMarkSvg())}`;

export default function AppleIcon() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#ffffff',
      }}
    >
      <img src={ICON_DATA_URI} width={132} height={132} alt="" />
    </div>,
    { ...size },
  );
}
