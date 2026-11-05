'use client';

// The Screen (docs/specs/009-elements/screen-and-room-sign.md "Screen"): a wall screen that shows, for each viewer,
// a screen share from someone standing in its room, else its Video Link's poster, else an idle face. Pressing it
// opens the share in the call's maximised panel, or the video in a large player. It shows only a stream this viewer
// already receives (the bubble rules), and re-renders when its room's people or the received streams change, never
// on a step.
import { useState } from 'react';
import {
  SCREEN_ART,
  SCREEN_IDLE_TEXT,
  screenVideoTarget,
  type ShapeElement,
} from '@livehuddle/document';
import { lucidePlay } from '@liveworkspace/icons/lucide';
import { HoverCard, lucideGlyph } from '@livehuddle/ui';
import { setCallMaximised, useCallMedia } from '@/lib/calls/calls-store';
import { useMeetingLive } from '@/lib/office/meeting-live';
import { usePressWithoutDrag } from '@/hooks/ui/usePressWithoutDrag';
import { track } from '@/lib/telemetry';
import { MediaVideo, mediaTitle } from '@/components/calls/MediaBubble';
import { ScreenPlayer } from './ScreenPlayer';

const PlayIcon = lucideGlyph(lucidePlay, 18);
const A = SCREEN_ART;
const pct = (v: number, of: number) => `${(v / of) * 100}%`;
// Type and marks sized to the screen's width, so a Screen resized larger keeps its proportions.
const cq = (px: number) => `${(px / A.bezel.w) * 100}cqw`;

/** A flat screen glyph, for the idle face and the palette tile. */
export function ScreenGlyph({ size = 14, className }: { size?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={className}
    >
      <rect x="2.5" y="4" width="19" height="13" rx="2" />
      <path d="M9 20.5h6M12 17v3.5" />
    </svg>
  );
}

// Who in the Screen's room is sharing and received here: the nearest the Screen.
function useShownShare(id: string) {
  const live = useMeetingLive(id);
  const media = useCallMedia();
  if (!live || !('inside' in live)) return null;
  for (const p of live.inside) {
    const stream = media.get(p.id)?.screen;
    if (stream) return { id: p.id, name: p.name, stream };
  }
  return null;
}

export function ScreenView({ element, animClass }: { element: ShapeElement; animClass?: string }) {
  const share = useShownShare(element.id);
  const video = share ? null : screenVideoTarget(element.screenUrl);
  const [playing, setPlaying] = useState(false);
  const open = share
    ? () => {
        track('Canvas', 'Used', 'ScreenOpen');
        setCallMaximised({ id: share.id, media: 'screen' });
      }
    : video
      ? () => {
          track('Canvas', 'Used', 'ScreenOpen');
          setPlaying(true);
        }
      : undefined;
  const press = usePressWithoutDrag(open);
  const title = share ? mediaTitle(share.name, 'screen') : video ? video.label : SCREEN_IDLE_TEXT;
  const panel = (
    <div
      data-screen-face={share ? 'share' : video ? 'video' : 'idle'}
      className="absolute overflow-hidden"
      style={{
        left: pct(A.panel.x, A.bezel.w),
        top: pct(A.panel.y, A.bezel.h),
        width: pct(A.panel.w, A.bezel.w),
        height: pct(A.panel.h, A.bezel.h),
        borderRadius: A.panel.rx,
        background: `linear-gradient(160deg, ${A.tones.panelLit}, ${A.tones.panel})`,
      }}
    >
      {share ? (
        <>
          <MediaVideo
            stream={share.stream}
            fit="contain"
            className="absolute inset-0 h-full w-full"
          />
          <span
            className="absolute bottom-1 left-1 max-w-[80%] truncate rounded bg-black/60 px-1.5 py-px font-semibold text-white"
            style={{ fontSize: cq(8) }}
          >
            {title}
          </span>
        </>
      ) : video ? (
        <>
          {video.posterUrl ? (
            // A third-party poster loads only for a Screen that has a link, as every embed's poster does.
            <img
              src={video.posterUrl}
              alt=""
              draggable={false}
              className="absolute inset-0 h-full w-full object-cover opacity-90"
            />
          ) : (
            <span
              className="absolute inset-x-0 top-[22%] text-center font-semibold text-slate-300"
              style={{ fontSize: cq(10) }}
            >
              {video.label}
            </span>
          )}
          <span
            className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-white ring-1 ring-white/30 transition group-hover/screen:scale-110 motion-reduce:transition-none"
            style={{ width: cq(36), height: cq(36) }}
          >
            <PlayIcon />
          </span>
        </>
      ) : (
        <span
          className="absolute inset-0 flex flex-col items-center justify-center gap-1"
          style={{ color: A.tones.ink }}
        >
          <ScreenGlyph size={20} className="opacity-60" />
          <span className="font-medium tracking-wide opacity-80" style={{ fontSize: cq(10) }}>
            {SCREEN_IDLE_TEXT}
          </span>
        </span>
      )}
      {/* The glass: a faint diagonal sheen over whatever it shows. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'linear-gradient(115deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.02) 38%, transparent 38.5%)',
        }}
      />
    </div>
  );
  return (
    <div
      className={`pointer-events-none absolute inset-0 ${animClass ?? ''}`}
      style={{ containerType: 'size' }}
    >
      {/* The shadow on the wall behind. */}
      <span
        aria-hidden
        className="absolute inset-0"
        style={{
          transform: `translate(${A.shadow.dx}px, ${A.shadow.dy}px)`,
          borderRadius: A.bezel.rx,
          background: `rgba(0,0,0,${A.shadow.opacity})`,
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          borderRadius: A.bezel.rx,
          background: A.tones.bezel,
          boxShadow: `inset 0 0 0 1px ${A.tones.bezelEdge}, inset 0 1px 0 rgba(255,255,255,0.08)`,
        }}
      />
      {open ? (
        <HoverCard
          title={share ? `Open ${title}` : `Play ${title}`}
          description="Opens it large"
          className="pointer-events-auto absolute inset-0"
        >
          <button
            type="button"
            aria-label={share ? `Open ${title}` : `Play ${title}`}
            {...press}
            className="group/screen pointer-events-auto absolute inset-0 cursor-pointer rounded-[inherit] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
          >
            {panel}
          </button>
        </HoverCard>
      ) : (
        <div role="img" aria-label={`Screen: ${title}`} className="absolute inset-0">
          {panel}
        </div>
      )}
      {/* The status light: green while it shows something. */}
      <span
        aria-hidden
        className="absolute rounded-full"
        style={{
          left: `calc(${pct(A.light.cx, A.bezel.w)} - ${A.light.r}px)`,
          top: `calc(${pct(A.light.cy, A.bezel.h)} - ${A.light.r}px)`,
          width: A.light.r * 2,
          height: A.light.r * 2,
          background: share || video ? '#4ade80' : A.tones.bezelEdge,
          boxShadow: share || video ? '0 0 4px #4ade80' : undefined,
        }}
      />
      {playing && video ? <ScreenPlayer target={video} onClose={() => setPlaying(false)} /> : null}
    </div>
  );
}
