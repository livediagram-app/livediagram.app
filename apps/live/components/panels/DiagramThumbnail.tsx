'use client';

import { useEffect, useRef, useState } from 'react';
import { apiFetchDiagramThumbnailUrl } from '@/lib/api-client';

// A cached SVG snapshot of a diagram (spec/67) so you can recognise it
// without opening it. Shared by every Explorer surface that lists
// diagrams: the full-page rows, the "Shared with me" list, the team
// library, and the floating in-editor panel.
//
// The bytes come from the api worker's render-cache fetched through the
// authenticated client (an <img src> can't carry auth headers), then
// hung on an <img> via a blob URL. The diagram list endpoints stay
// lightweight (no element data); a thumbnail is fetched only once its
// row/card scrolls into view, so a long list never fires dozens of
// requests / server renders for things the user never reaches. While
// idle / loading / broken it shows a generic glyph, so the layout never
// shifts and an empty or access-denied diagram degrades gracefully.
//
// Size is controlled by the caller via `className` (a small box in a
// row, a large preview in a card); the <img> fills it with object-fit
// contain so the whole diagram stays visible at any aspect ratio.

type State =
  | { status: 'idle' | 'loading' | 'broken' }
  | { status: 'ready'; src: string; backgroundColor: string | null };

const DEFAULT_BOX =
  'h-7 w-9 rounded border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900/40';

export function DiagramThumbnail({
  ownerId,
  diagramId,
  version,
  shareCode,
  offline = false,
  className = DEFAULT_BOX,
}: {
  // Viewer identity for the authenticated fetch. Null while a guest id
  // is still resolving — we just hold the placeholder until it lands.
  ownerId: string | null;
  diagramId: string;
  // The diagram's savedAt, forwarded as the cache-bust version so an
  // edited diagram re-fetches a fresh snapshot.
  version: number;
  // Present on a "shared with me" row (spec/35): authorises the read via
  // the share code instead of ownership / team membership.
  shareCode?: string | null;
  // Offline Mode (spec/76): an offline diagram has no server snapshot, so
  // show a fixed offline illustration instead of fetching a thumbnail.
  offline?: boolean;
  // Container sizing/appearance. Defaults to the compact row box; a card
  // passes a larger box (e.g. a full-width 16:9 area).
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [visible, setVisible] = useState(false);
  const [state, setState] = useState<State>({ status: 'idle' });

  // Defer the fetch until the row/card is near the viewport.
  useEffect(() => {
    const el = ref.current;
    if (offline || !el || visible) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          obs.disconnect();
        }
      },
      { rootMargin: '200px' },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [offline, visible]);

  useEffect(() => {
    if (offline || !visible || !ownerId) return;
    let cancelled = false;
    let activeUrl: string | null = null;
    setState({ status: 'loading' });
    apiFetchDiagramThumbnailUrl(ownerId, diagramId, { version, shareCode: shareCode ?? null })
      .then((result) => {
        if (cancelled) {
          if (result) URL.revokeObjectURL(result.url);
          return;
        }
        if (!result) {
          setState({ status: 'broken' });
          return;
        }
        activeUrl = result.url;
        setState({ status: 'ready', src: result.url, backgroundColor: result.backgroundColor });
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'broken' });
      });
    return () => {
      cancelled = true;
      if (activeUrl) URL.revokeObjectURL(activeUrl);
    };
  }, [offline, visible, ownerId, diagramId, version, shareCode]);

  // Offline Mode (spec/76): a fixed illustration, no fetch, no snapshot.
  if (offline) {
    return (
      <span
        ref={ref}
        aria-hidden
        className={`flex shrink-0 items-center justify-center overflow-hidden bg-amber-50 dark:bg-amber-500/10 ${className}`}
      >
        <OfflineIllustration />
      </span>
    );
  }

  return (
    <span
      ref={ref}
      aria-hidden
      // Paint the box in the diagram's own background colour once the
      // snapshot loads, so the object-contain letterbox blends into the
      // preview instead of clashing with a generic slate fill (spec/67).
      style={
        state.status === 'ready' && state.backgroundColor
          ? { backgroundColor: state.backgroundColor }
          : undefined
      }
      className={`flex shrink-0 items-center justify-center overflow-hidden text-slate-400 dark:text-slate-500 ${className}`}
    >
      {state.status === 'ready' ? (
        // A blob URL, not a remote asset, so a plain <img> is correct
        // here (next/image can't load object URLs) — same as the canvas
        // ImageElementView.
        <img src={state.src} alt="" className="h-full w-full object-contain" />
      ) : (
        <ThumbnailGlyph />
      )}
    </span>
  );
}

// Fixed illustration for an offline diagram (spec/76): a "cloud off" mark,
// amber to match the Offline badge. h-full fits it to small row thumbs, but
// the height cap keeps it a modest centred glyph inside the big explorer
// cards — uncapped it scaled to fill the whole card, a giant heavy-stroked
// cloud that shouted over every neighbouring thumbnail.
function OfflineIllustration() {
  return (
    <svg
      viewBox="0 0 48 32"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className="h-full max-h-10 w-auto p-1 text-amber-500 dark:text-amber-400"
    >
      {/* A cloud with a slash through it — the universal "offline" mark. */}
      <path d="M16.5 22h12a4.8 4.8 0 0 0 .5-9.55 6.8 6.8 0 0 0-12.7-1.7A4.55 4.55 0 0 0 16.5 22Z" />
      <path d="M11.5 8.5l25 16.5" />
    </svg>
  );
}

// Placeholder shown while loading / when there's no snapshot. Inlined so
// the component carries no cross-folder icon dependency (it's imported
// from both app/ and components/ surfaces).
function ThumbnailGlyph() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="2" y="2" width="12" height="12" rx="2" />
      <path d="M5 6h6M5 9h4" />
    </svg>
  );
}
