import { lazy, Suspense, useCallback, useId, useMemo, useState } from 'react';
import { ensureMapGeometryFor } from '@/lib/map-geometry-loader';
import {
  exportTabDialogFrame,
  useExportPreviewImages,
} from '@liveworkspace/workbench/components/dialogs/export-tab-dialog';
import { FormatIcon } from './export-format-icons';
import { TextExportPanel } from '@liveworkspace/workbench/components/dialogs/TextExportPanel';
import { ImageExportPanel } from './ImageExportPanel';
import {
  articleLeftOutNote,
  articleTabMarkdown,
  type Deck,
  type LaidOutPage,
  type Tab,
  tabWindowNames,
} from '@liveknowledge/document';
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
  type PageScope,
} from '@/lib/export-pages';
import { sanitizeFilename } from '@liveworkspace/model-core/file-name';
import { ExportPagePicker } from './ExportPagePicker';
import { PrintPanel } from './PrintPanel';
import { printDocumentHtml, printSheets, printTabCount, type PrintScope } from '@/lib/print-pages';
import { printInFrame } from '@/lib/print-frame';
import { currentPageIdNow } from '@/lib/current-page-kind';
import { OFFICE_CARDS, OFFICE_SUBTITLE, officeFormatFor } from '@/lib/office-export/summary';
import { ensureIconCatalogs } from '@liveworkspace/workbench/lib/icon-registry';
import { track } from '@/lib/telemetry';
import { HelpArticleLink } from '@/components/primitives/HelpArticleLink';
import {
  ARTICLE_MARKDOWN_BLURB,
  CARDS,
  isOfficeFormat,
  isTextFormat,
  PAGES_CARD_COPY,
  PAGES_FORMATS,
  TEXT_PANELS,
  type Format,
  type ImageFormat,
  type TextFormat,
} from './export-formats';

export type { Format };

// The image preview's load: the icon catalogues, a map's land (docs/specs/009-elements/map.md, so the preview shows
// it rather than the placeholder), then the image and avatar bitmaps when there is a context.
const loadPreviewImages = async (tab: Tab, imageContext: ExportTabDialogProps['imageContext']) => {
  await ensureIconCatalogs();
  await ensureMapGeometryFor(tab.elements);
  return imageContext ? await loadTabImages(tab, imageContext) : undefined;
};

// Telemetry (docs/specs/017-telemetry/telemetry.md): map the internal format key to the public label
// the dashboard shows. 'file' is the portable .json export.
const EXPORT_LABEL: Record<Exclude<Format, 'print'>, string> = {
  file: 'JSON',
  markdown: 'Markdown',
  png: 'PNG',
  svg: 'SVG',
  pdf: 'PDF',
  pptx: 'PagesPPTX',
  docx: 'PagesDOCX',
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

// The PowerPoint and Word panel and its writers, loaded only when that card opens
// (docs/specs/020-import-export/office-export.md "Performance").
const OfficeExportPanel = lazy(() => import('./office/OfficeExportPanel'));

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
  // Pages mode's pages (docs/specs/007-editor/pages-mode.md "Export"): PDF, PNG and
  // SVG export all pages or one chosen page, each exactly its sheet. Absent elsewhere.
  pages?: LaidOutPage[];
  // The document's tabs, for the name a stored tab window's frame shows (docs/specs/009-elements/tab-window.md).
  documentTabs?: readonly Tab[];
  // The Slide Deck, for the PowerPoint export's speaker notes and hidden slides
  // (docs/specs/020-import-export/office-export.md).
  deck?: Deck;
};

const NO_DOCUMENT_TABS: readonly Tab[] = [];

