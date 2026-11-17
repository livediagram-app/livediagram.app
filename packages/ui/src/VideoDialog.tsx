'use client';

// A video in a dialog centred over the page (owner, 2026-11-17: modals open in the middle), under the illustrated hero
// header: the art, the title and a line under it, the page's own actions (a walkthrough's Share) beside Full Screen,
// and Close. Then the video with the browser's own controls. A walkthrough plays in it from the editor's Tools and from
// the Explorer's library alike.

import { useId, useRef, type ReactNode } from 'react';
import { Dialog } from './dialog/Dialog';
import { HeroDialogHeader } from './dialog/hero/HeroDialogHeader';
import type { HeroArt } from './dialog/hero/hero-art';
import { MaximizeIcon } from './icons/navigation';
import { Tooltip } from './Tooltip';

const ICON_BUTTON =
  'flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-slate-500 transition hover:bg-black/5 hover:text-slate-800 dark:hover:bg-white/10 dark:hover:text-slate-100';

export function VideoDialog({
  art,
  title,
  meta,
  src,
  actions,
  onClose,
}: {
  art: HeroArt;
  title: string;
  meta?: ReactNode;
  src: string;
  actions?: ReactNode;
  onClose: () => void;
}) {
  const titleId = useId();
  const video = useRef<HTMLVideoElement & { webkitEnterFullscreen?: () => void }>(null);
  const fullScreen = () => {
    const v = video.current;
    if (!v) return;
    if (v.requestFullscreen) void v.requestFullscreen().catch(() => undefined);
    // iPhone Safari: only the video's own full screen.
    else v.webkitEnterFullscreen?.();
  };
  return (
    <Dialog open onClose={onClose} titleId={titleId} size="3xl" initialFocus="container">
      <div data-video-dialog="" className="flex min-h-0 flex-1 flex-col">
        <HeroDialogHeader
          art={art}
          titleId={titleId}
          // The whole name on hover when the heading cuts it short.
          title={
            <Tooltip label={title}>
              <span>{title}</span>
            </Tooltip>
          }
          subtitle={meta}
          onClose={onClose}
          actions={
            <>
              {actions}
              {/* No tooltip: the icon says it (owner, 2026-11-17); its name is for screen readers. */}
              <button
                type="button"
                aria-label="Full Screen"
                onClick={fullScreen}
                className={ICON_BUTTON}
              >
                <MaximizeIcon size={14} />
              </button>
            </>
          }
        />
        <video
          ref={video}
          src={src}
          controls
          autoPlay
          playsInline
          className="block max-h-[calc(100dvh-12rem)] min-h-0 w-full bg-black sm:rounded-b-2xl"
        />
      </div>
    </Dialog>
  );
}
