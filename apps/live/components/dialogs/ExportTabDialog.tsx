import { useCallback, useEffect, useState } from 'react';
import { DialogCloseButton } from '@/components/dialogs/DialogCloseButton';
import { Dialog } from '@/components/dialogs/Dialog';
import { FormatIcon } from './export-format-icons';
import { TextExportPanel } from './TextExportPanel';
import { ImageExportPanel } from './ImageExportPanel';
import { isLayerVisible, tabLayers, mermaidFromTab, type Tab } from '@livediagram/diagram';
import {
  downloadBlob,
  exportTabAsPng,
  exportTabAsSvg,
  loadTabImages,
  renderTabToSvg,
  tabToJsonText,
  tabToMarkdownText,
} from '@/lib/export-tab';
import { exportTabAsPdf } from '@/lib/export-tab-pdf';
import { tabToExcalidrawText } from '@/lib/excalidraw-export';
import { ensureIconCatalogs } from '@/lib/icon-registry';
import { track } from '@/lib/telemetry';
import { HelpArticleLink } from '@/components/primitives/HelpArticleLink';

// Telemetry (spec/22): map the internal format key to the public label
// the dashboard shows. 'file' is the portable .json export.
const EXPORT_LABEL: Record<Format, string> = {
  file: 'JSON',
  mermaid: 'Mermaid',
  markdown: 'Markdown',
  excalidraw: 'Excalidraw',
  png: 'PNG',
  svg: 'SVG',
  pdf: 'PDF',
};

type ExportTabDialogProps = {
  tab: Tab;
  diagramName: string;
  onClose: () => void;
  // 'tab' (default) exports the whole active tab; 'selection' exports a
  // derived tab whose `elements` are just the multi-selection. The caller
  // does the element filtering and hands us the already-scoped `tab`; this
  // flag only drives the copy, filename suffix, and telemetry so the dialog
  // stays a dumb renderer over whatever Tab it's given.
  scope?: 'tab' | 'selection';
  // Owner / diagram / share context for fetching image bytes so PNG / SVG /
  // PDF embed image + avatar elements (the bitmaps live behind an
  // authenticated endpoint). Absent (e.g. no diagram id) → images export as
  // their placeholder, same as before.
  imageContext?: { ownerId: string; diagramId: string; shareCode: string | null };
};

export type Format = 'markdown' | 'mermaid' | 'excalidraw' | 'pdf' | 'png' | 'svg' | 'file';

// The four text formats each open a view/edit/copy panel; the three image
// formats each open an options-and-download panel (spec/48 / 73).
type TextFormat = 'file' | 'mermaid' | 'markdown' | 'excalidraw';
type ImageFormat = 'png' | 'svg' | 'pdf';
const isTextFormat = (f: Format): f is TextFormat =>
  f === 'file' || f === 'mermaid' || f === 'markdown' || f === 'excalidraw';

