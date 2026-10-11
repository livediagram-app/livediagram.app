// The branded social card (Open Graph + Twitter, 1200x630) every public app renders through next/og at
// build time (docs/specs/019-marketing/marketing-site.md "SEO and metadata"): marketing's brand card and
// /features/<id> cards, and the help centre's per-article cards (docs/specs/018-help/help-app.md "SEO").
// Plain JSX with inline styles, the subset next/og's renderer understands; each app keeps its own
// ImageResponse route, since per-route config can't be shared through a module.

import { brandMarkSvg } from './brand-mark-geometry';
import { sentencePitch } from './site';

// The full mark on the card's light ground, as a data URI for next/og's resvg.
const MARK_DATA_URI = `data:image/svg+xml,${encodeURIComponent(brandMarkSvg({ variant: 'full', scheme: 'light' }))}`;

// The subtitle a page's own social card shows (marketing's /features/<id> cards, the help centre's
// article cards). The card sets it at 32px in an 880px column, so about fifty characters a line; past two lines it runs
// into the footer pill. The first sentence is used when it fits, otherwise the text is cut at the last
// whole word that fits, so the card never ends mid-word.
export const CARD_SUBTITLE_MAX = 100;

export function cardSubtitle(text: string, max = CARD_SUBTITLE_MAX): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  const sentence = clean.match(/^.+?[.!?](?=\s)/)?.[0];
  if (sentence && sentence.length <= max) return sentence;
  const cut = clean.slice(0, max - 1);
  const space = cut.lastIndexOf(' ');
  const words = (space > 0 ? cut.slice(0, space) : cut).replace(/[\s,;:.]+$/, '');
  return `${words}…`;
}

// The social card's JSX, for next/og's ImageResponse (1200x630). Called with no args for the homepage
// (the default headline + sub); a page with its own card passes `{ kicker, title, subtitle }` to show
// its own headline on the same branded shell, and `footer` to replace the footer's line (the help
// centre's cards name the help centre).
export type SocialCardOptions = {
  kicker?: string;
  title?: string;
  subtitle?: string;
  footer?: string;
};

export function renderSocialCard(opts?: SocialCardOptions) {
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
        {/* The brand lockup: the full Living Prism mark, then the wordmark with
            "live" in the sky-600 accent the marketing Brand uses. */}
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
          <img src={MARK_DATA_URI} width={64} height={64} alt="" />
          <div style={{ display: 'flex' }}>
            <span style={{ color: '#0284c7' }}>live</span>
            <span>diagram</span>
          </div>
        </div>

        {/* Headline + sub. Default = the hero copy spine; per-category cards
            pass their own kicker/title/subtitle. */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
          {opts?.kicker ? (
            <div
              style={{
                fontSize: 30,
                fontWeight: 600,
                color: '#0284c7',
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
              }}
            >
              {opts.kicker}
            </div>
          ) : null}
          <div
            style={{
              fontSize: opts?.title ? 72 : 80,
              fontWeight: 600,
              color: '#0f172a',
              letterSpacing: '-0.03em',
              lineHeight: 1.05,
              maxWidth: 980,
              display: 'flex',
              flexWrap: 'wrap',
            }}
          >
            {opts?.title ? (
              <span>{opts.title}</span>
            ) : (
              <>
                <span>Diagram together,&nbsp;</span>
                <span style={{ color: '#0284c7' }}>live</span>
                <span>.</span>
              </>
            )}
          </div>
          <div
            style={{
              fontSize: 32,
              color: '#475569',
              lineHeight: 1.3,
              maxWidth: 880,
            }}
          >
            {opts?.subtitle ?? sentencePitch()}
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
          <div>{opts?.footer ?? 'No sign-up. Open the link, start drawing.'}</div>
        </div>
      </div>
    </div>
  );
}
