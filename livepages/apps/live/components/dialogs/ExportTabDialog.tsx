import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { DialogCloseButton, DialogHeader } from '@livepages/ui';
import { Dialog } from '@/components/dialogs/Dialog';
import { FormatCard } from './FormatCard';
import { FormatIcon } from './export-format-icons';
import { TextExportPanel } from './TextExportPanel';
import { ImageExportPanel } from './ImageExportPanel';
import { LogoKitPanel } from './LogoKitPanel';
import {
  isLayerVisible,
  tabLayers,
  type LaidOutPage,
  type Tab,
  tabToJsonText,
  tabToMarkdownText,
} from '@livepages/document';
import {
  downloadBlob,
  exportTabAsPng,
  exportTabAsSvg,
  loadTabImages,
  renderTabToSvg,
} from '@/lib/export-tab';
import { exportTabAsPdf } from '@/lib/export-tab-pdf';
import {
  DEFAULT_PAGE_SCOPE,
  exportPageLabel,
  exportPages,
  sanitizeFilename,
  type PageScope,
} from '@/lib/export-pages';
import { ExportPagePicker } from './ExportPagePicker';
import { ensureIconCatalogs } from '@/lib/icon-registry';
import { track } from '@/lib/telemetry';
import { HelpArticleLink } from '@/components/primitives/HelpArticleLink';
import { useTabWindowExport } from './useTabWindowExport';

// The animated GIF's panel and its capture, loaded only when the GIF card opens
// (docs/specs/020-import-export/blueprints/animated-gif-export.md "Performance and limits").
const GifExportPanel = lazy(() => import('./gif/GifExportPanel'));

// Telemetry (docs/specs/017-telemetry/telemetry.md): map the internal format key to the public label
// the dashboard shows. 'file' is the portable .json export.
const EXPORT_LABEL: Record<Format, string> = {
  file: 'JSON',
  markdown: 'Markdown',
  png: 'PNG',
  svg: 'SVG',
  pdf: 'PDF',
  gif: 'GIF',
  'logo-kit': 'LogoKit',
};

// A text format taken (downloaded or copied) counts as the document's export.
function trackTextExport(format: TextFormat): void {
  track('Document', 'Exported', EXPORT_LABEL[format]);
}

// A Pages tab's pages exported (docs/specs/007-editor/pages-mode.md "Telemetry"): one
// page, or all of them.
const PAGE_EXPORT_LABEL: Record<ImageFormat, string> = {
  png: 'PagesPNG',
  svg: 'PagesSVG',
  pdf: 'PagesPDF',
};
const PAGES_EXPORT_LABEL: Record<ImageFormat, string> = {
  png: 'PagesPNGPages',
  svg: 'PagesSVGPages',
  pdf: 'PagesPDFPages',
};

// The formats Pages mode exports to (docs/specs/007-editor/pages-mode.md "Export"):
// its pages, and the tab itself as JSON. Diagram-tool formats are not offered.
const PAGES_FORMATS: readonly Format[] = ['pdf', 'png', 'svg', 'gif', 'file'];
// The page formats' card copy in Pages mode, which speaks of pages rather than the tab.
const PAGES_CARD_COPY: Partial<Record<Format, string>> = {
  pdf: 'Every page in one PDF, or a single page, ready to print or share.',
  png: 'A high-resolution image of a page, or a .zip with one per page.',
  svg: 'A scalable vector image of a page, or a .zip with one per page.',
};

