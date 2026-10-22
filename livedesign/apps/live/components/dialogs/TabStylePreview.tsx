'use client';

import { trustedHtml } from '@livepages/ui';

// The sample diagram the Tab Style panels preview their setting on (docs/specs/011-theme/canvas-and-theme-dialog.md
// "Finish panel", "Text panel"): a step, a decision, the arrow between and a sticky, drawn by the export renderer
// (lib/finish-preview.ts) in the tab's theme, finish and font, on the tab's paper, so it is exactly what the canvas
// will show. Rebuilt only when one of those changes.

import { useMemo } from 'react';
import {
  DARK_CANVAS_BACKGROUND_COLOR,
  DEFAULT_BACKGROUND_COLOR,
  type Finish,
  type TextSize,
} from '@livepages/document';
import { useCanvasSurface } from '@/components/canvas/CanvasSurfaceContext';
import { finishPreviewSvg } from '@/lib/finish-preview';
import { resolveTabBackdrop } from '@/lib/themes';

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
  // The tab's canvas as this viewer sees it: a theme's own colour in their half (docs/specs/011-theme/
  // light-and-dark.md), a picked colour as it is.
  const background = canvasBackground
    ? resolveTabBackdrop({ theme: themeId, backgroundColor: canvasBackground }).backgroundColor
    : surface === 'dark'
      ? DARK_CANVAS_BACKGROUND_COLOR
      : DEFAULT_BACKGROUND_COLOR;
  const markup = useMemo(
    () =>
      finishPreviewSvg(finish, {
        background,
        theme: themeId,
        font: font ?? undefined,
        textSize,
      }),
    [finish, background, themeId, font, textSize],
  );
  return (
    <div
      role="img"
      aria-label={label}
      data-finish-preview={finish}
      className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700 [&>svg]:block [&>svg]:h-auto [&>svg]:w-full"
      dangerouslySetInnerHTML={{ __html: trustedHtml(markup) }}
    />
  );
}
