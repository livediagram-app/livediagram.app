'use client';

// A version's pages, drawn as the export draws them (docs/specs/006-document/version-history.md "Opening a version"),
// with what changed since outlined over them: red for an element the tab no longer has, amber for one that differs.
// A picture only: nothing on it can be edited. The pages' markup is our own renderer's, sanitised before it is
// injected; the outlines are React's own SVG.
import { useEffect, useMemo, useState } from 'react';
import {
  elementBounds,
  pagesWithWriting,
  renderPageToSvg,
  type LaidOutPage,
  type Tab,
} from '@livedocuments/document';
import { htmlProps } from '@livedocuments/ui';
import { sanitizedHtml } from '@liveworkspace/trusted-types/sanitize';
import {
  ensureIconCatalogs,
  resolveIconArtLoaded,
  resolveStickerArtLoaded,
} from '@liveworkspace/workbench/lib/icon-registry';
import { loadTabImages, type ExportImageMap } from '@/lib/export-tab-images';
import { ensureMapGeometryFor } from '@/lib/map-geometry-loader';

export type ChangeMarks = { removed: ReadonlySet<string>; changed: ReadonlySet<string> };

type Mark = { id: string; kind: 'removed' | 'changed'; x: number; y: number; w: number; h: number };

// The outline's inset outside an element's box, in page units, so a hairline box still shows its ring.
const MARK_PAD = 6;

export function VersionPreview({
  tab,
  marks,
  imageContext,
  label,
}: {
  tab: Tab;
  marks: ChangeMarks | null;
  imageContext: { ownerId: string; documentId: string; shareCode: string | null };
  // What the pages are, for a screen reader: "Version from today at 9:30".
  label: string;
}) {
  const art = useVersionArt(tab, imageContext);
  const laid = useMemo(() => pagesWithWriting(tab), [tab]);
  // Drawn once, when the icons and pictures have arrived: a page drawn before would show their placeholders, then
  // be drawn again.
  const drawn = useMemo(() => {
    if (!art) return null;
    const images = art.images;
    const resolveImageHref = images ? (id: string) => images.get(id)?.href : undefined;
    return laid.pages.map((page) => ({
      page,
      svg: renderPageToSvg(tab, page, {
        resolveImageHref,
        resolveIconArt: resolveIconArtLoaded,
        resolveStickerArt: resolveStickerArtLoaded,
        writingSvg: laid.writing,
      }),
    }));
  }, [tab, laid, art]);
  const marksByPage = useMemo(() => pageMarks(tab, laid.pages, marks), [tab, laid, marks]);

  return (
    <div
      role="group"
      aria-label={label}
      aria-busy={drawn === null}
      className="mx-auto flex w-full max-w-3xl flex-col gap-6"
    >
      {(drawn ?? laid.pages.map((page) => ({ page, svg: null }))).map(({ page, svg }) => {
        const pageMarksHere = marksByPage.get(page.id) ?? [];
        const r = page.rect;
        return (
          <figure
            key={page.id}
            className="relative overflow-hidden rounded-md bg-white shadow-sm ring-1 ring-slate-900/10 [content-visibility:auto] dark:ring-white/10"
            style={{ aspectRatio: `${r.width} / ${r.height}` }}
          >
            {svg === null ? (
              <div
                aria-hidden
                className="absolute inset-0 animate-pulse bg-slate-100 dark:bg-slate-800"
              />
            ) : (
              <div
                aria-hidden
                className="absolute inset-0 [&>svg]:h-full [&>svg]:w-full"
                {...htmlProps(sanitizedHtml(svg))}
              />
            )}
            {pageMarksHere.length > 0 ? (
              <svg
                aria-hidden
                className="pointer-events-none absolute inset-0 h-full w-full"
                viewBox={`${r.x} ${r.y} ${r.width} ${r.height}`}
                preserveAspectRatio="none"
              >
                {pageMarksHere.map((m) => (
                  <rect
                    key={m.id}
                    data-mark={m.kind}
                    x={m.x}
                    y={m.y}
                    width={m.w}
                    height={m.h}
                    rx={6}
                    fill="none"
                    vectorEffect="non-scaling-stroke"
                    strokeWidth={2}
                    strokeDasharray={m.kind === 'removed' ? '6 4' : undefined}
                    className={
                      m.kind === 'removed'
                        ? 'stroke-red-500 dark:stroke-red-400'
                        : 'stroke-amber-500 dark:stroke-amber-400'
                    }
                  />
                ))}
              </svg>
            ) : null}
            <figcaption className="sr-only">
              Page {page.index + 1}
              {pageMarksHere.length ? `, ${pageMarksHere.length} changed since` : ''}
            </figcaption>
          </figure>
        );
      })}
    </div>
  );
}

// The icons, a map's land and the pictures the version draws, fetched once per version shown.
function useVersionArt(
  tab: Tab,
  imageContext: { ownerId: string; documentId: string; shareCode: string | null },
): { tab: Tab; images?: ExportImageMap } | null {
  const [art, setArt] = useState<{ tab: Tab; images?: ExportImageMap } | null>(null);
  const { ownerId, documentId, shareCode } = imageContext;
  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        await ensureIconCatalogs();
        await ensureMapGeometryFor(tab.elements);
        const images = await loadTabImages(tab, { ownerId, documentId, shareCode });
        if (live) setArt({ tab, images });
      } catch (err) {
        console.warn('[versions] art-failed', { error: String(err) });
        if (live) setArt({ tab });
      }
    })();
    return () => {
      live = false;
    };
  }, [tab, ownerId, documentId, shareCode]);
  // The state itself, so the drawing memoises on it: null until this version's art has arrived.
  return art?.tab === tab ? art : null;
}

// Each page's outlines: the marked elements whose box reaches it.
function pageMarks(
  tab: Tab,
  pages: readonly LaidOutPage[],
  marks: ChangeMarks | null,
): Map<string, Mark[]> {
  const out = new Map<string, Mark[]>();
  if (!marks || (marks.removed.size === 0 && marks.changed.size === 0)) return out;
  const boxes: Mark[] = [];
  for (const el of tab.elements) {
    const kind = marks.removed.has(el.id) ? 'removed' : marks.changed.has(el.id) ? 'changed' : null;
    if (!kind) continue;
    const b = elementBounds(el, tab.elements);
    boxes.push({
      id: el.id,
      kind,
      x: b.x - MARK_PAD,
      y: b.y - MARK_PAD,
      w: b.width + MARK_PAD * 2,
      h: b.height + MARK_PAD * 2,
    });
  }
  for (const page of pages) {
    const r = page.rect;
    const here = boxes.filter(
      (m) => m.x < r.x + r.width && m.x + m.w > r.x && m.y < r.y + r.height && m.y + m.h > r.y,
    );
    if (here.length) out.set(page.id, here);
  }
  return out;
}
