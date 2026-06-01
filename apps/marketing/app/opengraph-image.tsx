import { ImageResponse } from 'next/og';

// Open Graph + Twitter social card (1200x630). Rendered to a static
// PNG at build time by Next.js's `output: 'export'` pipeline so the
// asset ships baked into `out/`; no runtime dependency. Replaces
// the prior empty-preview state where pasting livediagram.app into
// Slack / Twitter / LinkedIn produced a blank card.
//
// Sibling `twitter-image.tsx` mirrors the same template so the
// Twitter card and OG card stay byte-identical. Both surfaces want
// a 1.91:1 frame at this resolution.
//
// `dynamic = 'force-static'` is required for `output: 'export'`:
// the route handler must be declared fully static so Next resolves
// it at build time, not runtime. The same gate that robots.ts /
// sitemap.ts use.

export const dynamic = 'force-static';
export const alt = 'livediagram: a real-time multiplayer canvas for diagrams and mindmaps';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function OpenGraphImage() {
  return new ImageResponse(renderSocialCard(), { ...size });
}

// Shared JSX for the OG + Twitter cards. Kept here so the two
// route handlers can't drift.
export function renderSocialCard() {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: 'linear-gradient(135deg, #f0f9ff 0%, #ffffff 60%, #e0f2fe 100%)',
        padding: '72px 96px',
        position: 'relative',
      }}
    >
      {/* Decorative grid backdrop, echoing the editor's dot-grid canvas. */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: 'radial-gradient(circle at center, #cbd5e1 1.5px, transparent 1.5px)',
          backgroundSize: '32px 32px',
          opacity: 0.4,
        }}
      />

      {/* Foreground content sits above the grid. */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          zIndex: 1,
          flex: 1,
          justifyContent: 'space-between',
        }}
      >
        {/* Wordmark. Sky-600 accent matches the marketing Brand. */}
        <div
          style={{
            fontSize: 44,
            fontWeight: 600,
            color: '#0c4a6e',
            letterSpacing: '-0.02em',
            display: 'flex',
            alignItems: 'center',
            gap: 16,
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 12,
              background: '#0284c7',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontSize: 36,
            }}
          >
            ld
          </div>
          livediagram
        </div>

        {/* Headline + sub. Same copy spine as the hero. */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
          <div
            style={{
              fontSize: 80,
              fontWeight: 600,
              color: '#0f172a',
              letterSpacing: '-0.03em',
              lineHeight: 1.05,
              maxWidth: 980,
              display: 'flex',
              flexWrap: 'wrap',
            }}
          >
            <span>A picture tells a thousand words,&nbsp;</span>
            <span style={{ color: '#0284c7' }}>tell your story.</span>
          </div>
          <div
            style={{
              fontSize: 32,
              color: '#475569',
              lineHeight: 1.3,
              maxWidth: 880,
            }}
          >
            A real-time multiplayer canvas for diagrams and mindmaps.
          </div>
        </div>

        {/* Footer pill. Mirrors the hero CTA text without rendering a button. */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            fontSize: 24,
            color: '#475569',
          }}
        >
          <div
            style={{
              background: '#0284c7',
              color: 'white',
              borderRadius: 999,
              padding: '10px 22px',
              fontWeight: 500,
            }}
          >
            livediagram.app
          </div>
          <div>No sign-up. Open the link, start drawing.</div>
        </div>
      </div>
    </div>
  );
}
