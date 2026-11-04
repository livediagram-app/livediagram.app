'use client';

// A bubble opened large (docs/specs/012-collaboration/video-and-screen-bubbles.md "Maximised"): a panel over the
// canvas, at most 1280 px wide and 90% of the window, its person's name and Restore in a bar above the picture. The canvas stays live behind
// a soft dim; Restore, Escape or the backdrop put it back. Outside the canvas's transform, so it never zooms.
import { useRef } from 'react';
import { lucideMinimize2 } from '@liveworkspace/icons/lucide';
import { lucideGlyph, Portal, useEscape, useFocusTrap } from '@livehuddle/ui';
import { setCallMaximised, useCallMaximised, type CallMediaStreams } from '@/lib/calls/calls-store';
import { MediaVideo, mediaTitle } from './MediaBubble';

const RestoreIcon = lucideGlyph(lucideMinimize2, 16);
const restore = () => setCallMaximised(null);

export function MaximisedBubble({
  media,
  nameOf,
}: {
  media: ReadonlyMap<string, CallMediaStreams>;
  // The person a bubble belongs to (name null for your own), or null once they have gone.
  nameOf: (id: string) => { name: string | null; color: string } | null;
}) {
  const open = useCallMaximised();
  const stream = open ? media.get(open.id)?.[open.media] : undefined;
  const who = open ? nameOf(open.id) : null;
  const shown = !!open && !!stream && !!who;
  return shown ? <Panel stream={stream} media={open.media} who={who} /> : null;
}

function Panel({
  stream,
  media,
  who,
}: {
  stream: MediaStream;
  media: 'video' | 'screen';
  who: { name: string | null; color: string };
}) {
  const panel = useRef<HTMLDivElement>(null);
  // Focus goes to Restore, and back to the bubble pressed when the panel closes.
  useFocusTrap(panel, true, 'first');
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
          aria-modal="true"
          aria-label={title}
          className="relative w-full max-w-[min(1280px,calc((90dvh-4.25rem)*16/9))] overflow-hidden rounded-2xl bg-slate-950 shadow-2xl ring-1 ring-white/10 motion-safe:animate-card-rise"
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
            <button
              type="button"
              onClick={restore}
              className="flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-lg bg-white/10 px-3 text-sm font-medium text-white ring-1 ring-white/15 transition hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white active:bg-white/25"
            >
              <RestoreIcon />
              Restore
            </button>
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
