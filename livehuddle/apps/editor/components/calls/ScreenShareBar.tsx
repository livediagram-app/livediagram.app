'use client';

// "You are sharing your screen" (docs/specs/012-collaboration/video-and-screen-bubbles.md "The screen share"): a clear
// bar at the top of the canvas while this browser shares, with Stop Sharing. Dark in both themes, as an operating
// system's own sharing bar is, so it never reads as part of the board.
import { lucideScreenShareOff } from '@liveworkspace/icons/lucide';
import { lucideGlyph, Portal } from '@livehuddle/ui';
import { useCallActions, useCallSelf } from '@/lib/calls/calls-store';

const StopIcon = lucideGlyph(lucideScreenShareOff, 14);

export function ScreenShareBar() {
  const self = useCallSelf();
  const actions = useCallActions();
  if (self.screen !== 'on' || !actions) return null;
  return (
    <Portal>
      <div
        role="status"
        className="pointer-events-none fixed inset-x-0 top-[calc(env(safe-area-inset-top)+4.25rem)] z-50 flex justify-center px-4 motion-safe:animate-card-rise"
      >
        <div className="pointer-events-auto flex max-w-full items-center gap-3 rounded-full bg-slate-900/95 py-1.5 pr-1.5 pl-3.5 text-sm text-white shadow-xl ring-1 ring-white/10 backdrop-blur">
          <span aria-hidden className="relative flex size-2.5 shrink-0">
            <span className="absolute inset-0 rounded-full bg-rose-400 opacity-75 motion-safe:animate-ping" />
            <span className="relative size-2.5 rounded-full bg-rose-500" />
          </span>
          {/* A phone has room for the short form beside Stop Sharing; the long one would cut off. */}
          <span className="truncate font-medium phone:hidden">You are sharing your screen</span>
          <span className="hidden truncate font-medium phone:inline">Sharing your screen</span>
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={actions.toggleScreen}
            className="flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-full bg-rose-500 px-3 font-semibold text-white transition hover:bg-rose-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white active:bg-rose-700"
          >
            <StopIcon />
            <span className="text-optical-centre">Stop Sharing</span>
          </button>
        </div>
      </div>
    </Portal>
  );
}
