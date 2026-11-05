'use client';

// A Screen's video opened large (docs/specs/009-elements/screen-and-room-sign.md "Screen"): the call's maximised
// panel's shell (MaximisedBubble), with the video's name and Close in a bar above the player. The player mounts only
// here, on the provider's embed origin, so nothing third-party loads until somebody opens it. Not synced: it plays
// for whoever opened it.
import { useRef } from 'react';
import type { EmbedTarget } from '@livehuddle/document';
import { lucideX } from '@liveworkspace/icons/lucide';
import { lucideGlyph, Portal, useEscape, useFocusTrap } from '@livehuddle/ui';

const CloseIcon = lucideGlyph(lucideX, 16);
const stop = (e: { stopPropagation: () => void }) => e.stopPropagation();

export function ScreenPlayer({ target, onClose }: { target: EmbedTarget; onClose: () => void }) {
  const panel = useRef<HTMLDivElement>(null);
  useFocusTrap(panel, true, 'first');
  useEscape(onClose, { capture: true, stopPropagation: true });
  const title = `${target.label} on the Screen`;
  return (
    <Portal>
      {/* React events bubble out of a portal to the element it was opened from: kept here, so a press in the player
          never selects or drags the Screen behind it. */}
      <div
        className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-8"
        onPointerDown={stop}
        onClick={stop}
        onDoubleClick={stop}
      >
        <button
          type="button"
          tabIndex={-1}
          aria-label="Close"
          onClick={onClose}
          className="absolute inset-0 cursor-default bg-slate-950/55 backdrop-blur-[2px]"
        />
        <div
          ref={panel}
          role="dialog"
          tabIndex={-1}
          aria-modal="true"
          aria-label={title}
          data-screen-player
          className="relative w-full max-w-[min(1280px,calc((90dvh-4.25rem)*16/9))] overflow-hidden rounded-2xl bg-slate-950 shadow-2xl ring-1 ring-white/10 outline-none motion-safe:animate-card-rise"
        >
          <div className="flex h-13 items-center justify-between gap-3 border-b border-white/10 px-3">
            <span className="truncate text-sm font-semibold text-white">{title}</span>
            <button
              type="button"
              onClick={onClose}
              className="flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-lg bg-white/10 px-3 text-sm font-medium text-white ring-1 ring-white/15 transition hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white active:bg-white/25"
            >
              <CloseIcon />
              Close
            </button>
          </div>
          <div className="aspect-video w-full">
            <iframe
              src={target.embedUrl}
              title={title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              className="h-full w-full border-0"
            />
          </div>
        </div>
      </div>
    </Portal>
  );
}
