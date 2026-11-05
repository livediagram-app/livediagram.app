'use client';

// A Screen's video opened large (docs/specs/009-elements/screen-and-room-sign.md "Screen"): the reader's shell
// (ReaderShell, dark), with the video's name and Close in a bar above the player. The player mounts only here, on
// the provider's embed origin, so nothing third-party loads until somebody opens it. Not synced: it plays for
// whoever opened it.
import type { EmbedTarget } from '@livehuddle/document';
import { ReaderShell } from './ReaderShell';

export function ScreenPlayer({ target, onClose }: { target: EmbedTarget; onClose: () => void }) {
  const title = `${target.label} on the Screen`;
  return (
    <ReaderShell
      title={title}
      onClose={onClose}
      tone="dark"
      widthClassName="max-w-[min(1280px,calc((90dvh-4.25rem)*16/9))]"
      data-screen-player
    >
      <div className="aspect-video w-full">
        <iframe
          src={target.embedUrl}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          className="h-full w-full border-0"
        />
      </div>
    </ReaderShell>
  );
}
