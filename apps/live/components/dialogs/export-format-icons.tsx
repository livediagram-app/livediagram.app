// The export dialog's per-format preview glyphs (little themed file /
// image chips), split out of ExportTabDialog the same way the other
// per-surface icon files are. The type-only import back into the
// dialog file is the usual host pattern.

import type { Format } from './ExportTabDialog';

export function FormatIcon({ kind }: { kind: Format }) {
  switch (kind) {
    case 'text':
      return (
        <svg width="32" height="20" viewBox="0 0 32 20" aria-hidden>
          <rect
            x="1"
            y="1"
            width="30"
            height="18"
            rx="2"
            fill="rgb(237 233 254)"
            stroke="rgb(167 139 250)"
            strokeWidth="1.25"
          />
          <path
            d="M6 7h13M6 10h16M6 13h9"
            stroke="rgb(124 58 237)"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      );
    case 'markdown':
      return (
        <svg width="32" height="20" viewBox="0 0 32 20" aria-hidden>
          <rect
            x="1"
            y="1"
            width="30"
            height="18"
            rx="2"
            fill="none"
            stroke="rgb(148 163 184)"
            strokeWidth="1.25"
          />
          <text
            x="16"
            y="14"
            textAnchor="middle"
            fontFamily="system-ui, sans-serif"
            fontSize="9"
            fontWeight="600"
            fill="rgb(71 85 105)"
          >
            md
          </text>
        </svg>
      );
    case 'pdf':
      return (
        <svg width="22" height="28" viewBox="0 0 22 28" aria-hidden>
          <path
            d="M3 1h11l5 5v20a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1z"
            fill="rgb(254 226 226)"
            stroke="rgb(248 113 113)"
            strokeWidth="1.25"
          />
          <text
            x="11"
            y="20"
            textAnchor="middle"
            fontFamily="system-ui, sans-serif"
            fontSize="7"
            fontWeight="700"
            fill="rgb(190 18 60)"
          >
            PDF
          </text>
        </svg>
      );
    case 'png':
      return (
        <svg width="32" height="22" viewBox="0 0 32 22" aria-hidden>
          <rect
            x="1"
            y="1"
            width="30"
            height="20"
            rx="2"
            fill="rgb(219 234 254)"
            stroke="rgb(147 197 253)"
            strokeWidth="1.25"
          />
          <circle cx="9" cy="9" r="2.5" fill="rgb(251 191 36)" />
          <path d="M2 18l8-8 6 6 4-4 10 8" stroke="rgb(59 130 246)" strokeWidth="1.5" fill="none" />
        </svg>
      );
    case 'svg':
      return (
        <svg width="32" height="22" viewBox="0 0 32 22" aria-hidden>
          <rect
            x="1"
            y="1"
            width="30"
            height="20"
            rx="2"
            fill="rgb(220 252 231)"
            stroke="rgb(134 239 172)"
            strokeWidth="1.25"
          />
          <text
            x="16"
            y="15"
            textAnchor="middle"
            fontFamily="system-ui, sans-serif"
            fontSize="9"
            fontWeight="600"
            fill="rgb(21 128 61)"
          >
            SVG
          </text>
        </svg>
      );
    case 'file':
      return (
        <svg width="22" height="28" viewBox="0 0 22 28" aria-hidden>
          <path
            d="M3 1h11l5 5v20a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1z"
            fill="rgb(241 245 249)"
            stroke="rgb(148 163 184)"
            strokeWidth="1.25"
          />
          <path d="M14 1v6h5" fill="none" stroke="rgb(148 163 184)" strokeWidth="1.25" />
        </svg>
      );
  }
}
