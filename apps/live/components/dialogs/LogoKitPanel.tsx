'use client';

// The Export dialog's Logo Kit panel (docs/specs/007-editor/logo-pages.md "Export"): which logo
// page (when the tab has several), the page as it will export (see-through paper shown over a
// checkerboard), what the kit holds, and the download. It owns the kit's making; the dialog hands
// it the images it has loaded for previews.
import { useState } from 'react';
import type { LaidOutPage, Tab } from '@livediagram/document';
import { Button } from '@livediagram/ui';
import { BackBar } from '@/components/primitives/BackBar';
import { exportLogoKit, LOGO_KIT_PNG_SIZES, logoKitFileName } from '@/lib/export-logo-kit';
import { downloadBlob, loadTabImages, renderTabToSvg } from '@/lib/export-tab';
import { ensureIconCatalogs } from '@/lib/icon-registry';
import { track } from '@/lib/telemetry';

// A checkerboard under the preview, so see-through paper reads as see-through.
const CHECKER = 'repeating-conic-gradient(rgb(226 232 240) 0% 25%, white 0% 50%) 50% / 16px 16px';

type Images = Awaited<ReturnType<typeof loadTabImages>>;

export function LogoKitPanel({
  tab,
  pages,
  documentName,
  images,
  imagesReady,
  imageContext,
  onDone,
  onBack,
}: {
  tab: Tab;
  // The tab's pages, every kind: the kit is of one of its logo pages.
  pages: readonly LaidOutPage[];
  documentName: string;
  // The images the dialog loaded for its previews, once ready.
  images: Images | undefined;
  imagesReady: boolean;
  imageContext?: Parameters<typeof loadTabImages>[1];
  onDone: () => void;
  onBack: () => void;
}) {
  const logoPages = pages.filter((p) => p.kind === 'logo');
  const [pageId, setPageId] = useState<string | null>(null);
  const page = logoPages.find((p) => p.id === pageId) ?? logoPages[0];
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Drawn on each render of the panel (a page draws in under a millisecond), which re-renders only
  // as its own choice, state or images change.
  const previewSvg =
    page && imagesReady ? renderTabToSvg(tab, { images, page, transparentPaper: true }) : null;
  if (!page) return null;

  const download = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await ensureIconCatalogs();
      const loaded = imagesReady
        ? images
        : imageContext
          ? await loadTabImages(tab, imageContext)
          : undefined;
      const blob = await exportLogoKit(tab, page, { images: loaded });
      downloadBlob(blob, logoKitFileName(documentName, page, pages.length));
      track('Document', 'Exported', 'LogoKit');
      onDone();
    } catch (e) {
      console.warn('[logo-kit] export failed', e);
      setError(e instanceof Error ? e.message : 'Export failed.');
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <BackBar label="All formats" current="Logo Kit" onClick={onBack} disabled={busy} />
      <p className="text-sm text-slate-600 dark:text-slate-300">
        An SVG, PNGs at {LOGO_KIT_PNG_SIZES[0]} to{' '}
        {LOGO_KIT_PNG_SIZES[LOGO_KIT_PNG_SIZES.length - 1]} px and a favicon.ico, in one .zip. Plain
        paper stays see-through.
      </p>
      {logoPages.length > 1 ? (
        <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
          Logo page
          <select
            value={page.id}
            onChange={(e) => setPageId(e.target.value)}
            className="rounded-md border border-slate-200 bg-white px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-900"
          >
            {logoPages.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name ?? `Page ${p.index + 1}`}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <div
        className="mx-auto flex h-56 w-56 items-center justify-center overflow-hidden rounded-lg ring-1 ring-slate-200 dark:ring-slate-700"
        style={{ background: CHECKER }}
      >
        {previewSvg ? (
          <img
            src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(previewSvg)}`}
            alt="The logo as it will export"
            className="h-full w-full object-contain"
          />
        ) : (
          <span className="text-xs text-slate-500">Preparing the preview…</span>
        )}
      </div>
      {error ? (
        <p role="alert" className="text-sm text-rose-600 dark:text-rose-400">
          {error}
        </p>
      ) : null}
      <div className="flex justify-end">
        <Button size="sm" onClick={() => void download()} disabled={busy}>
          {busy ? 'Making the kit…' : 'Download .zip'}
        </Button>
      </div>
    </div>
  );
}
