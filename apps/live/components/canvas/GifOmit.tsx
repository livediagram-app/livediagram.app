import type { ReactNode } from 'react';
import { GIF_OMIT_ATTR } from '@/lib/gif-export/gif-omit';

// Editor-only marks inside the canvas's content layer (cursors, drafts): left out of an animated
// GIF's frames (lib/gif-export/gif-omit.ts). `display: contents`, so the wrapper adds no box and no stacking context.
export function GifOmit({ children }: { children: ReactNode }) {
  return (
    <div {...{ [GIF_OMIT_ATTR]: '' }} className="contents">
      {children}
    </div>
  );
}
