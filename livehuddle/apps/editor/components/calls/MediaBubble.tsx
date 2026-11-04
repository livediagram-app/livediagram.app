'use client';

// The one bubble a camera and a shared screen share (docs/specs/012-collaboration/video-and-screen-bubbles.md "The
// bubble"): a rounded 16:9 tile ringed in its person's colour, the stream inside, and a press that maximises it. The
// bubble layer places it above a character; the maximised panel draws the same stream large.
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { lucideMaximize2, lucideScreenShare } from '@liveworkspace/icons/lucide';
import { HoverCard, lucideGlyph } from '@livehuddle/ui';
import type { CallMedia } from '@/lib/calls/calls-store';

const MaximiseIcon = lucideGlyph(lucideMaximize2, 12);
const ScreenIcon = lucideGlyph(lucideScreenShare, 10);

/** A bubble's width in canvas px: readable at 100%, small beside a character. */
export const BUBBLE_WIDTH_PX = 120;

/** "Sam's Camera", "Your Screen": the bubble's and the panel's name. */
export function mediaTitle(name: string | null, media: CallMedia): string {
  const what = media === 'video' ? 'Camera' : 'Screen';
  return name === null ? `Your ${what}` : `${name}'s ${what}`;
}

/**
 * A stream in a `<video>`: muted (voices come through the call's audio graph), inline on phones, and shown only once
 * its first frame has arrived, so a bubble never flashes black. A stalled stream keeps its last frame.
 */
export function MediaVideo({
  stream,
  fit,
  mirrored,
  className = '',
}: {
  stream: MediaStream;
  fit: 'cover' | 'contain';
  mirrored?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const [ready, setReady] = useState<MediaStream | null>(null);
  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    video.srcObject = stream;
    // Autoplay of a muted stream is allowed; a refusal (an old browser) leaves the tint showing.
    void video.play?.()?.catch(() => {});
    return () => {
      video.srcObject = null;
    };
  }, [stream]);
  return (
    <video
      ref={ref}
      muted
      playsInline
      autoPlay
      aria-hidden
      onLoadedData={() => setReady(stream)}
      className={`block size-full transition-opacity duration-200 motion-reduce:transition-none ${
        fit === 'cover' ? 'object-cover' : 'object-contain'
      } ${mirrored ? '-scale-x-100' : ''} ${ready === stream ? 'opacity-100' : 'opacity-0'} ${className}`}
    />
  );
}

export function MediaBubble({
  stream,
  media,
  name,
  color,
  mirrored,
  onMaximise,
}: {
  stream: MediaStream;
  media: CallMedia;
  // Null for your own bubble.
  name: string | null;
  color: string;
  mirrored?: boolean;
  onMaximise: () => void;
}) {
  const title = mediaTitle(name, media);
  const label = `Maximise ${title}`;
  const style: CSSProperties = {
    width: BUBBLE_WIDTH_PX,
    // The person's colour rings the tile and tints it until the first frame arrives.
    boxShadow: `0 0 0 2px ${color}, 0 8px 18px -8px rgb(15 23 42 / 0.55)`,
    background: `color-mix(in srgb, ${color} 22%, rgb(15 23 42))`,
  };
  return (
    <HoverCard title={label}>
      <button
        type="button"
        aria-label={label}
        data-call-bubble={media}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={onMaximise}
        style={style}
        className="group pointer-events-auto relative block aspect-video cursor-pointer overflow-hidden rounded-xl transition-transform duration-150 hover:scale-[1.04] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-500 active:scale-[0.98] motion-reduce:transition-none motion-reduce:hover:scale-100"
      >
        <MediaVideo
          stream={stream}
          fit={media === 'video' ? 'cover' : 'contain'}
          mirrored={mirrored}
        />
        {media === 'screen' ? (
          <span
            aria-hidden
            className="absolute bottom-1 left-1 flex items-center gap-0.5 rounded-md bg-slate-950/70 px-1 py-0.5 text-white"
          >
            <ScreenIcon />
          </span>
        ) : null}
        <span
          aria-hidden
          className="absolute top-1 right-1 flex size-5 items-center justify-center rounded-md bg-slate-950/65 text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
        >
          <MaximiseIcon />
        </span>
      </button>
    </HoverCard>
  );
}
