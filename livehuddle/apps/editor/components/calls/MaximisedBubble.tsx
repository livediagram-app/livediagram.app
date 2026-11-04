'use client';

// A bubble opened large (docs/specs/012-collaboration/video-and-screen-bubbles.md "Maximised"): a panel over the
// canvas, at most 1280 px wide and 90% of the window, its person's name and Restore in a bar above the picture. The canvas stays live behind
// a soft dim; Restore, Escape or the backdrop put it back. Outside the canvas's transform, so it never zooms.
import { useRef } from 'react';
import { lucideMinimize2, lucideScreenShareOff } from '@liveworkspace/icons/lucide';
import { HoverCard, lucideGlyph, Portal, useEscape, useFocusTrap } from '@livehuddle/ui';
import { setCallMaximised, useCallMaximised, type CallMediaStreams } from '@/lib/calls/calls-store';
import { MediaVideo, mediaTitle } from './MediaBubble';

const RestoreIcon = lucideGlyph(lucideMinimize2, 16);
const StopIcon = lucideGlyph(lucideScreenShareOff, 16);
const restore = () => setCallMaximised(null);

export function MaximisedBubble({
  media,
  nameOf,
  onStopShare,
}: {
  media: ReadonlyMap<string, CallMediaStreams>;
  // The person a bubble belongs to (name null for your own), or null once they have gone.
  nameOf: (id: string) => { name: string | null; color: string } | null;
  // An Editor stopping someone else's share (video-and-screen-bubbles.md "Share roles"); absent for anyone else.
  onStopShare?: (id: string) => void;
}) {
  const open = useCallMaximised();
  const stream = open ? media.get(open.id)?.[open.media] : undefined;
  const who = open ? nameOf(open.id) : null;
  const shown = !!open && !!stream && !!who;
  if (!shown) return null;
  const stop =
    onStopShare && open.media === 'screen' && who.name !== null
      ? () => onStopShare(open.id)
      : undefined;
  return <Panel stream={stream} media={open.media} who={who} onStop={stop} />;
}

function Panel({
  stream,
  media,
  who,
  onStop,
}: {
  stream: MediaStream;
  media: 'video' | 'screen';
  who: { name: string | null; color: string };
  onStop?: () => void;
}) {
  const panel = useRef<HTMLDivElement>(null);
  // Focus goes to Restore, and back to the bubble pressed when the panel closes. With Stop Sharing first in the bar
  // (an Editor's, on someone else's screen), to the panel itself: a stray Enter must never end someone's share.
  useFocusTrap(panel, true, onStop ? 'container' : 'first');
  // Escape is the panel's alone while it is open, before the editor's own shortcuts see it.
  useEscape(restore, { capture: true, stopPropagation: true });
  const title = mediaTitle(who.name, media);
  return (
    <Portal>
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-8">
        <button
          type="button"
          tabIndex={-1}
          aria-label="Restore"
          onClick={restore}
          className="absolute inset-0 cursor-default bg-slate-950/55 backdrop-blur-[2px]"
        />
        <div
          ref={panel}
          role="dialog"
          tabIndex={-1}
          aria-modal="true"
          aria-label={title}
          className="relative w-full max-w-[min(1280px,calc((90dvh-4.25rem)*16/9))] overflow-hidden outline-none rounded-2xl bg-slate-950 shadow-2xl ring-1 ring-white/10 motion-safe:animate-card-rise"
        >
          {/* A bar of its own above the picture, never over it: a shared screen's own title sits at its top. */}
          <div className="flex h-13 items-center justify-between gap-3 border-b border-white/10 px-3">
            <span className="flex min-w-0 items-center gap-2 text-sm font-semibold text-white">
              <span
                aria-hidden
                className="size-2.5 shrink-0 rounded-full ring-2 ring-white/30"
                style={{ background: who.color }}
              />
              <span className="truncate">{title}</span>
            </span>
            <span className="flex shrink-0 items-center gap-2">
              {onStop ? (
                <HoverCard title={`Stop ${title}`} description="Ends their share for everyone">
                  <button
                    type="button"
                    data-call-panel-stop
                    onClick={onStop}
                    className="flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-lg bg-rose-500 px-3 text-sm font-semibold text-white transition hover:bg-rose-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white active:bg-rose-700"
                  >
                    <StopIcon />
                    <span className="phone:hidden">Stop Sharing</span>
                    <span className="hidden phone:inline">Stop</span>
                  </button>
                </HoverCard>
              ) : null}
              <button
                type="button"
                onClick={restore}
                className="flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-lg bg-white/10 px-3 text-sm font-medium text-white ring-1 ring-white/15 transition hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white active:bg-white/25"
              >
                <RestoreIcon />
                Restore
              </button>
            </span>
          </div>
          <div className="aspect-video w-full">
            <MediaVideo
              stream={stream}
              fit="contain"
              mirrored={who.name === null && media === 'video'}
            />
          </div>
        </div>
      </div>
    </Portal>
  );
}
