'use client';

// The Screen (docs/specs/009-elements/screen-and-room-sign.md "Screen"): a wall screen that shows, for each viewer,
// a screen share from someone standing in its room, else its source: a file from any of the apps (a title card, live
// in the file's own frame while the viewer stands in the room, ScreenFileFace), or its Video Link's poster; else an
// idle face. Pressing it opens the share in the call's maximised panel, the file in the file overlay, or the video in
// a large player. It shows only a stream this viewer already receives (the bubble rules), and re-renders when its
// room's people or the received streams change, never on a step.
import { useState } from 'react';
import {
  SCREEN_ART,
  SCREEN_IDLE_TEXT,
  screenFile,
  screenVideoTarget,
  type ShapeElement,
} from '@livehuddle/document';
import { lucidePlay } from '@liveworkspace/icons/lucide';
import { HoverCard, lucideGlyph, WorkspaceMark } from '@livehuddle/ui';
import { setCallMaximised, useCallMedia } from '@/lib/calls/calls-store';
import { useMeetingLive } from '@/lib/office/meeting-live';
import { usePressWithoutDrag } from '@liveworkspace/workbench/hooks/ui/usePressWithoutDrag';
import { track } from '@/lib/telemetry';
import { MediaVideo, mediaTitle } from '@/components/calls/MediaBubble';
import { SELF_MEDIA_ID } from '@/lib/calls/calls-media-store';
import { ScreenFileOverlayPanel } from '@/components/dialogs/screen-source-panel';
import { ScreenFileFace } from './ScreenFileFace';
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

// Who in the Screen's room is sharing and received here (the nearest the Screen), and whether you stand in it.
function useScreenRoom(id: string) {
  const live = useMeetingLive(id);
  const media = useCallMedia();
  if (!live || !('inside' in live)) return { share: null, inRoom: false };
  let share: { id: string; name: string | null; stream: MediaStream } | null = null;
  for (const p of live.inside) {
    const stream = media.get(p.id)?.screen;
    if (stream) {
      share = { id: p.id, name: p.name, stream };
      break;
    }
  }
  return { share, inRoom: live.inside.some((p) => p.id === SELF_MEDIA_ID) };
}

const preloadOverlay = () => void ScreenFileOverlayPanel.preload();

export function ScreenView({ element, animClass }: { element: ShapeElement; animClass?: string }) {
  const { share, inRoom } = useScreenRoom(element.id);
  const file = share ? null : screenFile(element);
  const video = share || file ? null : screenVideoTarget(element.screenUrl);
  const [playing, setPlaying] = useState(false);
  const [reading, setReading] = useState(false);
  // What was opened large went away (an Editor cleared or swapped the source, or a share in the room took the Screen
  // over): it closes, rather than coming back by itself the next time the Screen shows something.
  if (reading && !file) setReading(false);
  if (playing && !video) setPlaying(false);
  const open = share
    ? () => {
        track('Canvas', 'Used', 'ScreenOpen');
        setCallMaximised({ id: share.id, media: 'screen' });
      }
    : file
      ? () => {
          track('Canvas', 'Used', 'ScreenOpen');
          setReading(true);
        }
      : video
        ? () => {
            track('Canvas', 'Used', 'ScreenOpen');
            setPlaying(true);
          }
        : undefined;
  const press = usePressWithoutDrag(open);
  const title = share
    ? mediaTitle(share.name, 'screen')
    : file
      ? file.liveName || 'a file'
      : video
        ? video.label
        : SCREEN_IDLE_TEXT;
  const verb = share || file ? 'Open' : 'Play';
  const panel = (
    <div
      data-screen-face={share ? 'share' : file ? 'file' : video ? 'video' : 'idle'}
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
      ) : file ? (
        <ScreenFileFace file={file} inRoom={inRoom} paused={reading} />
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
        // The idle face (screen-and-room-sign.md "The idle face"): liveworkspace's logo on the glass, still on the
        // flat canvas, in a soft glow. Real 3D turns it (idle-screens.ts).
        <span
          data-screen-idle-logo=""
          className="absolute inset-0 flex flex-col items-center justify-center"
          style={{
            gap: cq(6),
            background:
              'radial-gradient(ellipse 42% 52% at 50% 42%, rgba(148,163,184,0.26), transparent 70%)',
          }}
        >
          {/* Its dark palette whatever the page's appearance: it sits on the screen's dark glass. */}
          <span className="block" style={{ width: cq(44), height: cq(44) }}>
            <WorkspaceMark className="dark block h-full w-full" />
          </span>
          <span
            aria-hidden
            className="font-semibold tracking-tight"
            style={{ fontSize: cq(15), lineHeight: 1, color: '#f1f5f9' }}
          >
            <span style={{ color: '#94a3b8' }}>live</span>workspace
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
          title={`${verb} ${title}`}
          description="Opens it large"
          className="pointer-events-auto absolute inset-0"
        >
          <button
            type="button"
            aria-label={`${verb} ${title}`}
            {...press}
            onPointerEnter={file ? preloadOverlay : undefined}
            onFocus={file ? preloadOverlay : undefined}
            data-piece-main=""
            className="group/screen pointer-events-auto absolute inset-0 cursor-pointer rounded-[inherit] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
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
          background: share || file || video ? '#4ade80' : A.tones.bezelEdge,
          boxShadow: share || file || video ? '0 0 4px #4ade80' : undefined,
        }}
      />
      {playing && video ? <ScreenPlayer target={video} onClose={() => setPlaying(false)} /> : null}
      {reading && file ? (
        <ScreenFileOverlayPanel
          // Another file chosen while open large opens afresh, on its own first tab, not the last file's.
          key={`${file.liveItem.app}:${file.liveItem.itemId}`}
          elementId={element.id}
          file={file}
          onClose={() => setReading(false)}
        />
      ) : null}
    </div>
  );
}
