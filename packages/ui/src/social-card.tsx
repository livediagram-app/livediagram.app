// The branded social card (Open Graph + Twitter, 1200x630) every public app renders through next/og at
// build time (docs/specs/019-marketing/marketing-site.md "SEO and metadata" in each product): marketing's
// brand card and its per-page cards, and the help centre's per-article cards
// (docs/specs/018-help/help-app.md "SEO"). Plain JSX with inline styles, the subset next/og's renderer
// understands; each app keeps its own ImageResponse route, since per-route config can't be shared through
// a module. The card is one shape for every product; what is a product's own (its mark, its wordmark,
// colours and copy) it hands in through createSocialCard.

// The subtitle a page's own social card shows (marketing's per-page cards, the help centre's
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

// What a product's card is drawn from.
export type SocialCardConfig = {
  // The full mark on the card's light ground, as SVG markup (brandMarkSvg({ variant: 'full', scheme: 'light' })).
  markSvg: string;
  // The wordmark after its accented "live" ('diagram' for livediagram).
  wordmark: string;
  // The footer pill: the product's domain.
  domain: string;
  // The default headline's lead, before its accented "live." ('Diagram together,').
  headline: string;
  // The default subtitle: the product's pitch as a sentence.
  pitch: () => string;
  // The footer's default line.
  footer: string;
  colours: {
    // The ground's two tints, either side of white (top left, bottom right).
    ground: readonly [from: string, to: string];
    // The wordmark's ink.
    ink: string;
    // The accent: "live", the kicker, the headline's "live" and the footer pill. A brand step dark
    // enough for text on white.
    accent: string;
  };
};

export function createSocialCard(config: SocialCardConfig) {
  const { colours } = config;
  // The mark as a data URI for next/og's resvg.
  const markDataUri = `data:image/svg+xml,${encodeURIComponent(config.markSvg)}`;
  const ground = `linear-gradient(135deg, ${colours.ground[0]} 0%, #ffffff 60%, ${colours.ground[1]} 100%)`;

  return function renderSocialCard(opts?: SocialCardOptions) {
    return (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          background: ground,
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
              "live" in the accent the marketing Brand uses. */}
          <div
            style={{
              fontSize: 44,
              fontWeight: 600,
              color: colours.ink,
              letterSpacing: '-0.02em',
              display: 'flex',
              alignItems: 'center',
              gap: 16,
            }}
          >
            <img src={markDataUri} width={64} height={64} alt="" />
            <div style={{ display: 'flex' }}>
              <span style={{ color: colours.accent }}>live</span>
              <span>{config.wordmark}</span>
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
                  color: colours.accent,
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
                  <span>{`${config.headline}\u00a0`}</span>
                  <span style={{ color: colours.accent }}>live</span>
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
              {opts?.subtitle ?? config.pitch()}
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
                background: colours.accent,
                color: 'white',
                borderRadius: 999,
                padding: '10px 22px',
                fontWeight: 500,
              }}
            >
              {config.domain}
            </div>
            <div>{opts?.footer ?? config.footer}</div>
          </div>
        </div>
      </div>
    );
  };
}
