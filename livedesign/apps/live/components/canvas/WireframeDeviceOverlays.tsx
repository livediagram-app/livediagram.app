'use client';

// What a wireframe page draws over its screen's content (docs/specs/007-editor/wireframe-pages.md
// "The screen"): the camera that sits in the screen (the Dynamic Island, a punch hole) and the
// system bars, in ink for the screen's background (a hover in the page's panel previews one). In
// the canvas world above the elements, taking no presses. Nothing when no page is a wireframe.
// A screen with no fill of its own is the plain paper, which the dark editor shows as its dark
// sheet: its bars are inked for that, so the 9:41 reads there too.
import { memo, useMemo } from 'react';
import { trustedHtml } from '@livedesign/ui';
import {
  pageIsDark,
  wireframeFrameSvg,
  type LaidOutPage,
  type WireframeFrameTheme,
} from '@livedesign/design';
import { usePageBackgroundPreview, withPreviewedBackgrounds } from '@/lib/page-background-preview';
import { useAppearance } from '@/hooks/ui/useAppearance';

export function WireframeDeviceOverlays({
  pages,
  frameTheme,
}: {
  pages: readonly LaidOutPage[] | null;
  frameTheme?: WireframeFrameTheme | undefined;
}) {
  const preview = usePageBackgroundPreview();
  const { appearance } = useAppearance();
  const wireframes = useMemo(() => (pages ?? []).filter((p) => p.kind === 'wireframe'), [pages]);
  if (wireframes.length === 0) return null;
  const shown = withPreviewedBackgrounds(wireframes, preview);
  return (
    <>
      {shown.map((page) => (
        <DeviceOver
          key={page.id}
          page={page}
          dark={page.background?.fill ? pageIsDark(page) : appearance === 'dark'}
          frameTheme={frameTheme}
        />
      ))}
    </>
  );
}

const DeviceOver = memo(function DeviceOver({
  page,
  dark,
  frameTheme,
}: {
  page: LaidOutPage;
  dark: boolean;
  frameTheme?: WireframeFrameTheme | undefined;
}) {
  const over = useMemo(
    () =>
      wireframeFrameSvg(
        { ...page, rect: { ...page.rect, x: 0, y: 0 } },
        { dark, ...(frameTheme ? { theme: frameTheme } : {}) },
      )?.over ?? '',
    // oxlint-disable-next-line react/exhaustive-deps
    [page.device, page.orientation, page.frameLook, page.systemBars, dark, frameTheme],
  );
  if (!over) return null;
  return (
    <svg
      aria-hidden
      data-wireframe-over={page.id}
      className="pointer-events-none absolute overflow-visible transition-[left,top] duration-200 ease-out motion-reduce:transition-none"
      style={{ left: page.rect.x, top: page.rect.y }}
      width={page.rect.width}
      height={page.rect.height}
      viewBox={`0 0 ${page.rect.width} ${page.rect.height}`}
      // This app's own markup (packages/design wireframe-device-svg), never content.
      dangerouslySetInnerHTML={{ __html: trustedHtml(over) }}
    />
  );
});
