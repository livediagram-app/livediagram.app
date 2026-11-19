'use client';

// An offline item's picture, on its own so an editor's thumbnail can draw it without the rest of the Explorer
// (`@liveworkspace/explorer/local-preview`).

import { memo, type CSSProperties } from 'react';
import type { App } from '@liveworkspace/index-client';
import { siteOf } from '../words';

/**
 * An offline item's picture where a server item shows its snapshot (none leaves the browser), tinted in the accent
 * of the app that owns it on a wash of that accent. It says "only on this device" by itself, with no pill on it
 * (owner, 2026-11-17): a browser window holding the item, a crossed-out cloud on its corner. In a small box (an
 * `iconSize` under 18, a row's square) it is the window and the crossed cloud as one glyph. Fills its box; the caller
 * sizes and rounds it.
 */
export const LocalPreview = memo(function LocalPreview({
  app,
  iconSize,
  className = '',
}: {
  app: App;
  iconSize: number;
  className?: string;
}) {
  const site = siteOf(app);
  return (
    <span
      aria-hidden
      data-local-preview={app}
      style={{ '--local-accent': site.accent, '--local-deep': site.deep } as CSSProperties}
      className={`flex items-center justify-center overflow-hidden bg-[color-mix(in_srgb,var(--local-accent)_12%,white)] text-[var(--local-deep)] dark:bg-[color-mix(in_srgb,var(--local-accent)_18%,transparent)] dark:text-[var(--local-accent)] ${className}`}
    >
      {iconSize < 18 ? <OfflineGlyph size={iconSize + 4} /> : <OfflineArt />}
    </span>
  );
});

// The full picture: the window (its bar and three dots), the item's lines inside it, and on its lower right corner
// the accent disc with a cloud struck through.
function OfflineArt() {
  return (
    <svg
      data-local-art=""
      viewBox="0 0 120 80"
      preserveAspectRatio="xMidYMid meet"
      className="h-[78%] max-h-36 w-[78%]"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect
        x="18"
        y="12"
        width="78"
        height="54"
        rx="7"
        className="fill-white dark:fill-slate-900"
        stroke="currentColor"
        strokeOpacity="0.55"
        strokeWidth="2"
      />
      <path d="M18 24h78" stroke="currentColor" strokeOpacity="0.35" strokeWidth="2" />
      <circle cx="26" cy="18" r="1.8" fill="currentColor" fillOpacity="0.5" />
      <circle cx="32" cy="18" r="1.8" fill="currentColor" fillOpacity="0.5" />
      <circle cx="38" cy="18" r="1.8" fill="currentColor" fillOpacity="0.5" />
      <rect x="27" y="32" width="34" height="5" rx="2.5" fill="currentColor" fillOpacity="0.55" />
      <rect
        x="27"
        y="42"
        width="52"
        height="3.5"
        rx="1.75"
        fill="currentColor"
        fillOpacity="0.22"
      />
      <rect
        x="27"
        y="49"
        width="44"
        height="3.5"
        rx="1.75"
        fill="currentColor"
        fillOpacity="0.22"
      />
      <rect
        x="27"
        y="56"
        width="28"
        height="3.5"
        rx="1.75"
        fill="currentColor"
        fillOpacity="0.22"
      />
      <circle
        cx="94"
        cy="62"
        r="15"
        style={{ fill: 'var(--local-accent)' }}
        className="stroke-white dark:stroke-slate-900"
        strokeWidth="3"
      />
      <g transform="translate(82 50) scale(1)" stroke="white" strokeWidth="2.2">
        <path d="M8.5 17.5h8a4 4 0 0 0 .9-7.9 5.5 5.5 0 0 0-10.3-1.3A4.5 4.5 0 0 0 7 17.4" />
        <path d="M5 5l14 14" />
      </g>
    </svg>
  );
}

// The small glyph: the window with a crossed cloud cut into its corner.
function OfflineGlyph({ size }: { size: number }) {
  return (
    <svg
      data-local-art="glyph"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M11 20H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5" />
      <path d="M2 9h20" />
      <path d="M16.5 21.5h3.2a2 2 0 0 0 .3-4 2.8 2.8 0 0 0-5.3-.6 2.2 2.2 0 0 0 .3 4.5" />
      <path d="M14 14.5l8 8" />
    </svg>
  );
}
