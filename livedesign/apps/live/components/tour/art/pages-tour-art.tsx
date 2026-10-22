'use client';

import type { PageKind } from '@livedesign/document';
import type { ReactNode } from 'react';
import { ART, TourArtFrame } from './TourArtFrame';

// The Pages tour's welcome card heroes (docs/specs/007-editor/pages-tour.md "The steps"), one per page
// kind, each showing what its track teaches: a slide taking a layout and being presented, an infographic page
// filling in, an article being written, a logo's shapes combining on its guides. Drawn in TourArtFrame's recipe.

const SLIDES_CSS = `
  @keyframes slides-art-pick {
    0%, 26% { transform: translate(0px, 0px); }
    34%, 60% { transform: translate(0px, 22px); }
    68%, 92% { transform: translate(0px, 44px); }
    100% { transform: translate(0px, 0px); }
  }
  @keyframes slides-art-swap {
    0%, 30% { transform: translate(0px, 0px); }
    36%, 64% { transform: translate(-60px, 0px); }
    70%, 100% { transform: translate(0px, 0px); }
  }
  @keyframes slides-art-swap-text {
    0%, 30% { transform: translate(0px, 0px); }
    36%, 64% { transform: translate(58px, 0px); }
    70%, 100% { transform: translate(0px, 0px); }
  }
  @keyframes slides-art-play {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.12); }
  }
  .slides-art-pick { animation: slides-art-pick 5.4s ease-in-out infinite; }
  .slides-art-swap { animation: slides-art-swap 5.4s ease-in-out infinite; }
  .slides-art-swap-text { animation: slides-art-swap-text 5.4s ease-in-out infinite; }
  .slides-art-play { animation: slides-art-play 1.8s ease-in-out infinite; }
  @media (prefers-reduced-motion: reduce) {
    .slides-art-pick, .slides-art-swap, .slides-art-swap-text, .slides-art-play { animation: none; }
  }
`;

/** Slides: a widescreen slide whose layout changes as one is picked beside it, and a Present button. */
function SlidesTourArt() {
  return (
    <TourArtFrame css={SLIDES_CSS}>
      {/* The deck behind the slide. */}
      <rect x="60" y="22" width="124" height="70" rx="3" className={ART.paper} />
      <rect x="54" y="16" width="124" height="70" rx="3" className={ART.paper} strokeWidth="1.5" />
      {/* Its words and picture, trading sides as the layout changes. */}
      <g className="tour-art-el slides-art-swap-text">
        <rect x="64" y="28" width="52" height="6" rx="2" className={ART.ink} />
        <rect x="64" y="38" width="22" height="2" rx="1" className={ART.accent} />
        <rect x="64" y="46" width="44" height="3" rx="1.5" className={ART.faint} />
        <rect x="64" y="53" width="36" height="3" rx="1.5" className={ART.faint} />
      </g>
      <rect
        x="124"
        y="26"
        width="44"
        height="50"
        rx="2"
        className="tour-art-el slides-art-swap fill-amber-300 dark:fill-amber-400"
      />
      {/* The layouts, one picked after another. */}
      {[18, 40, 62].map((y, i) => (
        <g key={y}>
          <rect x="200" y={y} width="34" height="18" rx="2" className={ART.paper} />
          <rect
            x={i === 1 ? 204 : 218}
            y={y + 4}
            width="12"
            height="10"
            rx="1"
            className={ART.faint}
          />
          <rect
            x={i === 1 ? 220 : 204}
            y={y + 5}
            width="10"
            height="2"
            rx="1"
            className={ART.ink}
          />
        </g>
      ))}
      <rect
        x="198"
        y="16"
        width="38"
        height="22"
        rx="3"
        fill="none"
        strokeWidth="2"
        className="tour-art-el slides-art-pick stroke-brand-500"
      />
      {/* Present. */}
      <g className="tour-art-el slides-art-play">
        <circle cx="262" cy="80" r="11" className={ART.accent} />
        <path d="M 258.5 74.5 L 267 80 L 258.5 85.5 Z" className="fill-white" />
      </g>
    </TourArtFrame>
  );
}

