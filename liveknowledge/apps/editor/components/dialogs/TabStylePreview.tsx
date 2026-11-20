'use client';

import { builtMarkup, htmlProps } from '@liveknowledge/ui';

// The page the Tab Style panels preview their setting on (docs/specs/011-theme/canvas-and-theme-dialog.md
// "Previews"): a page of the kind the dialog styles (lib/page-preview.ts), on the background new pages start on (else
// its kind's own: the theme's Dusk for an infographic page, Steel for a slide, the paper for an article or a card),
// drawn by the page exporter in the tab's theme, finish and font, over the tab's surround. An article shows its top,
// its title and first lines. Rebuilt only when one of those changes.

import { useMemo } from 'react';
import {
  DARK_CANVAS_BACKGROUND_COLOR,
  DEFAULT_BACKGROUND_COLOR,
  defaultPageBackground,
  type Finish,
  type PageBackground,
  type PageKind,
  type TextSize,
} from '@liveknowledge/document';
import { useCanvasSurface } from '@liveworkspace/workbench/components/canvas/CanvasSurfaceContext';
import { pagePreviewSvg } from '@/lib/page-preview';
import { getTheme, resolveTabBackdrop } from '@/lib/themes';
import { useTabStylePages } from './tab-style-pages';

/** The background the sample page wears: the tab's New Page Background, else what a first page of the kind takes. */
export function previewPageBackground(
  kind: PageKind,
  own: PageBackground | undefined,
  themeId: string,
): PageBackground | undefined {
  if (own) return own;
  if (kind === 'article') return undefined;
  return defaultPageBackground(getTheme(themeId), kind === 'slide' ? 'slide' : 'infographic');
}

export function TabStylePreview({
  finish,
  canvasBackground,
  themeId,
  font,
  textSize,
  label,
}: {
  finish: Finish;
  // The tab's own background, undefined for the canvas's default on this surface.
  canvasBackground: string | undefined;
  themeId: string;
  font: string | null;
  // The size new text takes, drawn on the sample's labels (the Text panel); omitted, labels keep their size.
  textSize?: TextSize;
  // What the preview shows, for a screen reader.
  label: string;
}) {
  const surface = useCanvasSurface();
  const pages = useTabStylePages();
  const kind = pages.kind ?? 'infographic';
  // The surround as this viewer sees it: a theme's own colour in their half (docs/specs/011-theme/light-and-dark.md),
  // a picked colour as it is.
  const around = canvasBackground
    ? resolveTabBackdrop({ theme: themeId, backgroundColor: canvasBackground }).backgroundColor
    : surface === 'dark'
      ? DARK_CANVAS_BACKGROUND_COLOR
      : DEFAULT_BACKGROUND_COLOR;
  const own = pages.newPageBackground;
  const markup = useMemo(
    () =>
      pagePreviewSvg({
        kind,
        background: previewPageBackground(kind, own, themeId),
        theme: themeId,
        finish,
        font: font ?? undefined,
        textSize,
      }),
    [kind, own, themeId, finish, font, textSize],
  );
  return (
    <div
      role="img"
      aria-label={label}
      data-finish-preview={finish}
      data-preview-page={kind}
      className="overflow-hidden rounded-lg border border-slate-200 p-3 dark:border-slate-700"
      style={{ backgroundColor: around }}
    >
      <div
        className={`overflow-hidden rounded shadow-sm ring-1 ring-slate-900/10 [&>svg]:block [&>svg]:h-auto [&>svg]:w-full ${
          kind === 'article' ? 'aspect-[16/9]' : ''
        }`}
        {...htmlProps(builtMarkup(markup))}
      />
    </div>
  );
}
