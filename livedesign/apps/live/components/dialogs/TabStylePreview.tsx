'use client';

import { builtMarkup, htmlProps } from '@livedesign/ui';

// The frame the Tab Style panels preview their setting on (docs/specs/011-theme/canvas-and-theme-dialog.md
// "Previews"): a small UI frame (lib/frame-preview.ts) on the background new pages start on (the paper when the tab
// has none, and on a photo page, which takes no background), drawn by the page exporter in the tab's theme, finish
// and font, over the tab's surround. Rebuilt only when one of those changes.

import { useMemo } from 'react';
import {
  DARK_CANVAS_BACKGROUND_COLOR,
  DEFAULT_BACKGROUND_COLOR,
  type Finish,
  type TextSize,
} from '@livedesign/design';
import { useCanvasSurface } from '@liveworkspace/workbench/components/canvas/CanvasSurfaceContext';
import { framePreviewSvg } from '@/lib/frame-preview';
import { resolveTabBackdrop } from '@/lib/themes';
import { useTabStylePages } from './tab-style-pages';

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
  // The surround as this viewer sees it: a theme's own colour in their half (docs/specs/011-theme/light-and-dark.md),
  // a picked colour as it is.
  const around = canvasBackground
    ? resolveTabBackdrop({ theme: themeId, backgroundColor: canvasBackground }).backgroundColor
    : surface === 'dark'
      ? DARK_CANVAS_BACKGROUND_COLOR
      : DEFAULT_BACKGROUND_COLOR;
  const background = pages.kind === 'photo' ? undefined : pages.newPageBackground;
  const markup = useMemo(
    () =>
      framePreviewSvg({
        background,
        theme: themeId,
        finish,
        font: font ?? undefined,
        textSize,
      }),
    [background, themeId, finish, font, textSize],
  );
  return (
    <div
      role="img"
      aria-label={label}
      data-finish-preview={finish}
      data-preview-frame=""
      className="overflow-hidden rounded-lg border border-slate-200 p-3 dark:border-slate-700"
      style={{ backgroundColor: around }}
    >
      <div
        className="overflow-hidden rounded shadow-sm ring-1 ring-slate-900/10 [&>svg]:block [&>svg]:h-auto [&>svg]:w-full"
        {...htmlProps(builtMarkup(markup))}
      />
    </div>
  );
}