type ExportTabDialogProps = {
  tab: Tab;
  documentName: string;
  onClose: () => void;
  // 'tab' (default) exports the whole active tab; 'selection' exports a
  // derived tab whose `elements` are just the multi-selection. The caller
  // does the element filtering and hands us the already-scoped `tab`; this
  // flag only drives the copy, filename suffix, and telemetry so the dialog
  // stays a dumb renderer over whatever Tab it's given.
  scope?: 'tab' | 'selection';
  // Owner / document / share context for fetching image bytes so PNG / SVG /
  // PDF embed image + avatar elements (the bitmaps live behind an
  // authenticated endpoint). Absent (e.g. no document id) → images export as
  // their placeholder, same as before.
  imageContext?: { ownerId: string; documentId: string; shareCode: string | null };
  // False while the Layers panel is off in Settings (docs/specs/007-editor/user-preferences.md): the
  // image options then leave out "Hidden layers", and hidden layers stay out
  // of the export as they stay off the canvas.
  offerHiddenLayers?: boolean;
  // Pages mode's pages (docs/specs/007-editor/pages-mode.md "Export"): PDF, PNG and
  // SVG export all pages or one chosen page, each exactly its sheet. Absent elsewhere.
  pages?: LaidOutPage[];
  // The document's tabs, for the tabs a tab window shows (docs/specs/009-elements/tab-window.md "Exports").
  documentTabs?: readonly Tab[];
  // Fetch tabs' content (a tab window's tab, which arrives only when opened or fetched); resolves to the failures.
  loadTabs?: (only: readonly string[]) => Promise<string[]>;
  // Empty the canvas selection: the GIF draws the canvas as it stands, rings and all.
  onClearSelection?: () => void;
};

const NO_DOCUMENT_TABS: readonly Tab[] = [];

// The format keys ('file' is the livepages .json): 'logo-kit' is a logo page's kit
// (docs/specs/007-editor/logo-pages.md "Export"), while the tab has one.
export type Format = 'markdown' | 'pdf' | 'png' | 'svg' | 'gif' | 'file' | 'logo-kit';

// The two text formats each open a view/edit/copy panel; the three image
// formats each open an options-and-download panel (docs/specs/010-palette/style-presets.md / 73).
type TextFormat = 'file' | 'markdown';
type ImageFormat = 'png' | 'svg' | 'pdf';
const isTextFormat = (f: Format): f is TextFormat => f === 'file' || f === 'markdown';

// Grid card copy, in display order: text formats first, then image formats.
const CARDS: { kind: Format; title: string; description: string }[] = [
  {
    kind: 'file',
    title: 'JSON',
    description: 'A livepages file. Copy it or save a .json to import back with full fidelity.',
  },
  {
    kind: 'markdown',
    title: 'Markdown',
    description: "A text outline of this tab's elements and connections. Copy it or save a .md.",
  },
  {
    kind: 'png',
    title: 'PNG',
    description: 'A high-resolution image of this tab, for slides or screenshots.',
  },
  {
    kind: 'svg',
    title: 'SVG',
    description: 'A scalable vector image, crisp at any size and editable in design tools.',
  },
  {
    kind: 'pdf',
    title: 'PDF',
    description: 'A single-page PDF of this tab, ready to print or share.',
  },
  {
    // Pages mode only (docs/specs/020-import-export/animated-gif-export.md "Where it is offered").
    kind: 'gif',
    title: 'GIF',
    description: 'An animated image of the pages, moving as they move on the canvas.',
  },
  {
    kind: 'logo-kit',
    title: 'Logo Kit',
    description: 'An SVG, PNGs from 16 to 1024 px and a favicon.ico, in one .zip.',
  },
];

// Per-text-format panel config: the blurb, the download button label + file
// extension + mime, and how to serialise the tab to the editable text.
const TEXT_PANELS: Record<
  TextFormat,
  {
    blurb: string;
    downloadLabel: string;
    ext: string;
    mime: string;
    getText: (tab: Tab) => string;
  }
> = {
  file: {
    blurb:
      "This tab as a livepages JSON export. Edit it here to copy a variant; your edits don't change the tab.",
    downloadLabel: 'Download .json',
    ext: 'livepages-tab.json',
    mime: 'application/json',
    getText: (tab) => tabToJsonText(tab),
  },
  markdown: {
    blurb:
      "This tab as a Markdown outline. Edit it here to copy a variant; your edits don't change the tab.",
    downloadLabel: 'Download .md',
    ext: 'md',
    mime: 'text/markdown',
    getText: (tab) => tabToMarkdownText(tab),
  },
};

