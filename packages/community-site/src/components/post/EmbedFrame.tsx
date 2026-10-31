'use client';

import { COMMUNITY_DOT_GRID } from '@liveworkspace/community-ui';
import { useEffect, useState } from 'react';
import { useCommunitySite } from '../../client';
import { capitalise } from '../../lib/format';
import { FullScreenIcon } from '../shared/icons';

// How long the embed may take to load before the page settles for the still image (ms).
const EMBED_TIMEOUT_MS = 15_000;

// The interactive preview (livediagram/docs/specs/025-community/community.md "Post"): the
// read-only embed in a frame, so it pans, zooms and switches tabs. The card image sits underneath in
// the same fixed box, so something shows at once and nothing shifts; if the frame errors or never
// loads, the image stays with an Open Document link.
export function EmbedFrame({ shareCode, title }: { shareCode: string; title: string }) {
  const { links, words } = useCommunitySite();
  const [state, setState] = useState<'loading' | 'loaded' | 'failed'>('loading');

  useEffect(() => {
    const timer = window.setTimeout(
      () => setState((s) => (s === 'loading' ? 'failed' : s)),
      EMBED_TIMEOUT_MS,
    );
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div
      className={`relative aspect-[4/3] w-full overflow-hidden rounded-2xl border border-slate-200 shadow-sm sm:aspect-[16/10] dark:border-slate-800 ${COMMUNITY_DOT_GRID}`}
    >
      <img
        src={links.image(shareCode)}
        alt={title}
        className="absolute inset-0 h-full w-full object-contain p-6"
      />
      {state !== 'failed' ? (
        <iframe
          src={links.embed(shareCode)}
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
          href={links.openDocument(shareCode)}
          className="absolute bottom-4 right-4 inline-flex items-center gap-1.5 rounded-lg bg-white/95 px-3 py-2 text-sm font-semibold text-slate-700 shadow-md ring-1 ring-slate-900/5 transition-colors duration-micro hover:text-brand-700 dark:bg-slate-900/95 dark:text-slate-200 dark:ring-white/10 dark:hover:text-brand-300"
        >
          <FullScreenIcon aria-hidden />
          {`Open ${capitalise(words.noun)}`}
        </a>
      )}
    </div>
  );
}
