import { useCallback, useId, useMemo, useState } from 'react';
import {
  exportTabDialogFrame,
  useExportPreviewImages,
} from '@liveworkspace/workbench/components/dialogs/export-tab-dialog';
import { tabExportBaseName } from '@liveworkspace/workbench/lib/tab-export-name';
import { FormatIcon } from './export-format-icons';
import { TextExportPanel } from '@liveworkspace/workbench/components/dialogs/TextExportPanel';
import { ImageExportPanel } from './ImageExportPanel';
import {
  isLayerVisible,
  tabLayers,
  mermaidFromTab,
  type Tab,
  tabToJsonText,
  tabToMarkdownText,
} from '@livediagram/document';
import {
  downloadBlob,
  exportTabAsPng,
  exportTabAsSvg,
  loadTabImages,
  renderTabToSvg,
} from '@/lib/export-tab';
import { exportTabAsPdf } from '@/lib/export-tab-pdf';
import { tabToExcalidrawText } from '@/lib/excalidraw-export';
import { ensureIconCatalogs } from '@liveworkspace/workbench/lib/icon-registry';
import { track } from '@/lib/telemetry';
import { HelpArticleLink } from '@/components/primitives/HelpArticleLink';

// A tab export's file name before its extension (docs/specs/020-import-export/export-fidelity.md "File names"):
// the shared rule, "document" when nothing safe is left.
export { tabExportBaseName };

// Telemetry (docs/specs/017-telemetry/telemetry.md): map the internal format key to the public label
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

// A text format taken (downloaded or copied).
function trackTextExport(format: TextFormat): void {
  track('Document', 'Exported', EXPORT_LABEL[format]);
}

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
};

// The format keys the dialog offers.
export type Format = 'file' | 'mermaid' | 'markdown' | 'excalidraw' | 'png' | 'svg' | 'pdf';

// The four text formats each open a view/edit/copy panel; the three image
// formats each open an options-and-download panel (docs/specs/010-palette/style-presets.md / 73).
type TextFormat = 'file' | 'mermaid' | 'markdown' | 'excalidraw';
type ImageFormat = 'png' | 'svg' | 'pdf';
const isTextFormat = (f: Format): f is TextFormat =>
  f === 'file' || f === 'mermaid' || f === 'markdown' || f === 'excalidraw';

// The image preview's load: the icon catalogues, then the image and avatar bitmaps when there is a context.
const loadPreviewImages = async (tab: Tab, imageContext: ExportTabDialogProps['imageContext']) => {
  await ensureIconCatalogs();
  return imageContext ? await loadTabImages(tab, imageContext) : undefined;
};

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
      "This tab as a livediagram JSON export. Edit it here to copy a variant; your edits don't change the tab.",
    downloadLabel: 'Download .json',
    ext: 'livediagram-tab.json',
    mime: 'application/json',
    getText: tabToJsonText,
  },
  mermaid: {
    blurb:
      "This tab as a Mermaid flowchart. Edit it here to copy a variant; your edits don't change the tab.",
    downloadLabel: 'Download .mmd',
    ext: 'mmd',
    mime: 'text/plain',
    getText: (tab) => mermaidFromTab(tab),
  },
  markdown: {
    blurb:
      "This tab as a Markdown outline. Edit it here to copy a variant; your edits don't change the tab.",
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
  documentName,
  onClose,
  scope = 'tab',
  imageContext,
  offerHiddenLayers = true,
}: ExportTabDialogProps) {
  const titleId = useId();
  // null = the format grid; otherwise the picked format's sub-panel.
  const [active, setActive] = useState<Format | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isSelection = scope === 'selection';
  const baseName = tabExportBaseName(documentName, tab.name, isSelection);

  // Image / avatar bitmaps + icon catalogues for the image-format preview, loaded once an image format is picked
  // and reused by the export (export-tab-dialog.tsx).
  const { previewImages, previewReady } = useExportPreviewImages({
    active,
    tab,
    imageContext,
    isTextFormat,
    load: loadPreviewImages,
  });

  // The open text format's text, built once per format and tab rather than on every render. The panel reads it only
  // as its starting text.
  const activeText = useMemo(
    () => (active && isTextFormat(active) ? TEXT_PANELS[active].getText(tab) : ''),
    [active, tab],
  );

  // Build the preview SVG for the current options — the same SVG the .svg
  // export produces, which PNG / PDF rasterise, so it faithfully previews all
  // three. Stable across renders so the panel can memoise on the toggles.
  const renderPreview = useCallback(
    (opts: { isometric: boolean; pattern: boolean; hiddenLayers: boolean }) =>
      renderTabToSvg(tab, { ...opts, images: previewImages }),
    [tab, previewImages],
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
      const renderOpts = { ...opts, images };
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
    ? isTextFormat(active!)
      ? `Copy this tab as ${activeCard.title}, or download a file.`
      : `Set the image options for ${activeCard.title}, then download.`
    : isSelection
      ? 'Pick a format to export the selected elements.'
      : 'Pick a format to export the current tab.';

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
      ) : active ? (
        <ImageExportPanel
          label={activeCard!.title}
          busy={busy}
          error={error}
          hasHiddenLayers={
            offerHiddenLayers && tabLayers(tab.layers).some((l) => !isLayerVisible(l))
          }
          renderPreview={renderPreview}
          previewReady={previewReady}
          onExport={(opts) => void runImageExport(active, opts)}
          onBack={() => {
            setError(null);
            setActive(null);
          }}
        />
      ) : null,
    cards: CARDS,
    onPick: (kind) => {
      setError(null);
      setActive(kind);
    },
    FormatIcon,
  });
}
