'use client';

// The one bubble a camera and a shared screen share (docs/specs/012-collaboration/video-and-screen-bubbles.md "The
// bubble"): a rounded 16:9 tile ringed in its person's colour, the stream inside, and a press that maximises it. The
// bubble layer places it above a character; the maximised panel draws the same stream large.
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import {
  lucideMaximize2,
  lucideScreenShare,
  lucideScreenShareOff,
} from '@liveworkspace/icons/lucide';
import { HoverCard, lucideGlyph } from '@livehuddle/ui';
import type { CallMedia } from '@/lib/calls/calls-store';

const MaximiseIcon = lucideGlyph(lucideMaximize2, 12);
const ScreenIcon = lucideGlyph(lucideScreenShare, 10);
const StopIcon = lucideGlyph(lucideScreenShareOff, 12);

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
  onStopShare,
}: {
  stream: MediaStream;
  media: CallMedia;
  // Null for your own bubble.
  name: string | null;
  color: string;
  mirrored?: boolean;
  onMaximise: () => void;
  // An Editor stopping someone else's share (video-and-screen-bubbles.md "Share roles"); absent for anyone else.
  onStopShare?: () => void;
}) {
  const title = mediaTitle(name, media);
  const label = `Maximise ${title}`;
  const stop = media === 'screen' && name !== null ? onStopShare : undefined;
  const style: CSSProperties = {
    width: BUBBLE_WIDTH_PX,
    // The person's colour rings the tile and tints it until the first frame arrives.
    boxShadow: `0 0 0 2px ${color}, 0 8px 18px -8px rgb(15 23 42 / 0.55)`,
    background: `color-mix(in srgb, ${color} 22%, rgb(15 23 42))`,
  };
  // The tile and its own controls: Stop Sharing sits beside the maximise press, never inside it (a button holds no
  // button), and the tile grows under either.
  return (
    <div
      data-call-bubble-tile={media}
      style={style}
      className="group pointer-events-auto relative aspect-video overflow-hidden rounded-xl transition-transform duration-150 hover:scale-[1.04] has-[button:active]:scale-[0.98] motion-reduce:transition-none motion-reduce:hover:scale-100"
    >
      <HoverCard title={label} className="absolute inset-0">
        <button
          type="button"
          aria-label={label}
          data-call-bubble={media}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={onMaximise}
          className="relative block size-full cursor-pointer rounded-xl focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-500"
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
            className="absolute top-1 right-1 flex size-5 items-center justify-center rounded-md bg-slate-950/65 text-white opacity-0 transition-opacity group-hover:opacity-100 group-has-[button:focus-visible]:opacity-100"
          >
            <MaximiseIcon />
          </span>
        </button>
      </HoverCard>
      {stop ? (
        <HoverCard
          title={`Stop ${title}`}
          description="Ends their share for everyone"
          className="absolute top-1 left-1"
        >
          <button
            type="button"
            aria-label={`Stop ${title}`}
            data-call-bubble-stop
            onPointerDown={(e) => e.stopPropagation()}
            onClick={stop}
            className="flex h-5 cursor-pointer items-center gap-1 rounded-md bg-rose-600 px-1.5 text-[10px] leading-none font-semibold text-white opacity-0 shadow-sm transition-opacity group-hover:opacity-100 hover:bg-rose-700 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-white active:bg-rose-800 pointer-coarse:opacity-100"
          >
            <StopIcon />
            {/* Short on a 120 px tile, beside the maximise mark; the hover card and the name say whose share. */}
            Stop
          </button>
        </HoverCard>
      ) : null}
    </div>
  );
}