// Grid card copy, in display order: text formats first, then image formats.
const CARDS: { kind: Format; title: string; description: string }[] = [
  {
    kind: 'file',
    title: 'JSON',
    description: 'A livediagram file. Copy it or save a .json to import back with full fidelity.',
  },
  {
    kind: 'mermaid',
    title: 'Mermaid',
    description:
      'This tab as Mermaid flowchart text. Keeps every connection. Copy it or save a .mmd.',
  },
  {
    kind: 'markdown',
    title: 'Markdown',
    description: "A text outline of this tab's elements and connections. Copy it or save a .md.",
  },
  {
    kind: 'excalidraw',
    title: 'Excalidraw',
    description:
      'An .excalidraw scene to open at excalidraw.com. Rich shapes simplify to labelled boxes.',
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
];

// Per-text-format panel config: the blurb, the download button label + file
// extension + mime, and how to serialise the tab to the editable text.
const TEXT_PANELS: Record<
  TextFormat,
  { blurb: string; downloadLabel: string; ext: string; mime: string; getText: (tab: Tab) => string }
> = {
  file: {
    blurb:
      "This tab as a livediagram JSON export. Edit it here to copy a variant — your edits don't change the tab.",
    downloadLabel: 'Download .json',
    ext: 'livediagram-tab.json',
    mime: 'application/json',
    getText: tabToJsonText,
  },
  mermaid: {
    blurb:
      "This tab as a Mermaid flowchart. Edit it here to copy a variant — your edits don't change the tab.",
    downloadLabel: 'Download .mmd',
    ext: 'mmd',
    mime: 'text/plain',
    getText: mermaidFromTab,
  },
  markdown: {
    blurb:
      "This tab as a Markdown outline. Edit it here to copy a variant — your edits don't change the tab.",
    downloadLabel: 'Download .md',
    ext: 'md',
    mime: 'text/markdown',
    getText: tabToMarkdownText,
  },
  excalidraw: {
    blurb:
      'This tab as an Excalidraw scene: shapes Excalidraw lacks become labelled boxes. Edit it here to copy a variant.',
    downloadLabel: 'Download .excalidraw',
    ext: 'excalidraw',
    mime: 'application/json',
    getText: tabToExcalidrawText,
  },
};

// Welcome-style overlay: export options as a card grid. Text formats (JSON /
// Mermaid / Markdown) open an editable view/copy panel; image formats
// (PNG / SVG / PDF) open an options-and-download panel with the isometric +
// background-pattern toggles. The main grid stays clean — no format-specific
// options bleed onto it.
export function ExportTabDialog({
  tab,
  diagramName,
  onClose,
  scope = 'tab',
  imageContext,
}: ExportTabDialogProps) {
  // null = the format grid; otherwise the picked format's sub-panel.
  const [active, setActive] = useState<Format | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Image / avatar bitmaps + icon catalogues loaded for the image-format
  // preview (spec/48). Loaded once when an image format is picked, then
  // reused for both the live preview and the actual export so nothing is
  // fetched twice. `ready` gates the preview on the (async) load.
  const [previewImages, setPreviewImages] = useState<
    Awaited<ReturnType<typeof loadTabImages>> | undefined
  >(undefined);
  const [previewReady, setPreviewReady] = useState(false);

  const isSelection = scope === 'selection';
  const suffix = isSelection ? ' - selection' : '';
  const baseName = sanitizeFilename(`${diagramName || 'diagram'} - ${tab.name || 'tab'}${suffix}`);

  // When an image format is picked, load the icon catalogues + image bitmaps
  // so the preview (and export) renders the real glyphs, not placeholders.
  useEffect(() => {
    if (!active || isTextFormat(active)) return;
    let cancelled = false;
    setPreviewReady(false);
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

  // Build the preview SVG for the current options — the same SVG the .svg
  // export produces, which PNG / PDF rasterise, so it faithfully previews all
  // three. Stable across renders so the panel can memoise on the toggles.
  const renderPreview = useCallback(
    (opts: { isometric: boolean; pattern: boolean; hiddenLayers: boolean }) =>
      renderTabToSvg(tab, { ...opts, images: previewImages }),
    [tab, previewImages],
  );

  // Render + download an image format with the chosen options (spec/48).
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
      const renderOpts = { ...opts, images };
      if (format === 'png') {
        downloadBlob(await exportTabAsPng(tab, renderOpts), `${baseName}.png`);
      } else if (format === 'svg') {
        downloadBlob(exportTabAsSvg(tab, renderOpts), `${baseName}.svg`);
      } else {
        downloadBlob(await exportTabAsPdf(tab, renderOpts), `${baseName}.pdf`);
      }
      track('Diagram', 'Exported', EXPORT_LABEL[format]);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Export failed.');
      setBusy(false);
    }
  };

  const activeCard = active ? CARDS.find((c) => c.kind === active) : null;
  const subtitle = activeCard
    ? isTextFormat(active!)
      ? `Copy this tab as ${activeCard.title}, or download a file.`
      : `Set the image options for ${activeCard.title}, then download.`
    : isSelection
      ? 'Pick a format to export the selected elements.'
      : 'Pick a format to export the current tab.';

  return (
    <Dialog
      open
      onClose={onClose}
      ariaLabel={isSelection ? 'Export selection' : 'Export tab'}
      size="xl"
      className="max-h-[90vh]"
    >
      <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-6 pt-6 pb-4 dark:border-slate-800">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            {isSelection ? 'Export selection' : 'Export tab'}
          </h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{subtitle}</p>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <HelpArticleLink
            article="exportingDiagrams"
            title="Exporting diagrams"
            description="What each export format is for and how to use it."
          />
          <DialogCloseButton onClick={onClose} />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-6 py-5">
        {active && isTextFormat(active) ? (
          <TextExportPanel
            initialText={TEXT_PANELS[active].getText(tab)}
            blurb={TEXT_PANELS[active].blurb}
            downloadLabel={TEXT_PANELS[active].downloadLabel}
            onDownload={(text) => {
              const cfg = TEXT_PANELS[active];
              downloadBlob(new Blob([text], { type: cfg.mime }), `${baseName}.${cfg.ext}`);
              track('Diagram', 'Exported', EXPORT_LABEL[active]);
            }}
            onCopied={() => track('Diagram', 'Exported', EXPORT_LABEL[active])}
            onBack={() => setActive(null)}
          />
        ) : active ? (
          <ImageExportPanel
            label={activeCard!.title}
            busy={busy}
            error={error}
            hasHiddenLayers={tabLayers(tab.layers).some((l) => !isLayerVisible(l))}
            renderPreview={renderPreview}
            previewReady={previewReady}
            onExport={(opts) => void runImageExport(active as ImageFormat, opts)}
            onBack={() => {
              setError(null);
              setActive(null);
            }}
          />
        ) : (
          <div className="grid grid-cols-3 gap-3">
            {CARDS.map((c) => (
              <ExportCard
                key={c.kind}
                kind={c.kind}
                title={c.title}
                description={c.description}
                onClick={() => {
                  setError(null);
                  setActive(c.kind);
                }}
              />
            ))}
          </div>
        )}
      </div>
    </Dialog>
  );
}

function ExportCard({
  kind,
  title,
  description,
  onClick,
}: {
  kind: Format;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-start gap-1.5 rounded-lg border border-slate-200 bg-white p-3 text-left transition hover:border-brand-300 hover:bg-brand-50/40 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-brand-500/60 dark:hover:bg-brand-500/10"
    >
      <div className="flex h-12 w-full items-center justify-center rounded-md bg-slate-50 dark:bg-slate-200">
        <FormatIcon kind={kind} />
      </div>
      <div className="min-w-0">
        <p className="truncate text-xs font-semibold text-slate-900 dark:text-slate-100">{title}</p>
        <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-slate-500 dark:text-slate-400">
          {description}
        </p>
      </div>
    </button>
  );
}

// Filesystem-safe filename: replace anything that isn't alphanumeric,
// dot, dash, underscore, or space with a dash. Collapses runs of
// dashes and trims trailing whitespace so the resulting name is OS-
// friendly across Windows / macOS / Linux.
function sanitizeFilename(name: string): string {
  return name
    .replace(/[^A-Za-z0-9._\- ]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}
