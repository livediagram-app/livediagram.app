'use client';

import type { CSSProperties } from 'react';
import { shade, tint } from '@liveplanner/document';
import { Glyph } from '@liveplanner/ui';
import {
  EMPTY_FACE,
  imageEmptyLayout,
  type PlaceholderTone,
} from '@/components/canvas/image-placeholder-look';

// An image element's empty face: the app's empty state drawn on the canvas, a badge with the image
// glyph in its rings and "No image yet". Pictures are never uploaded, so an image element (a template's
// placeholder) always shows this face. Scaled to the box and trimmed to what it holds; a box too small
// for words (a small avatar) shows the badge alone.
//
// Painted from the tone (inked for the paper, dressed in the tab's theme), never from Tailwind's
// chrome-following tokens, as the rest of the placeholder is.

const IMAGE_EMPTY_TITLE = 'No image yet';

// Hex alpha suffixes for the accent's glow, rings and badge shadow over the opaque body.
const GLOW_ALPHA = '14';
const RING_INNER_ALPHA = '2e';
const RING_OUTER_ALPHA = '14';
const SHADOW_ALPHA = '55';
// How far the badge's gradient runs away from its glyph colour, so the glyph only gains contrast.
const BADGE_GRADIENT = 0.22;

export function ImageEmptyFace({
  width,
  height,
  round,
  tone,
  surface,
  radius,
  fontFamily,
}: {
  width: number;
  height: number;
  /** Clipped to a circle (an avatar): the face sits in the circle's inscribed square. */
  round: boolean;
  tone: PlaceholderTone;
  surface: 'light' | 'dark';
  radius: number;
  fontFamily?: string;
}) {
  const layout = imageEmptyLayout(width, height, { canPick: false, round });
  const badgeTo =
    tone.onAccent === '#ffffff'
      ? shade(tone.accent, BADGE_GRADIENT)
      : tint(tone.accent, BADGE_GRADIENT);

  const badge = (px: number, glyphPx: number, ringPx: number) => (
    <span
      aria-hidden
      className="flex shrink-0 items-center justify-center"
      style={{
        width: px,
        height: px,
        borderRadius: Math.round(px * 0.3),
        color: tone.onAccent,
        background: `linear-gradient(135deg, ${tone.accent}, ${badgeTo})`,
        boxShadow: [
          `0 0 0 ${ringPx / 2}px ${tone.accent}${RING_INNER_ALPHA}`,
          `0 0 0 ${ringPx}px ${tone.accent}${RING_OUTER_ALPHA}`,
          `0 ${Math.round(px / 10)}px ${Math.round(px / 3)}px -${Math.round(px / 20)}px ${tone.accent}${SHADOW_ALPHA}`,
        ].join(', '),
      }}
    >
      <ImageGlyph size={glyphPx} />
    </span>
  );

  const s = layout.kind === 'face' ? layout.scale : 1;
  const px = (n: number) => Math.round(n * s * 10) / 10;

  return (
    <div
      data-image-placeholder={surface}
      data-image-empty={layout.kind === 'face' ? 'face' : 'badge'}
      className="flex h-full w-full flex-col items-center justify-center overflow-hidden border-dashed border-[var(--ph-border)] text-center font-sans"
      style={
        {
          borderRadius: radius,
          borderWidth: Math.max(1.5, px(1.5)),
          background: `radial-gradient(circle at 50% 45%, ${tone.accent}${GLOW_ALPHA}, transparent 65%), ${tone.body}`,
          fontFamily,
          gap: px(EMPTY_FACE.gapPx),
          padding: px(EMPTY_FACE.padPx),
          '--ph-body': tone.body,
          '--ph-border': tone.border,
          '--ph-ink': tone.ink,
        } as CSSProperties
      }
      role={layout.kind === 'badge' ? 'img' : undefined}
      aria-label={layout.kind === 'badge' ? IMAGE_EMPTY_TITLE : undefined}
    >
      {layout.kind === 'badge' ? (
        badge(layout.badgePx, Math.round(layout.badgePx * 0.45), layout.badgePx / 6)
      ) : (
        <>
          <span style={{ padding: px(EMPTY_FACE.ringPx) }} className="flex">
            {badge(px(EMPTY_FACE.badgePx), px(EMPTY_FACE.glyphPx), px(EMPTY_FACE.ringPx))}
          </span>
          {layout.parts.title ? (
            <span
              className="font-semibold not-italic leading-[1.3]"
              style={{ fontSize: px(EMPTY_FACE.titlePx), color: tone.ink }}
            >
              {IMAGE_EMPTY_TITLE}
            </span>
          ) : null}
        </>
      )}
    </div>
  );
}

function ImageGlyph({ size }: { size: number }) {
  return (
    <Glyph size={size} units={24}>
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <circle cx="8.5" cy="9" r="1.5" />
      <path d="M3.5 17l5-5 4 4 3-3 5 5" />
    </Glyph>
  );
}
