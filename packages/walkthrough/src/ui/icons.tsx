// The walkthroughs' glyphs, on the house Glyph (docs/specs/004-interface-design/iconography.md): a 16-unit square,
// stroked in currentColor at the house weight.

import { Glyph, type IconProps } from '@liveworkspace/ui';

/** A walkthrough: a play mark in a frame with a voice's arc beside it. */
export function WalkthroughIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <rect x="1.5" y="3" width="10" height="10" rx="2" />
      <path d="M5.5 6.2v3.6L8.6 8z" />
      <path d="M13.2 5.6a3.6 3.6 0 0 1 0 4.8" />
    </Glyph>
  );
}

export function RecordIcon(props: IconProps) {
  return (
    <Glyph {...props} filled>
      <circle cx="8" cy="8" r="4.5" />
    </Glyph>
  );
}

export function PlayIcon(props: IconProps) {
  return (
    <Glyph {...props} filled>
      <path d="M5 3.2v9.6c0 .5.5.8.9.5l7.2-4.8a.6.6 0 0 0 0-1L5.9 2.7c-.4-.3-.9 0-.9.5z" />
    </Glyph>
  );
}

export function PauseIcon(props: IconProps) {
  return (
    <Glyph {...props} filled>
      <rect x="4" y="3" width="2.8" height="10" rx=".8" />
      <rect x="9.2" y="3" width="2.8" height="10" rx=".8" />
    </Glyph>
  );
}

export function StopIcon(props: IconProps) {
  return (
    <Glyph {...props} filled>
      <rect x="4" y="4" width="8" height="8" rx="1.5" />
    </Glyph>
  );
}

/** Hide From Recording: an eye struck through. */
export function HideIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M2 8s2.2-4 6-4 6 4 6 4-2.2 4-6 4-6-4-6-4z" />
      <circle cx="8" cy="8" r="1.8" />
      <path d="M3 13 13 3" />
    </Glyph>
  );
}

export function DownloadIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M8 2.5v7.5M5 7l3 3 3-3M3 13.5h10" />
    </Glyph>
  );
}