const INFOGRAPHIC_CSS = `
  @keyframes info-art-in {
    0%, 10% { opacity: 0; transform: translateY(4px); }
    24%, 88% { opacity: 1; transform: translateY(0); }
    100% { opacity: 0; transform: translateY(0); }
  }
  @keyframes info-art-grow {
    0%, 24% { transform: scaleY(0); }
    44%, 88% { transform: scaleY(1); }
    100% { transform: scaleY(1); opacity: 0; }
  }
  @keyframes info-art-ring {
    0%, 30% { stroke-dashoffset: 113; }
    60%, 88% { stroke-dashoffset: 34; }
    100% { stroke-dashoffset: 34; opacity: 0; }
  }
  .info-art-band { animation: info-art-in 4.8s ease-out infinite; }
  .info-art-head { animation: info-art-in 4.8s ease-out 0.3s infinite; }
  .info-art-bar { transform-origin: 50% 100%; animation: info-art-grow 4.8s ease-out infinite; }
  .info-art-ring { animation: info-art-ring 4.8s ease-out infinite; }
  @media (prefers-reduced-motion: reduce) {
    .info-art-band, .info-art-head, .info-art-bar, .info-art-ring { animation: none; }
  }
`;

/** Infographic: an A4 page filling in, a band, a headline, bars growing, and a ring chart drawing. */
function InfographicTourArt() {
  return (
    <TourArtFrame css={INFOGRAPHIC_CSS}>
      <rect x="92" y="8" width="120" height="88" rx="3" className={ART.paper} strokeWidth="1.5" />
      <rect
        x="92"
        y="8"
        width="120"
        height="16"
        rx="3"
        className={`tour-art-el info-art-band ${ART.accent}`}
      />
      <g className="tour-art-el info-art-head">
        <rect x="100" y="32" width="56" height="5" rx="2" className={ART.ink} />
        <rect x="100" y="41" width="36" height="3" rx="1.5" className={ART.faint} />
      </g>
      <path d="M100 86 H148" strokeWidth="1.5" className={ART.line} />
      <rect
        x="104"
        y="66"
        width="8"
        height="20"
        rx="1"
        className="tour-art-el info-art-bar fill-sky-400"
      />
      <rect
        x="118"
        y="56"
        width="8"
        height="30"
        rx="1"
        className="tour-art-el info-art-bar fill-brand-400"
      />
      <rect
        x="132"
        y="62"
        width="8"
        height="24"
        rx="1"
        className="tour-art-el info-art-bar fill-rose-400"
      />
      {/* A ring chart, three-quarters drawn. */}
      <circle
        cx="180"
        cy="68"
        r="18"
        fill="none"
        strokeWidth="6"
        className="stroke-slate-200 dark:stroke-slate-600"
      />
      <circle
        cx="180"
        cy="68"
        r="18"
        fill="none"
        strokeWidth="6"
        strokeDasharray="113"
        strokeLinecap="round"
        transform="rotate(-90 180 68)"
        className="info-art-ring stroke-brand-500"
      />
    </TourArtFrame>
  );
}

const ARTICLE_CSS = `
  @keyframes article-art-write {
    0%, 6% { transform: scaleX(0); }
    22%, 90% { transform: scaleX(1); }
    100% { transform: scaleX(1); opacity: 0; }
  }
  @keyframes article-art-caret {
    0%, 49% { opacity: 1; }
    50%, 100% { opacity: 0; }
  }
  .article-art-line { transform-origin: 0% 50%; animation: article-art-write 6s ease-out infinite; }
  .article-art-caret { animation: article-art-caret 1s step-end infinite; }
  @media (prefers-reduced-motion: reduce) {
    .article-art-line, .article-art-caret { animation: none; }
  }
`;

// The article's lines, written one after another: [x, y, width, delay in s].
const LINES: [number, number, number, number][] = [
  [104, 40, 52, 0.4],
  [104, 47, 48, 0.8],
  [104, 54, 54, 1.2],
  [104, 66, 50, 1.6],
  [104, 73, 40, 2],
];

