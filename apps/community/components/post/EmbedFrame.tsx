'use client';

import { useEffect, useState } from 'react';
import { postImageUrl } from '@/lib/api';
import { embedHref, openBoardHref } from '@/lib/links';
import { FullScreenIcon } from '../shared/icons';

// How long the embed may take to load before the page settles for the still image (ms).
const EMBED_TIMEOUT_MS = 15_000;

// The interactive preview (docs/specs/025-community/community.md "Post"; blueprint §5, §6, §10): the
// read-only embed in a frame, so it pans, zooms and switches tabs. The card image sits underneath in
// the same fixed box, so something shows at once and nothing shifts; if the frame errors or never
// loads, the image stays with an Open Board link (blueprint §6 "Embed frame fails").
export function EmbedFrame({ shareCode, title }: { shareCode: string; title: string }) {
  const [state, setState] = useState<'loading' | 'loaded' | 'failed'>('loading');

  useEffect(() => {
    const timer = window.setTimeout(
      () => setState((s) => (s === 'loading' ? 'failed' : s)),
      EMBED_TIMEOUT_MS,
    );
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div className="dot-grid relative aspect-[4/3] w-full overflow-hidden rounded-2xl border border-slate-200 shadow-sm sm:aspect-[16/10] dark:border-slate-800">
      <img
        src={postImageUrl(shareCode)}
        alt={title}
        className="absolute inset-0 h-full w-full object-contain p-6"
      />
      {state !== 'failed' ? (
        <iframe
          src={embedHref(shareCode)}
          title={`Interactive preview of ${title}`}
          loading="lazy"
          onLoad={() => setState('loaded')}
          onError={() => setState('failed')}
          className={`absolute inset-0 h-full w-full border-0 bg-white transition-opacity duration-short motion-reduce:transition-none dark:bg-slate-950 ${
            state === 'loaded' ? 'opacity-100' : 'opacity-0'
          }`}
        />
      ) : (
        <a
          href={openBoardHref(shareCode)}
          className="absolute bottom-4 right-4 inline-flex items-center gap-1.5 rounded-lg bg-white/95 px-3 py-2 text-sm font-semibold text-slate-700 shadow-md ring-1 ring-slate-900/5 transition-colors duration-micro hover:text-brand-700 dark:bg-slate-900/95 dark:text-slate-200 dark:ring-white/10 dark:hover:text-brand-300"
        >
          <FullScreenIcon aria-hidden />
          Open Board
        </a>
      )}
    </div>
  );
}
