// Mini illustrations for the Privacy section on the landing page. Same shape as
// FeatureArt (each export is a Frame-wrapped scene with a few CSS-animated SVG bits),
// in a palette of CSS custom properties with a light and a dark half
// (app/privacy-art.css), so each piece fits the band in either appearance.
//
// Motion classes (fa-fade, fa-pulse, fa-grow, fa-spin) come from
// globals.css so the static export still inherits the keyframes
// without any extra JS. prefers-reduced-motion already gates the
// keyframes globally.

import type { ReactNode } from 'react';

const SKY = 'var(--pa-sky)';
const SKY_FAINT = 'var(--pa-sky-faint)';
const SLATE = 'var(--pa-slate)';
const SLATE_FAINT = 'var(--pa-slate-faint)';
const ROSE = 'var(--pa-rose)';
const ROSE_FAINT = 'var(--pa-rose-faint)';
const ON_SKY = 'var(--pa-on-sky)';
const SURFACE = 'var(--pa-surface)';

// Bordered surface every privacy illustration sits in. Same
// dimensions as the FeatureArt Frame so the grid lays out evenly.
function PrivacyFrame({ children }: { children: ReactNode }) {
  return (
    <div
      aria-hidden
      className="relative mb-4 h-24 w-full overflow-hidden rounded-md border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950/60"
    >
      {children}
    </div>
  );
}

/* No third-party analytics: a tracker pixel sweeping a connection
   line that gets sliced through, with the "blocked" cross fading
   in. The cross + dashed line read at a glance. */
export function NoTrackersArt() {
  return (
    <PrivacyFrame>
      <svg viewBox="0 0 220 90" className="absolute inset-0 h-full w-full">
        {/* Your browser */}
        <rect x="14" y="22" width="52" height="42" rx="4" fill={SKY_FAINT} stroke={SKY} />
        <rect x="20" y="28" width="40" height="4" rx="1.5" fill={SKY} />
        <rect x="20" y="35" width="28" height="3" rx="1" fill={SLATE} />
        <rect x="20" y="40" width="34" height="3" rx="1" fill={SLATE} />
        {/* Tracker (third party) on the right */}
        <rect x="160" y="22" width="48" height="42" rx="4" fill={ROSE_FAINT} stroke={ROSE} />
        <text x="184" y="48" textAnchor="middle" fontSize="10" fontWeight="700" fill={ROSE}>
          tracker
        </text>
        {/* Severed connection line */}
        <path
          d="M66 44 L160 44"
          stroke={SLATE}
          strokeWidth="1.5"
          strokeDasharray="4 3"
          fill="none"
        />
        {/* Big red cross stamped in the middle, fades in */}
        <g className="fa-fade" style={{ animationDelay: '0.3s' }}>
          <circle cx="113" cy="44" r="13" fill={ROSE} />
          <path
            d="M106 44 L120 44 M113 37 L113 51"
            stroke="white"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        </g>
      </svg>
    </PrivacyFrame>
  );
}

/* Your data is yours: a folder/document label arcs from a generic
   server icon back into the user's avatar — the "comes home" beat. */
export function DataIsYoursArt() {
  return (
    <PrivacyFrame>
      <svg viewBox="0 0 220 90" className="absolute inset-0 h-full w-full">
        {/* Server cluster on the left */}
        <g>
          <rect x="14" y="20" width="40" height="50" rx="3" fill={SKY_FAINT} stroke={SKY} />
          <rect x="20" y="26" width="28" height="4" rx="1" fill={SKY} />
          <rect x="20" y="34" width="28" height="4" rx="1" fill={SLATE} />
          <rect x="20" y="42" width="28" height="4" rx="1" fill={SLATE} />
          <rect x="20" y="50" width="28" height="4" rx="1" fill={SLATE} />
        </g>
        {/* Diagram label travelling along the arc */}
        <path
          id="arc-path"
          d="M54 45 Q 110 -10 165 45"
          fill="none"
          stroke={SLATE_FAINT}
          strokeDasharray="3 3"
        />
        <g className="fa-fade" style={{ animationDuration: '4s' }}>
          <rect x="100" y="14" width="40" height="14" rx="3" fill={SKY} />
          <text x="120" y="24" textAnchor="middle" fontSize="9" fontWeight="600" fill={ON_SKY}>
            diagram
          </text>
        </g>
        {/* User avatar on the right */}
        <g>
          <circle cx="180" cy="46" r="18" fill={SKY} />
          <text x="180" y="50" textAnchor="middle" fontSize="14" fontWeight="700" fill={ON_SKY}>
            You
          </text>
        </g>
      </svg>
    </PrivacyFrame>
  );
}

/* Never sold or traded: a banknote with a no-sale circle-slash
   stamped over the top-right corner. Banknote is a proper
   rectangle with a border, central oval (portrait area), and a
   corner denomination so it reads as currency at thumbnail size. */