/** Article: a page being written down, its heading, then line after line, a caret at the end. */
function ArticleTourArt() {
  return (
    <TourArtFrame css={ARTICLE_CSS}>
      {/* The page the writing flows on to, behind. */}
      <rect x="170" y="14" width="62" height="84" rx="3" className={ART.paper} />
      <rect x="178" y="26" width="40" height="3" rx="1.5" className={ART.faint} />
      <rect x="178" y="33" width="34" height="3" rx="1.5" className={ART.faint} />
      <rect x="94" y="8" width="70" height="90" rx="3" className={ART.paper} strokeWidth="1.5" />
      <rect x="104" y="20" width="44" height="6" rx="2" className={ART.ink} />
      <rect x="104" y="30" width="18" height="2" rx="1" className={ART.accent} />
      {LINES.map(([x, y, w, delay]) => (
        <rect
          key={y}
          x={x}
          y={y}
          width={w}
          height="3"
          rx="1.5"
          className={`tour-art-el article-art-line ${ART.faint}`}
          style={{ animationDelay: `${delay}s` }}
        />
      ))}
      <rect x="146" y="71" width="1.5" height="7" className={`article-art-caret ${ART.accent}`} />
    </TourArtFrame>
  );
}

const LOGO_CSS = `
  @keyframes logo-art-left {
    0%, 16% { transform: translate(-22px, 0px); }
    40%, 88% { transform: translate(0px, 0px); }
    100% { transform: translate(-22px, 0px); }
  }
  @keyframes logo-art-right {
    0%, 16% { transform: translate(22px, 0px); }
    40%, 88% { transform: translate(0px, 0px); }
    100% { transform: translate(22px, 0px); }
  }
  @keyframes logo-art-word {
    0%, 40% { opacity: 0; }
    54%, 88% { opacity: 1; }
    100% { opacity: 0; }
  }
  .logo-art-left { animation: logo-art-left 4.6s ease-in-out infinite; }
  .logo-art-right { animation: logo-art-right 4.6s ease-in-out infinite; }
  .logo-art-word { animation: logo-art-word 4.6s ease-in-out infinite; }
  @media (prefers-reduced-motion: reduce) {
    .logo-art-left, .logo-art-right, .logo-art-word { animation: none; }
  }
`;

/** Logo: two shapes meeting on the page's guides to make one mark, its wordmark appearing under it. */
function LogoTourArt() {
  return (
    <TourArtFrame css={LOGO_CSS}>
      <rect x="92" y="8" width="120" height="88" rx="3" className={ART.paper} strokeWidth="1.5" />
      {/* The guides: the page's centre lines. */}
      <path
        d="M152 12 V92 M96 44 H208"
        strokeWidth="1"
        strokeDasharray="3 3"
        className="stroke-brand-300 dark:stroke-brand-500/60"
      />
      <circle cx="144" cy="44" r="16" className="tour-art-el logo-art-left fill-brand-500/80" />
      <rect
        x="146"
        y="30"
        width="26"
        height="28"
        rx="5"
        className="tour-art-el logo-art-right fill-sky-400/80 dark:fill-sky-500/80"
      />
      <g className="tour-art-el logo-art-word">
        <rect x="126" y="70" width="52" height="6" rx="2" className={ART.ink} />
        <rect x="136" y="80" width="32" height="3" rx="1.5" className={ART.faint} />
      </g>
    </TourArtFrame>
  );
}

const BY_KIND: Record<PageKind, () => ReactNode> = {
  slide: SlidesTourArt,
  infographic: InfographicTourArt,
  article: ArticleTourArt,
  logo: LogoTourArt,
  // A wireframe page is laid out as an infographic page is: its track and art are the infographic's.
  wireframe: InfographicTourArt,
};

/** The welcome card's hero for a page kind's track. */
export function PagesTourArt({ kind }: { kind: PageKind }) {
  const Art = BY_KIND[kind];
  return <Art />;
}
