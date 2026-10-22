'use client';

import type { PageKind } from '@livedesign/document';
import type { ReactNode } from 'react';
import { ART, TourArtFrame } from './TourArtFrame';

// The Pages tour's welcome card heroes (docs/specs/007-editor/pages-tour.md "The steps"), one per page
// kind, each showing what its track teaches: a wireframe page filling in, a logo's shapes combining on its
// guides. Drawn in TourArtFrame's recipe.

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

/** Wireframe: a page filling in, a band, a headline, bars growing, and a ring chart drawing. */
function LayoutTourArt() {
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
  logo: LogoTourArt,
  wireframe: LayoutTourArt,
};

/** The welcome card's hero for a page kind's track. */
export function PagesTourArt({ kind }: { kind: PageKind }) {
  const Art = BY_KIND[kind];
  return <Art />;
}