export function NoSaleArt() {
  return (
    <PrivacyFrame>
      <svg viewBox="0 0 220 90" className="absolute inset-0 h-full w-full">
        {/* Banknote */}
        <g className="fa-fade" style={{ animationDuration: '5s' }}>
          <rect
            x="30"
            y="22"
            width="130"
            height="46"
            rx="3"
            fill={SKY_FAINT}
            stroke={SKY}
            strokeWidth="1.5"
          />
          {/* Inner border to suggest the engraved frame on real notes. */}
          <rect
            x="34"
            y="26"
            width="122"
            height="38"
            rx="2"
            fill="none"
            stroke={SKY}
            strokeWidth="0.6"
            opacity="0.6"
          />
          {/* Central portrait oval. */}
          <ellipse cx="95" cy="45" rx="14" ry="11" fill="none" stroke={SKY} strokeWidth="1" />
          {/* Corner denominations. */}
          <text x="42" y="35" fontSize="9" fontWeight="700" fill={SKY}>
            $
          </text>
          <text x="148" y="61" fontSize="9" fontWeight="700" fill={SKY} textAnchor="end">
            $
          </text>
        </g>
        {/* No-sale ring + slash stamped on top of the banknote's right
            edge, deliberately overlapping so the message reads as
            "this isn't for sale" rather than a separate icon. */}
        <g className="fa-pulse" style={{ transformOrigin: '170px 50px' }}>
          <circle cx="170" cy="45" r="20" fill="none" stroke={ROSE} strokeWidth="4" />
          <line
            x1="156"
            y1="31"
            x2="184"
            y2="59"
            stroke={ROSE}
            strokeWidth="4"
            strokeLinecap="round"
          />
        </g>
      </svg>
    </PrivacyFrame>
  );
}

/* Encrypted at rest + in transit: a padlock with a chain of cipher
   blocks unspooling beneath it, hinting at AES blocks. */
export function EncryptedArt() {
  return (
    <PrivacyFrame>
      <svg viewBox="0 0 220 90" className="absolute inset-0 h-full w-full">
        {/* Big padlock */}
        <g>
          <rect
            x="40"
            y="42"
            width="48"
            height="36"
            rx="4"
            fill={SKY_FAINT}
            stroke={SKY}
            strokeWidth="1.8"
          />
          <path
            d="M50 42 L50 30 A 14 14 0 0 1 78 30 L78 42"
            fill="none"
            stroke={SKY}
            strokeWidth="3"
            strokeLinecap="round"
          />
          <circle cx="64" cy="60" r="4" fill={SKY} />
          <line
            x1="64"
            y1="62"
            x2="64"
            y2="70"
            stroke={SKY}
            strokeWidth="2"
            strokeLinecap="round"
          />
        </g>
        {/* Cipher blocks streaming right */}
        {[0, 1, 2, 3, 4].map((i) => (
          <g key={i} className="fa-fade" style={{ animationDelay: `${i * 0.25}s` }}>
            <rect
              x={108 + i * 20}
              y="50"
              width="16"
              height="20"
              rx="2"
              fill={SLATE_FAINT}
              stroke={SLATE}
            />
            <text x={116 + i * 20} y="64" textAnchor="middle" fontSize="9" fill={SKY}>
              {['1f', 'a4', '7c', 'e2', '9b'][i]}
            </text>
          </g>
        ))}
      </svg>
    </PrivacyFrame>
  );
}

/* Private by default: a diagram tile gated by a small lock; an
   "Open" button to the side toggles on/off with the fa-pulse beat. */
export function PrivateByDefaultArt() {
  return (
    <PrivacyFrame>
      <svg viewBox="0 0 220 90" className="absolute inset-0 h-full w-full">
        {/* Private diagram */}
        <rect
          x="20"
          y="20"
          width="100"
          height="50"
          rx="5"
          fill={SKY_FAINT}
          stroke={SKY}
          strokeWidth="1.5"
        />
        <rect x="28" y="28" width="36" height="6" rx="1.5" fill={SKY} />
        <rect x="28" y="38" width="60" height="3" rx="1" fill={SLATE} />
        <rect x="28" y="44" width="48" height="3" rx="1" fill={SLATE} />
        {/* Lock badge in the corner */}
        <g>
          <circle cx="112" cy="28" r="10" fill={SURFACE} stroke={SKY} strokeWidth="1.5" />
          <rect x="107" y="27" width="10" height="7" rx="1" fill={SKY} />
          <path
            d="M109 27 L109 23 A 3 3 0 0 1 115 23 L115 27"
            fill="none"
            stroke={SKY}
            strokeWidth="1.5"
          />
        </g>
        {/* Share link, optional, pulses to suggest it can be turned on later */}
        <g className="fa-pulse" style={{ transformOrigin: '170px 45px' }}>
          <rect x="140" y="30" width="60" height="30" rx="15" fill={SKY_FAINT} stroke={SKY} />
          <text x="170" y="49" textAnchor="middle" fontSize="11" fontWeight="600" fill={SKY}>
            Share?
          </text>
        </g>
      </svg>
    </PrivacyFrame>
  );
}

/* Open source: a code-bracket pair with the source rolling through. */
export function OpenSourceArt() {
  return (
    <PrivacyFrame>
      <svg viewBox="0 0 220 90" className="absolute inset-0 h-full w-full">
        {/* Left bracket */}
        <text x="35" y="62" fontSize="56" fontWeight="700" fill={SKY}>
          {'<'}
        </text>
        {/* Right bracket */}
        <text x="170" y="62" fontSize="56" fontWeight="700" fill={SKY}>
          {'>'}
        </text>
        {/* Code lines in the middle, fading in row by row */}
        {[0, 1, 2, 3].map((i) => (
          <g key={i} className="fa-fade" style={{ animationDelay: `${i * 0.4}s` }}>
            <rect x={70} y={20 + i * 13} width={6 + i * 3} height="2.5" rx="1" fill={SLATE} />
            <rect
              x={82 + i * 3}
              y={20 + i * 13}
              width={28 - i * 2}
              height="2.5"
              rx="1"
              fill={SKY}
            />
            <rect x={114 + i} y={20 + i * 13} width={18} height="2.5" rx="1" fill={SLATE} />
          </g>
        ))}
        {/* MIT badge */}
        <g>
          <rect x="90" y="72" width="40" height="12" rx="3" fill={SKY} />
          <text x="110" y="81" textAnchor="middle" fontSize="9" fontWeight="700" fill={ON_SKY}>
            MIT
          </text>
        </g>
      </svg>
    </PrivacyFrame>
  );
}
