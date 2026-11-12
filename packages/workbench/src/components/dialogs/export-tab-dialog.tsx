import { useEffect, useState, type ComponentType, type ReactElement, type ReactNode } from 'react';
import { HeroDialogHeader } from '@liveworkspace/ui/dialog-hero';
import { exportHeroArt } from '@liveworkspace/ui/dialog-hero-art/export';
import { Dialog } from './Dialog';
import { FormatCard } from './FormatCard';

// The Export Tab dialog's shared parts (docs/specs/020-import-export/export-fidelity.md), one copy for every
// editor: its frame (the dialog, its hero header and the scrolling body), the grid of format cards, and the image
// formats' preview load. Each editor's components/dialogs/ExportTabDialog.tsx keeps its own formats, panels,
// telemetry and copy, and calls these as it renders: the frame and the grid are plain functions returning the
// editor's own tree, not components, so the dialog's tree is as it was.

/** One format card's copy, in display order. */
export type FormatCardCopy<F extends string> = { kind: F; title: string; description: string };

/** The dialog with its hero header (dialog-hero-header.md: the tab leaving as files), the open format's panel
 *  in its body, or the format grid while none is open. */
export function exportTabDialogFrame<F extends string>({
  isSelection,
  titleId,
  subtitle,
  help,
  onClose,
  panel,
  cards,
  onPick,
  FormatIcon,
}: {
  isSelection: boolean;
  titleId: string;
  subtitle: string;
  // The header's help link (the editor's HelpArticleLink to its export article).
  help: ReactNode;
  onClose: () => void;
  // The open format's panel; null shows the grid.
  panel: ReactNode | null;
  cards: readonly FormatCardCopy<F>[];
  onPick: (kind: F) => void;
  FormatIcon: ComponentType<{ kind: F }>;
}): ReactElement {
  return (
    <Dialog
      open
      onClose={onClose}
      ariaLabel={isSelection ? 'Export Selection' : 'Export Tab'}
      size="xl"
      className="max-h-[90vh]"
    >
      {/* The dialog hero header (dialog-hero-header.md): the tab leaving as files. */}
      <HeroDialogHeader
        art={exportHeroArt}
        titleId={titleId}
        title={isSelection ? 'Export Selection' : 'Export Tab'}
        subtitle={subtitle}
        actions={help}
        onClose={onClose}
      />
      <div className="flex-1 overflow-y-auto px-6 py-5">
        {panel ?? (
          <div
            // Two columns on a phone: three left each card about 110px wide, its description wrapping to eight lines.
            className="grid grid-cols-2 gap-3 sm:grid-cols-3"
          >
            {cards.map((c) => (
              <FormatCard
                key={c.kind}
                title={c.title}
                description={c.description}
                onClick={() => onPick(c.kind)}
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

/** The image formats' preview load (docs/specs/010-palette/style-presets.md): once an image format is picked, the
 *  editor's `load` (its icon catalogues, then its image and avatar bitmaps) runs once, and its images are reused
 *  for both the live preview and the export, so nothing is fetched twice. `previewReady` gates the preview on the
 *  load. `isTextFormat` and `load` are the editor's module-level functions, so the load runs as often as before:
 *  when the format, the tab or the image context changes. */
export function useExportPreviewImages<F extends string, T, C, I>({
  active,
  tab,
  imageContext,
  isTextFormat,
  load,
  skipLoad,
}: {
  active: F | null;
  tab: T;
  imageContext: C | undefined;
  isTextFormat: (format: F) => boolean;
  load: (tab: T, imageContext: C | undefined) => Promise<I | undefined>;
  // A non-text format whose panel draws no preview, so loads nothing (still reset on pick).
  skipLoad?: (format: F) => boolean;
}): { previewImages: I | undefined; previewReady: boolean } {
  const [previewImages, setPreviewImages] = useState<I | undefined>(undefined);
  const [previewReady, setPreviewReady] = useState(false);

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
    if (!active || isTextFormat(active) || skipLoad?.(active)) return;
    let cancelled = false;
    void (async () => {
      const images = await load(tab, imageContext);
      if (cancelled) return;
      setPreviewImages(images);
      setPreviewReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [active, tab, imageContext, isTextFormat, load, skipLoad]);

  return { previewImages, previewReady };
}
