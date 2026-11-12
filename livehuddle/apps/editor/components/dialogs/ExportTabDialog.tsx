import { useCallback, useId, useMemo, useState } from 'react';
import {
  exportTabDialogFrame,
  useExportPreviewImages,
} from '@liveworkspace/workbench/components/dialogs/export-tab-dialog';
import { FormatIcon } from './export-format-icons';
import { TextExportPanel } from '@liveworkspace/workbench/components/dialogs/TextExportPanel';
import { ImageExportPanel } from './ImageExportPanel';
import { type Tab, tabToJsonText, tabToMarkdownText } from '@livehuddle/document';
import {
  downloadBlob,
  exportTabAsPng,
  exportTabAsSvg,
  loadTabImages,
  renderTabToSvg,
} from '@/lib/export-tab';
import { exportTabAsPdf } from '@/lib/export-tab-pdf';
import { tabExportBaseName } from '@liveworkspace/workbench/lib/tab-export-name';
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
  markdown: 'Markdown',
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
};

// The format keys the dialog offers. Mermaid and Excalidraw are gone from livehuddle
// (docs/specs/002-project-scope/not-in-livehuddle.md "Imports from other tools").
export type Format = 'file' | 'markdown' | 'png' | 'svg' | 'pdf';

// The two text formats each open a view/edit/copy panel; the three image
// formats each open an options-and-download panel (docs/specs/010-palette/style-presets.md / 73).
type TextFormat = 'file' | 'markdown';
type ImageFormat = 'png' | 'svg' | 'pdf';
const isTextFormat = (f: Format): f is TextFormat => f === 'file' || f === 'markdown';

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
    description: 'A livehuddle file. Copy it or save a .json to import back with full fidelity.',
  },
  {
    kind: 'markdown',
    title: 'Markdown',
    description: "A text outline of this tab's elements. Copy it or save a .md.",
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
      "This tab as a livehuddle JSON export. Edit it here to copy a variant; your edits don't change the tab.",
    downloadLabel: 'Download .json',
    ext: 'livehuddle-tab.json',
    mime: 'application/json',
    getText: tabToJsonText,
  },
  markdown: {
    blurb:
      "This tab as a Markdown outline. Edit it here to copy a variant; your edits don't change the tab.",
    downloadLabel: 'Download .md',
    ext: 'md',
    mime: 'text/markdown',
    getText: tabToMarkdownText,
  },
};

// Welcome-style overlay: export options as a card grid. Text formats (JSON /
// Markdown) open an editable view/copy panel; image formats
// (PNG / SVG / PDF) open an options-and-download panel with the
// background-pattern toggles. The main grid stays clean — no format-specific
// options bleed onto it.
export function ExportTabDialog({
  tab,
  documentName,
  onClose,
  scope = 'tab',
  imageContext,
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
    (opts: { pattern: boolean }) => renderTabToSvg(tab, { ...opts, images: previewImages }),
    [tab, previewImages],
  );

  // Render + download an image format with the chosen options (docs/specs/010-palette/style-presets.md).
  const runImageExport = async (format: ImageFormat, opts: { pattern: boolean }) => {
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
    help: <HelpArticleLink article="exportingSpaces" size="md" />,
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
