'use client';

import type { CSSProperties, MouseEvent, PointerEvent } from 'react';
import { shade, tint } from '@livedesign/design';
import { Glyph } from '@livedesign/ui';
import {
  EMPTY_FACE,
  imageEmptyLayout,
  type PlaceholderTone,
} from '@/components/canvas/image-placeholder-look';
import { track } from '@/lib/telemetry';

// An image element with no picture yet (docs/specs/009-elements/images.md "Placeholder
// rendering"): the app's empty state drawn on the canvas. A badge with the image glyph in its
// rings, "No image yet", a line saying where pictures come from and a Select Image button that
// opens the picker (as a double-click on the box does). Scaled to the box and trimmed to what it
// holds; a box too small for words (a small avatar) shows the badge alone, and for an editor the
// badge is the button.
//
// Painted from the tone (inked for the paper, dressed in the tab's theme), never from Tailwind's
// chrome-following tokens, as the rest of the placeholder is.

const IMAGE_EMPTY_TITLE = 'No image yet';
const IMAGE_EMPTY_LINE = 'Upload one, or pick from your gallery.';
const IMAGE_EMPTY_ACTION = 'Select Image';

// Hex alpha suffixes for the accent's glow, rings and badge shadow over the opaque body.
const GLOW_ALPHA = '14';
const RING_INNER_ALPHA = '2e';
const RING_OUTER_ALPHA = '14';
const SHADOW_ALPHA = '55';
// How far the badge's gradient runs away from its glyph colour, so the glyph only gains contrast.
const BADGE_GRADIENT = 0.22;

// The pointer-down that starts a drag or a selection on the element must not start on the button.
const stop = (e: PointerEvent | MouseEvent) => e.stopPropagation();

export function ImageEmptyFace({
  elementId,
  width,
  height,
  round,
  tone,
  surface,
  radius,
  fontFamily,
  onOpenPicker,
}: {
  elementId: string;
  width: number;
  height: number;
  /** Clipped to a circle (an avatar): the face sits in the circle's inscribed square. */
  round: boolean;
  tone: PlaceholderTone;
  surface: 'light' | 'dark';
  radius: number;
  fontFamily?: string;
  /** Opens the image picker for this element; absent for someone who cannot pick. */
  onOpenPicker?: (elementId: string) => void;
}) {
  const canPick = !!onOpenPicker;
  const layout = imageEmptyLayout(width, height, { canPick, round });
  const badgeTo =
    tone.onAccent === '#ffffff'
      ? shade(tone.accent, BADGE_GRADIENT)
      : tint(tone.accent, BADGE_GRADIENT);

  const open = (e: MouseEvent) => {
    e.stopPropagation();
    track('Element', 'Used', 'ImagePlaceholder');
    onOpenPicker?.(elementId);
  };

  const badge = (px: number, glyphPx: number, ringPx: number, asButton: boolean) => {
    const style: CSSProperties = {
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
    };
    const className =
      'flex shrink-0 items-center justify-center transition-transform duration-150 ease-out group-hover:-translate-y-px group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:transform-none';
    const glyph = <ImageGlyph size={glyphPx} />;
    return asButton ? (
      <button
        type="button"
        aria-label={IMAGE_EMPTY_ACTION}
        data-image-empty-action=""
        className={`pointer-events-auto cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${className}`}
        style={{ ...style, ['--tw-ring-color' as string]: tone.accent }}
        onPointerDown={stop}
        onDoubleClick={stop}
        onClick={open}
      >
        {glyph}
      </button>
    ) : (
      <span aria-hidden className={className} style={style}>
        {glyph}
      </span>
    );
  };

  const s = layout.kind === 'face' ? layout.scale : 1;
  const px = (n: number) => Math.round(n * s * 10) / 10;

  return (
    <div
      data-image-placeholder={surface}
      data-image-empty={layout.kind === 'face' ? 'face' : 'badge'}
      className={`group flex h-full w-full flex-col items-center justify-center overflow-hidden border-dashed border-[var(--ph-border)] text-center font-sans ${
        canPick
          ? 'cursor-pointer transition-colors hover:border-[var(--ph-hover-border)] motion-reduce:transition-none'
          : ''
      }`}
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
          '--ph-hover-border': tone.hoverBorder,
        } as CSSProperties
      }
      role={layout.kind === 'badge' && !canPick ? 'img' : undefined}
      aria-label={layout.kind === 'badge' && !canPick ? IMAGE_EMPTY_TITLE : undefined}
    >
      {layout.kind === 'badge' ? (
        badge(layout.badgePx, Math.round(layout.badgePx * 0.45), layout.badgePx / 6, canPick)
      ) : (
        <>
          <span style={{ padding: px(EMPTY_FACE.ringPx) }} className="flex">
            {badge(px(EMPTY_FACE.badgePx), px(EMPTY_FACE.glyphPx), px(EMPTY_FACE.ringPx), false)}
          </span>
          {layout.parts.title || layout.parts.line ? (
            <span className="flex flex-col items-center" style={{ gap: px(4) }}>
              {layout.parts.title ? (
                <span
                  className="font-semibold not-italic leading-[1.3]"
                  style={{ fontSize: px(EMPTY_FACE.titlePx), color: tone.ink }}
                >
                  {IMAGE_EMPTY_TITLE}
                </span>
              ) : null}
              {layout.parts.line ? (
                <span
                  className="not-italic leading-[1.35] [text-wrap:balance]"
                  style={{
                    fontSize: px(EMPTY_FACE.linePx),
                    maxWidth: px(EMPTY_FACE.lineMaxPx),
                    color: tone.muted,
                  }}
                >
                  {IMAGE_EMPTY_LINE}
                </span>
              ) : null}
            </span>
          ) : null}
          {layout.parts.button ? (
            <button
              type="button"
              data-image-empty-action=""
              className="pointer-events-auto inline-flex cursor-pointer items-center font-semibold not-italic shadow-sm outline-none transition-[filter,transform] duration-150 hover:brightness-110 focus-visible:ring-2 focus-visible:ring-offset-2 active:scale-[0.97] motion-reduce:transition-none"
              style={
                {
                  height: px(EMPTY_FACE.buttonPx),
                  gap: px(6),
                  paddingInline: px(11),
                  borderRadius: px(8),
                  fontSize: px(EMPTY_FACE.buttonFontPx),
                  background: tone.accent,
                  color: tone.onAccent,
                  '--tw-ring-color': tone.accent,
                  '--tw-ring-offset-color': tone.body,
                } as CSSProperties
              }
              onPointerDown={stop}
              onDoubleClick={stop}
              onClick={open}
            >
              <UploadGlyph size={px(13)} />
              {IMAGE_EMPTY_ACTION}
            </button>
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

function UploadGlyph({ size }: { size: number }) {
  return (
    <Glyph size={size} units={24}>
      <path d="M12 16V4" />
      <path d="M7 9l5-5 5 5" />
      <path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" />
    </Glyph>
  );
}
