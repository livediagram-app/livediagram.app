'use client';

// A wireframe page's sheet (docs/specs/007-editor/wireframe-pages.md): its device drawn under the
// screen, and the screen painted with the page's background (a hover in its panel previews one),
// rounded as the device's is. The device's art is the export's own markup (wireframeFrameSvg), so
// the canvas and every export draw the same frame. What is drawn over the screen's content (the
// camera in it, the system bars) is WireframeDeviceOverlays, above the elements.
import { memo, useMemo, type CSSProperties, type ReactNode } from 'react';
import { trustedHtml } from '@livedocuments/ui';
import {
  deviceScreenPath,
  pageDeviceGeometry,
  wireframeFrameSvg,
  type LaidOutPage,
  type PageBackground,
  type WireframeFrameTheme,
} from '@livedocuments/document';
import { pageSheetStyle } from '@/lib/page-paint';

export const WireframeDeviceSheet = memo(function WireframeDeviceSheet({
  page,
  background,
  resolveImage,
  frameTheme,
  children,
}: {
  // The tab theme's colours, for the Theme look.
  frameTheme?: WireframeFrameTheme;
  page: LaidOutPage;
  // The background shown (the page's, or one previewed on it).
  background: PageBackground | undefined;
  resolveImage?: (imageId: string) => string | undefined;
  // What paints inside the screen, over its fill (an animated background).
  children?: ReactNode;
}) {
  const g = pageDeviceGeometry(page);
  // The frame drawn at the sheet's own corner: the sheet is positioned, so its art starts at 0, 0.
  const under = useMemo(
    () =>
      wireframeFrameSvg(
        { ...page, rect: { ...page.rect, x: 0, y: 0 } },
        { dark: false, ...(frameTheme ? { theme: frameTheme } : {}) },
      )?.under ?? '',
    // The frame depends on these alone (a browser's address on the name).
    // oxlint-disable-next-line react/exhaustive-deps
    [page.device, page.orientation, page.frameLook, page.name, page.kind, frameTheme],
  );
  if (!g) return null;
  // Cut to its pane, or a dual-screen device's two, rounded as the device's are.
  const screen: CSSProperties = {
    left: g.screen.x,
    top: g.screen.y,
    width: g.screen.width,
    height: g.screen.height,
    clipPath: `path('${deviceScreenPath(g, -g.screen.x, -g.screen.y)}')`,
    ...pageSheetStyle(background, undefined, resolveImage),
  };
  return (
    <>
      <svg
        aria-hidden
        className="pointer-events-none absolute inset-0 overflow-visible"
        width={page.rect.width}
        height={page.rect.height}
        viewBox={`0 0 ${page.rect.width} ${page.rect.height}`}
        // The frame is this app's own markup (packages/document wireframe-device-svg), never content.
        dangerouslySetInnerHTML={{ __html: trustedHtml(under) }}
      />
      <div
        data-wireframe-screen=""
        className={`pointer-events-none absolute overflow-hidden ${
          background?.fill ? '' : 'bg-white text-slate-900/10 dark:bg-slate-900 dark:text-white/10'
        }`}
        style={screen}
      >
        {children}
      </div>
    </>
  );
});
