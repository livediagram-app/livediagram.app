'use client';

import { builtMarkup, htmlProps } from '@livehuddle/ui';

// The small room the Tab Style panels preview their setting on (docs/specs/011-theme/canvas-and-theme-dialog.md
// "One dialog, this editor's profile"): a room with its door, a desk, a plant and a sticky on a slice of the tab's
// floor, drawn by the export renderer (lib/room-preview.ts) in the tab's theme, finish and font, so it is exactly
// what the Space will show. The floor is the editor's active tab's (none outside an editor). Rebuilt only when one of
// those changes.

import { useMemo } from 'react';
import {
  DARK_CANVAS_BACKGROUND_COLOR,
  DEFAULT_BACKGROUND_COLOR,
  type Finish,
  type TextSize,
} from '@livehuddle/document';
import { useCanvasSurface } from '@/components/canvas/CanvasSurfaceContext';
import { useOptionalEditorContext } from '@/app/document/[id]/EditorContext';
import { roomPreviewSvg } from '@/lib/room-preview';
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
  const tab = useOptionalEditorContext()?.activeTab;
  const floor = tab?.backgroundPattern;
  const floorOpacity = tab?.backgroundOpacity;
  const patternColor = tab?.patternColor;
  const markup = useMemo(
    () =>
      roomPreviewSvg(finish, {
        background,
        theme: themeId,
        font: font ?? undefined,
        textSize,
        floor,
        floorOpacity,
        patternColor,
      }),
    [finish, background, themeId, font, textSize, floor, floorOpacity, patternColor],
  );
  return (
    <div
      role="img"
      aria-label={label}
      data-finish-preview={finish}
      className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700 [&>svg]:block [&>svg]:h-auto [&>svg]:w-full"
      {...htmlProps(builtMarkup(markup))}
    />
  );
}