// Welcome-style overlay: export options as a card grid. Text formats (JSON /
// Markdown) open an editable view/copy panel; image formats
// (PNG / SVG / PDF) open an options-and-download panel with the
// background-pattern toggle. The main grid stays clean — no format-specific
// options bleed onto it.
export function ExportTabDialog({
  tab,
  documentName,
  onClose,
  scope = 'tab',
  imageContext,
  pages,
  documentTabs,
  deck,
}: ExportTabDialogProps) {
  const titleId = useId();
  // null = the format grid; otherwise the picked format's sub-panel.
  const [active, setActive] = useState<Format | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The page One page exports (and every preview shows), by its place in the row.
  const [pageIndex, setPageIndex] = useState(0);
  const page = pages?.[Math.min(pageIndex, pages.length - 1)];
  // All pages or One page, per format: each starts where DEFAULT_PAGE_SCOPE puts it.
  const [scopes, setScopes] = useState<Partial<Record<ImageFormat, PageScope>>>({});
  const scopeOf = (format: ImageFormat) => scopes[format] ?? DEFAULT_PAGE_SCOPE[format];
  const officeFormat = officeFormatFor(pages);
  // Print's Current Page or Whole Document (docs/specs/020-import-export/print.md "The panel").
  const [printScope, setPrintScope] = useState<PrintScope>('page');
  const cards = pages
    ? // PowerPoint for a deck and Word for an article, neither for any other kind.
      PAGES_FORMATS.filter(
        (kind) =>
          (!isOfficeFormat(kind) || kind === officeFormat) &&
          // Markdown is an article's writing (docs/specs/020-import-export/markdown-import.md "Markdown export").
          (kind !== 'markdown' || officeFormat === 'docx'),
      ).map((kind) => {
        const card = CARDS.find((c) => c.kind === kind)!;
        return { ...card, description: PAGES_CARD_COPY[kind] ?? card.description };
      })
    : // A selection has no pages, so no Print, PowerPoint or Word.
      CARDS.filter((c) => c.kind !== 'print' && !isOfficeFormat(c.kind));

  const isSelection = scope === 'selection';
  const suffix = isSelection ? ' - selection' : '';
  // A name of nothing safe ("?") downloads as "document", never a bare ".png".
  const baseName = sanitizeFilename(
    `${documentName || 'document'} - ${tab.name || 'tab'}${suffix}`,
    'document',
  );

  // Image / avatar bitmaps + icon catalogues for the image-format preview, loaded once an image format is picked
  // and reused by the export (export-tab-dialog.tsx).
  const { previewImages, previewReady } = useExportPreviewImages({
    active,
    tab,
    imageContext,
    isTextFormat,
    load: loadPreviewImages,
  });

  // The open text format's text, built once per format and tab change rather than on every render.
  // The panel reads it only as its starting text.
  // An article tab's Markdown is its writing, with a note naming what it leaves out; any other text is the outline or JSON.
  const articleMarkdown = useMemo(
    () =>
      active === 'markdown' && pages && officeFormat === 'docx' ? articleTabMarkdown(tab) : null,
    [active, pages, officeFormat, tab],
  );
  const activeText = useMemo(
    () =>
      articleMarkdown
        ? articleMarkdown.markdown
        : active && isTextFormat(active)
          ? TEXT_PANELS[active].getText(tab)
          : '',
    [active, tab, articleMarkdown],
  );

  // Build the preview SVG for the current options — the same SVG the .svg
  // export produces, which PNG / PDF rasterise, so it faithfully previews all
  // three. Stable across renders so the panel can memoise on the toggles.
  // A stored tab window draws as its frame named for its tab, as on the canvas (docs/specs/009-elements/tab-window.md).
  const resolveTabWindow = useMemo(
    () => tabWindowNames(documentTabs ?? NO_DOCUMENT_TABS),
    [documentTabs],
  );
  const renderPreview = useCallback(
    (opts: { pattern: boolean; hiddenLayers: boolean }) =>
      renderTabToSvg(tab, {
        ...opts,
        images: previewImages,
        page,
        resolveTabWindow,
      }),
    [tab, previewImages, page, resolveTabWindow],
  );
  // The sheets Print would send, worked out only while its panel is open.
  const sheets = useMemo(
    () =>
      active === 'print' && pages && page
        ? printSheets(printScope, { tab, pages, page }, documentTabs ?? NO_DOCUMENT_TABS)
        : [],
    [active, printScope, tab, pages, page, documentTabs],
  );

  // The PowerPoint and Word preview: the first page, as the image formats draw it.
  const firstPage = pages?.[0];
  const officePreview = useMemo(
    () =>
      isOfficeFormat(active) && firstPage && previewReady
        ? renderTabToSvg(tab, {
            pattern: true,
            hiddenLayers: false,
            images: previewImages,
            page: firstPage,
            resolveTabWindow,
          })
        : '',
    [active, firstPage, previewReady, tab, previewImages, resolveTabWindow],
  );
  const officeRender = useMemo(
    () => ({ ...(previewImages ? { images: previewImages } : {}), resolveTabWindow }),
    [previewImages, resolveTabWindow],
  );

  // Render + download an image format with the chosen options (docs/specs/010-palette/style-presets.md).
  const runImageExport = async (
    format: ImageFormat,
    opts: { pattern: boolean; hiddenLayers: boolean },
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
      const renderOpts = { ...opts, images, page, resolveTabWindow };
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
            : `${baseName} - ${sanitizeFilename(exportPageLabel(page, pages.length), 'page')}`;
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

  // Print the scope's sheets (docs/specs/020-import-export/print.md): each drawn as the PDF export draws it, its
  // tab's images loaded once (this tab's reused from the preview), into the print frame.
  const runPrint = async () => {
    if (busy || sheets.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      await ensureIconCatalogs();
      const imagesByTab = new Map<string, Awaited<ReturnType<typeof loadTabImages>> | undefined>();
      for (const { tab: t } of sheets) {
        if (imagesByTab.has(t.id)) continue;
        imagesByTab.set(
          t.id,
          t === tab && previewReady
            ? previewImages
            : imageContext
              ? await loadTabImages(t, imageContext)
              : undefined,
        );
      }
      const html = printDocumentHtml(sheets, (sheet) =>
        renderTabToSvg(sheet.tab, {
          images: imagesByTab.get(sheet.tab.id),
          page: sheet.page,
          resolveTabWindow,
        }),
      );
      await printInFrame(html);
      track('UI', 'Used', printScope === 'document' ? 'PrintDocument' : 'PrintPage');
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Printing failed.');
      setBusy(false);
    }
  };

  const activeCard = active ? CARDS.find((c) => c.kind === active) : null;
  const subtitle = activeCard
    ? active === 'print'
      ? 'Print the current page or the whole knowledgebase.'
      : isOfficeFormat(active)
        ? OFFICE_SUBTITLE[active]
        : isTextFormat(active!)
          ? `Copy this tab as ${activeCard.title}, or download a file.`
          : `Set the image options for ${activeCard.title}, then download.`
    : isSelection
      ? 'Pick a format to export the selected elements.'
      : pages
        ? 'Pick a format to export the pages.'
        : 'Pick a format to export the current page.';

  return exportTabDialogFrame({
    isSelection,
    titleId,
    subtitle,
    help: <HelpArticleLink article="exportingDiagrams" size="md" />,
    onClose,
    panel:
      active && isTextFormat(active) ? (
        <TextExportPanel
          formatTitle={CARDS.find((c) => c.kind === active)?.title ?? ''}
          initialText={activeText}
          blurb={articleMarkdown ? ARTICLE_MARKDOWN_BLURB : TEXT_PANELS[active].blurb}
          note={articleMarkdown ? articleLeftOutNote(articleMarkdown.leftOut) : ''}
          downloadLabel={TEXT_PANELS[active].downloadLabel}
          onDownload={(text) => {
            const cfg = TEXT_PANELS[active];
            downloadBlob(new Blob([text], { type: cfg.mime }), `${baseName}.${cfg.ext}`);
            trackTextExport(active);
          }}
          onCopied={() => trackTextExport(active)}
          onBack={() => setActive(null)}
        />
      ) : isOfficeFormat(active) && pages && pages.length > 0 ? (
        <Suspense
          fallback={
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Preparing the {OFFICE_CARDS[active].title} export…
            </p>
          }
        >
          <OfficeExportPanel
            format={active}
            tab={tab}
            pages={pages}
            {...(deck ? { deck } : {})}
            title={documentName || 'document'}
            baseName={baseName}
            render={officeRender}
            previewSvg={officePreview}
            ready={previewReady}
            onDone={onClose}
            onBack={() => setActive(null)}
          />
        </Suspense>
      ) : active === 'print' && pages && page ? (
        <PrintPanel
          pages={pages}
          page={page}
          scope={printScope}
          counts={{ pages: sheets.length, tabs: printTabCount(sheets) }}
          busy={busy}
          error={error}
          onScope={setPrintScope}
          onPick={setPageIndex}
          onPrint={() => void runPrint()}
          onBack={() => {
            setError(null);
            setActive(null);
          }}
        />
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
          busy={busy}
          error={error}
          renderPreview={renderPreview}
          previewReady={previewReady}
          onExport={(opts) => void runImageExport(active as ImageFormat, opts)}
          onBack={() => {
            setError(null);
            setActive(null);
          }}
        />
      ) : null,
    cards,
    onPick: (kind) => {
      setError(null);
      // Print starts on the page in view (docs/specs/020-import-export/print.md "The panel").
      if (kind === 'print' && pages) {
        const inView = pages.findIndex((p) => p.id === currentPageIdNow());
        if (inView >= 0) setPageIndex(inView);
      }
      setActive(kind);
    },
    FormatIcon,
  });
}