// Welcome-style overlay: export options as a card grid. Text formats (JSON /
// Markdown) open an editable view/copy panel; image formats
// (PNG / SVG / PDF) open an options-and-download panel with the isometric +
// background-pattern toggles. The main grid stays clean — no format-specific
// options bleed onto it.
export function ExportTabDialog({
  tab,
  documentName,
  onClose,
  scope = 'tab',
  imageContext,
  offerHiddenLayers = true,
  pages,
  documentTabs,
  loadTabs,
  onClearSelection,
}: ExportTabDialogProps) {
  // null = the format grid; otherwise the picked format's sub-panel.
  const [active, setActive] = useState<Format | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Image / avatar bitmaps + icon catalogues loaded for the image-format
  // preview (docs/specs/010-palette/style-presets.md). Loaded once when an image format is picked, then
  // reused for both the live preview and the actual export so nothing is
  // fetched twice. `ready` gates the preview on the (async) load.
  const [previewImages, setPreviewImages] = useState<
    Awaited<ReturnType<typeof loadTabImages>> | undefined
  >(undefined);
  const [previewReady, setPreviewReady] = useState(false);
  // The page One page exports (and every preview shows), by its place in the row.
  const [pageIndex, setPageIndex] = useState(0);
  const page = pages?.[Math.min(pageIndex, pages.length - 1)];
  // All pages or One page, per format: each starts where DEFAULT_PAGE_SCOPE puts it.
  const [scopes, setScopes] = useState<Partial<Record<ImageFormat, PageScope>>>({});
  const scopeOf = (format: ImageFormat) => scopes[format] ?? DEFAULT_PAGE_SCOPE[format];
  // The Logo Kit card shows while the tab has a logo page (docs/specs/007-editor/logo-pages.md).
  const hasLogoPage = !!pages?.some((p) => p.kind === 'logo');
  const cards = pages
    ? [
        // A GIF animates the pages, so a Pages tab with none yet (First Page Choice) offers no GIF.
        ...PAGES_FORMATS.filter((kind) => kind !== 'gif' || pages.length > 0),
        ...(hasLogoPage ? (['logo-kit'] as const) : []),
      ].map((kind) => {
        const card = CARDS.find((c) => c.kind === kind)!;
        return { ...card, description: PAGES_CARD_COPY[kind] ?? card.description };
      })
    : // A selection has no pages, so no logo page and no GIF: never the Logo Kit or GIF.
      CARDS.filter((c) => c.kind !== 'logo-kit' && c.kind !== 'gif');

  const isSelection = scope === 'selection';
  const suffix = isSelection ? ' - selection' : '';
  const baseName = sanitizeFilename(
    `${documentName || 'document'} - ${tab.name || 'tab'}${suffix}`,
  );

  // A new image load (format picked, tab or image context changed) is not ready until it lands;
  // adjusted during render so the panel never shows the previous load as ready.
  const [loadInputs, setLoadInputs] = useState({ active, tab, imageContext });
  if (
    loadInputs.active !== active ||
    loadInputs.tab !== tab ||
    loadInputs.imageContext !== imageContext
  ) {
    setLoadInputs({ active, tab, imageContext });
    if (active && !isTextFormat(active)) setPreviewReady(false);
  }

  // When an image format is picked, load the icon catalogues + image bitmaps
  // so the preview (and export) renders the real glyphs, not placeholders.
  useEffect(() => {
    if (!active || isTextFormat(active) || active === 'gif') return;
    let cancelled = false;
    void (async () => {
      await ensureIconCatalogs();
      const images = imageContext ? await loadTabImages(tab, imageContext) : undefined;
      if (cancelled) return;
      setPreviewImages(images);
      setPreviewReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [active, tab, imageContext]);

  // The open text format's text, built once per format and tab change rather than on every render.
  // The panel reads it only as its starting text.
  const activeText = useMemo(
    () => (active && isTextFormat(active) ? TEXT_PANELS[active].getText(tab) : ''),
    [active, tab],
  );

  // A page's PNG and SVG leave a logo page's plain paper see-through (exportPages), so their
  // preview does too, over a checkerboard; a PDF page always has its paper.
  const seeThrough = !!page && (active === 'png' || active === 'svg');
  // Build the preview SVG for the current options — the same SVG the .svg
  // export produces, which PNG / PDF rasterise, so it faithfully previews all
  // three. Stable across renders so the panel can memoise on the toggles.
  // Each tab window's tab, fetched and drawn once an image format is picked (docs/specs/009-elements/tab-window.md
  // "Exports").
  const windows = useTabWindowExport({
    tab,
    tabs: documentTabs ?? NO_DOCUMENT_TABS,
    loadTabs,
    imageContext,
    active: !!active && !isTextFormat(active),
  });
  const windowOpts = useMemo(
    () =>
      windows.resolveTabWindow
        ? {
            resolveTabWindow: windows.resolveTabWindow,
            tabWindowFontIds: windows.tabWindowFontIds ?? [],
          }
        : {},
    [windows],
  );
  const renderPreview = useCallback(
    (opts: { isometric: boolean; pattern: boolean; hiddenLayers: boolean }) =>
      renderTabToSvg(tab, {
        ...opts,
        images: previewImages,
        page,
        ...(seeThrough ? { transparentPaper: true } : {}),
        ...windowOpts,
      }),
    [tab, previewImages, page, seeThrough, windowOpts],
  );

  // Render + download an image format with the chosen options (docs/specs/010-palette/style-presets.md).
  const runImageExport = async (
    format: ImageFormat,
    opts: { isometric: boolean; pattern: boolean; hiddenLayers: boolean },
  ) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      // Reuse the images already loaded for the preview when they're ready;
      // otherwise load them now (icon glyphs come from the async catalogues).
      await ensureIconCatalogs();
      const images = previewReady
        ? previewImages
        : imageContext
          ? await loadTabImages(tab, imageContext)
          : undefined;
      const renderOpts = { ...opts, images, page, ...windowOpts };
      if (pages && page) {
        const pageScope = scopeOf(format);
        const { blob, ext } = await exportPages({
          tab,
          pages,
          page,
          scope: pageScope,
          format,
          opts: renderOpts,
        });
        const name =
          pageScope === 'all'
            ? baseName
            : `${baseName} - ${sanitizeFilename(exportPageLabel(page, pages.length))}`;
        downloadBlob(blob, `${name}.${ext}`);
        track(
          'Document',
          'Exported',
          pageScope === 'all' ? PAGES_EXPORT_LABEL[format] : PAGE_EXPORT_LABEL[format],
        );
        onClose();
        return;
      }
      if (format === 'png') {
        downloadBlob(await exportTabAsPng(tab, renderOpts), `${baseName}.png`);
      } else if (format === 'svg') {
        downloadBlob(await exportTabAsSvg(tab, renderOpts), `${baseName}.svg`);
      } else {
        downloadBlob(await exportTabAsPdf(tab, renderOpts), `${baseName}.pdf`);
      }
      track('Document', 'Exported', EXPORT_LABEL[format]);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Export failed.');
      setBusy(false);
    }
  };

  const activeCard = active ? CARDS.find((c) => c.kind === active) : null;
  const subtitle = activeCard
    ? active === 'logo-kit'
      ? 'Download a logo page as an SVG, PNGs and a favicon.'
      : active === 'gif'
        ? 'Set how the pages play, then download the GIF.'
        : isTextFormat(active!)
          ? `Copy this tab as ${activeCard.title}, or download a file.`
          : `Set the image options for ${activeCard.title}, then download.`
    : isSelection
      ? 'Pick a format to export the selected elements.'
      : pages
        ? 'Pick a format to export the pages.'
        : 'Pick a format to export the current tab.';

  return (
    <Dialog
      open
      onClose={onClose}
      ariaLabel={isSelection ? 'Export Selection' : 'Export Tab'}
      size="xl"
      className="max-h-[90vh]"
    >
      <DialogHeader title={isSelection ? 'Export Selection' : 'Export Tab'} subtitle={subtitle}>
        <HelpArticleLink article="exportingDiagrams" size="md" />
        <DialogCloseButton onClick={onClose} />
      </DialogHeader>
      <div className="flex-1 overflow-y-auto px-6 py-5">
        {active && isTextFormat(active) ? (
          <TextExportPanel
            formatTitle={CARDS.find((c) => c.kind === active)?.title ?? ''}
            initialText={activeText}
            blurb={TEXT_PANELS[active].blurb}
            downloadLabel={TEXT_PANELS[active].downloadLabel}
            onDownload={(text) => {
              const cfg = TEXT_PANELS[active];
              downloadBlob(new Blob([text], { type: cfg.mime }), `${baseName}.${cfg.ext}`);
              trackTextExport(active);
            }}
            onCopied={() => trackTextExport(active)}
            onBack={() => setActive(null)}
          />
        ) : active === 'logo-kit' && pages ? (
          <LogoKitPanel
            tab={tab}
            pages={pages}
            documentName={documentName}
            images={previewImages}
            imagesReady={previewReady}
            imageContext={imageContext}
            onDone={onClose}
            onBack={() => setActive(null)}
          />
        ) : active === 'gif' && pages && page ? (
          <Suspense
            fallback={
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Preparing the GIF options…
              </p>
            }
          >
            <GifExportPanel
              tab={tab}
              pages={pages}
              page={page}
              baseName={baseName}
              onPick={setPageIndex}
              onDone={onClose}
              onBack={() => setActive(null)}
              onClearSelection={onClearSelection}
            />
          </Suspense>
        ) : active ? (
          <ImageExportPanel
            pagePicker={
              pages && page ? (
                <ExportPagePicker
                  pages={pages}
                  page={page}
                  scope={scopeOf(active as ImageFormat)}
                  format={active as ImageFormat}
                  onScope={(next) => setScopes((s) => ({ ...s, [active as ImageFormat]: next }))}
                  onPick={setPageIndex}
                />
              ) : undefined
            }
            label={activeCard!.title}
            // A page: no canvas to tilt or pattern.
            pageExport={!!pages}
            // Held until each tab window's tab is drawn, so a download never misses one.
            busy={busy || !windows.ready}
            error={error}
            checkerboard={seeThrough && page?.kind === 'logo'}
            // Pages mode has no Layers, so no "Hidden layers" option: hidden layers stay
            // out, as they stay off its canvas.
            hasHiddenLayers={
              !pages && offerHiddenLayers && tabLayers(tab.layers).some((l) => !isLayerVisible(l))
            }
            renderPreview={renderPreview}
            previewReady={previewReady && windows.ready}
            onExport={(opts) => void runImageExport(active as ImageFormat, opts)}
            onBack={() => {
              setError(null);
              setActive(null);
            }}
          />
        ) : (
          <div
            // Two columns on a phone: three left each card about 110px wide, its description wrapping to eight lines.
            className="grid grid-cols-2 gap-3 sm:grid-cols-3"
          >
            {cards.map((c) => (
              <FormatCard
                key={c.kind}
                title={c.title}
                description={c.description}
                onClick={() => {
                  setError(null);
                  setActive(c.kind);
                }}
              >
                <FormatIcon kind={c.kind} />
              </FormatCard>
            ))}
          </div>
        )}
      </div>
    </Dialog>
  );
}
