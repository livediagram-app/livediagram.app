'use client';

// The Tab Look & Feel dialog's Finish tab (docs/specs/008-canvas/finish.md "Where it is set"): the tab's
// finish as three tiles, applied live, and Apply to All Elements, which clears every element's own finish so
// the whole tab follows it again.

import { useMemo } from 'react';
import {
  DARK_CANVAS_BACKGROUND_COLOR,
  DEFAULT_BACKGROUND_COLOR,
  DEFAULT_FINISH,
  FINISHES,
  type Finish,
} from '@livediagram/document';
import { Button } from '@livediagram/ui';
import { SizeButton } from '@/components/palette/palette-controls';
import { FINISH_LABELS, FinishSwatch } from '@/components/palette/FinishSection';
import { useCanvasSurface } from '@/components/canvas/CanvasSurfaceContext';
import { finishPreviewSvg } from '@/lib/finish-preview';

export function FinishTab({
  finish,
  onSetFinish,
  onApplyFinishToAll,
  canvasBackground,
  themeId,
  font,
}: {
  // The tab's finish; undefined reads as Flexible.
  finish: Finish | undefined;
  onSetFinish: (finish: Finish) => void;
  onApplyFinishToAll: () => void;
  // The tab's own background (undefined: the canvas's default for this surface), theme and font, so the
  // preview sits on the same paper in the same look.
  canvasBackground: string | undefined;
  themeId: string;
  font: string | null;
}) {
  const current = finish ?? DEFAULT_FINISH;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Finish
        </span>
        <div className="grid grid-cols-3 gap-2">
          {FINISHES.map((f) => (
            <SizeButton key={f} active={current === f} onClick={() => onSetFinish(f)}>
              <span className="flex flex-col items-center gap-1 py-1">
                <FinishSwatch finish={f} />
                <span className="text-[11px] font-medium">{FINISH_LABELS[f]}</span>
              </span>
            </SizeButton>
          ))}
        </div>
        <p className="text-[11px] leading-snug text-slate-500 dark:text-slate-400">
          How lines, corners and lettering are drawn on this tab.
        </p>
      </div>
      <FinishPreview
        finish={current}
        canvasBackground={canvasBackground}
        themeId={themeId}
        font={font}
      />
      <div className="border-t border-slate-100 pt-3 dark:border-slate-800">
        <Button variant="secondary" size="xs" onClick={onApplyFinishToAll}>
          Apply to All Elements
        </Button>
      </div>
    </div>
  );
}

// A small sample scene in the chosen finish, on the tab's paper (lib/finish-preview.ts), drawn by the export
// renderer so it is exactly what the canvas will show. Rebuilt only when the finish or the tab's look changes.
function FinishPreview({
  finish,
  canvasBackground,
  themeId,
  font,
}: {
  finish: Finish;
  canvasBackground: string | undefined;
  themeId: string;
  font: string | null;
}) {
  const surface = useCanvasSurface();
  const background =
    canvasBackground ??
    (surface === 'dark' ? DARK_CANVAS_BACKGROUND_COLOR : DEFAULT_BACKGROUND_COLOR);
  const markup = useMemo(
    () => finishPreviewSvg(finish, { background, theme: themeId, font: font ?? undefined }),
    [finish, background, themeId, font],
  );
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        Preview
      </span>
      <div
        role="img"
        aria-label={`A sample diagram drawn in the ${FINISH_LABELS[finish]} finish`}
        data-finish-preview={finish}
        className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700 [&>svg]:block [&>svg]:h-auto [&>svg]:w-full"
        dangerouslySetInnerHTML={{ __html: markup }}
      />
    </div>
  );
}
