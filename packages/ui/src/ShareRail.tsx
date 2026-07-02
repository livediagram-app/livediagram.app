'use client';

import { useEffect, useRef, useState } from 'react';

// The canonical site origin we want people to pass along. Hardcoded here (it
// mirrors apps/marketing/lib/site SITE_URL) so this rail is self-contained and
// shareable from any app that renders the shared SiteHeader, not just marketing.
const SHARE_URL = 'https://livediagram.app';

/** The line we want people to pass along; the URL is the shared site origin. */
const SHARE_TEXT =
  'livediagram: a real-time multiplayer canvas for diagrams and mindmaps. No sign-up needed.';

const encodedUrl = encodeURIComponent(SHARE_URL);
const encodedText = encodeURIComponent(SHARE_TEXT);

// Icons are stored as raw <path> `d` strings, not JSX, so this module has no
// top-level JSX evaluated at import time, which keeps the shared barrel
// importable from non-React test transforms. The <svg> is built in the render.
type ShareTarget = {
  label: string;
  href: string;
  path: string;
};

const TARGETS: ShareTarget[] = [
  {
    label: 'X',
    href: `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`,
    path: 'M18.244 2.25h3.308l-7.227 8.26 8.502 11.24h-6.66l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231Zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77Z',
  },
  {
    label: 'LinkedIn',
    href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
    path: 'M20.45 20.45h-3.55v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.36V9h3.41v1.56h.05c.47-.9 1.63-1.85 3.36-1.85 3.6 0 4.27 2.37 4.27 5.45v6.29ZM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12ZM7.12 20.45H3.55V9h3.57v11.45ZM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.22.79 24 1.77 24h20.45c.98 0 1.78-.78 1.78-1.73V1.73C24 .77 23.2 0 22.22 0Z',
  },
  {
    label: 'Facebook',
    href: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
    path: 'M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07c0 6.02 4.39 11.01 10.13 11.93v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.68.24 2.68.24v2.97h-1.51c-1.49 0-1.95.93-1.95 1.89v2.25h3.32l-.53 3.49h-2.79v8.44C19.61 23.08 24 18.09 24 12.07Z',
  },
  {
    label: 'WhatsApp',
    href: `https://wa.me/?text=${encodeURIComponent(`${SHARE_TEXT} ${SHARE_URL}`)}`,
    path: 'M.057 24l1.687-6.163a11.867 11.867 0 0 1-1.587-5.946C.16 5.335 5.495 0 12.05 0a11.82 11.82 0 0 1 8.413 3.488 11.82 11.82 0 0 1 3.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 0 1-5.688-1.448L.057 24Zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884a9.86 9.86 0 0 0 1.51 5.26l-.999 3.648 3.978-1.052Zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414Z',
  },
  {
    label: 'Email',
    href: `mailto:?subject=${encodeURIComponent('You should try livediagram')}&body=${encodeURIComponent(`${SHARE_TEXT}\n\n${SHARE_URL}`)}`,
    path: 'M3 4.5h18A1.5 1.5 0 0 1 22.5 6v12a1.5 1.5 0 0 1-1.5 1.5H3A1.5 1.5 0 0 1 1.5 18V6A1.5 1.5 0 0 1 3 4.5Zm.42 2.06 8.58 6.06 8.58-6.06H3.42ZM20.5 7.73l-7.92 5.6a1 1 0 0 1-1.16 0L3.5 7.73V17.5h17V7.73Z',
  },
];

/**
 * Vertical share rail pinned to the right edge of the page, replacing the old
 * header Share popover so the header has room to breathe. A rotated "Share"
 * label sits above the social-share links (plain share-intent URLs, no SDKs /
 * tracking) and a copy-link action. Wide desktop only (xl+): the page content
 * is `max-w-6xl` (1152px), so only past the xl breakpoint (1280px) is there a
 * real gutter for a fixed right rail to sit in without overlapping; on smaller
 * screens it stays hidden, and the page URL is inherently shareable anyway.
 * Rendered as a sibling of the header (not a descendant) so the header's
 * `backdrop-filter` doesn't trap its `fixed` positioning.
 */
export function ShareRail() {
  const [copied, setCopied] = useState(false);
  // One live "copied" reset at a time: a rapid second copy must not have
  // its confirmation cancelled by the first copy's stale timer, and the
  // timer must not fire (setState) after unmount.
  const copiedTimerRef = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (copiedTimerRef.current !== null) window.clearTimeout(copiedTimerRef.current);
    },
    [],
  );

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(SHARE_URL);
      setCopied(true);
      if (copiedTimerRef.current !== null) window.clearTimeout(copiedTimerRef.current);
      copiedTimerRef.current = window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked (insecure context / permissions), leave as-is.
    }
  }

  const iconButton =
    'flex h-8 w-8 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500';

  return (
    <div className="fixed right-0 top-1/2 z-40 hidden -translate-y-1/2 xl:block">
      <div className="flex flex-col items-center gap-1 rounded-l-xl border border-r-0 border-slate-200 bg-white/90 py-3 pl-2 pr-1.5 shadow-lg backdrop-blur">
        <span className="mb-1 rotate-180 text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-400 [writing-mode:vertical-rl]">
          Share
        </span>
        {TARGETS.map((target) => (
          <a
            key={target.label}
            href={target.href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Share on ${target.label}`}
            className={iconButton}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 fill-current">
              <path d={target.path} />
            </svg>
          </a>
        ))}
        <span aria-hidden="true" className="my-0.5 h-px w-5 bg-slate-200" />
        <button
          type="button"
          onClick={copyLink}
          aria-label={copied ? 'Link copied' : 'Copy link'}
          className={iconButton}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 fill-none stroke-current">
            {copied ? (
              <path
                d="m5 13 4 4L19 7"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ) : (
              <path
                d="M10 13a5 5 0 0 0 7.07 0l2.83-2.83a5 5 0 0 0-7.07-7.07l-1.41 1.41M14 11a5 5 0 0 0-7.07 0L4.1 13.83a5 5 0 0 0 7.07 7.07l1.41-1.41"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}
          </svg>
        </button>
      </div>
    </div>
  );
}
