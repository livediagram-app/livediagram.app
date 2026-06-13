'use client';

import { useState } from 'react';
import { type LinkCardElement } from '@livediagram/diagram';

// Inner content of a link-card element (spec/40): a favicon + title + host
// row, with the OG image as a top banner when present. The card border /
// background come from the BoxedElementView wrapper (describeVariant); this
// is `pointer-events-none` so dragging / selecting the card still works (the
// wrapper owns the pointer). Empty state prompts the user to add a URL;
// double-clicking the card opens the link picker (handled in BoxedElementView).
function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

export function LinkCardView({ element }: { element: LinkCardElement }) {
  const url = element.link?.kind === 'url' ? element.link.url : undefined;
  // Only trust cached meta that matches the CURRENT url (it's stale otherwise).
  const meta = element.meta && element.meta.url === url ? element.meta : undefined;
  const [imgOk, setImgOk] = useState(true);
  const [favOk, setFavOk] = useState(true);

  if (!url) {
    return (
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-3 text-center text-[12px] font-medium text-slate-400 dark:text-slate-500">
        Add a link — double-click
      </div>
    );
  }

  const title = meta?.title ?? url;
  const host = meta?.siteName ?? hostOf(url);
  const showImage = !!meta?.image && imgOk;

  return (
    <div
      className={`pointer-events-none absolute inset-0 flex flex-col overflow-hidden ${showImage ? '' : 'justify-center'}`}
    >
      {showImage ? (
        <div className="min-h-0 flex-1 overflow-hidden bg-slate-100 dark:bg-slate-800">
          <img
            src={meta!.image}
            alt=""
            onError={() => setImgOk(false)}
            referrerPolicy="no-referrer"
            className="h-full w-full object-cover"
          />
        </div>
      ) : null}
      <div className="flex shrink-0 items-center gap-2 px-2.5 py-2">
        {meta?.favicon && favOk ? (
          <img
            src={meta.favicon}
            alt=""
            onError={() => setFavOk(false)}
            referrerPolicy="no-referrer"
            className="h-4 w-4 shrink-0 rounded-sm"
          />
        ) : (
          <span className="h-4 w-4 shrink-0 rounded-sm bg-slate-200 dark:bg-slate-700" />
        )}
        <div className="min-w-0 flex-1">
          <p
            className="line-clamp-2 text-[12px] font-semibold leading-tight"
            style={{ color: element.textColor ?? '#1e293b' }}
          >
            {title}
          </p>
          <p className="truncate text-[10px] text-slate-400 dark:text-slate-500">{host}</p>
        </div>
      </div>
    </div>
  );
}
