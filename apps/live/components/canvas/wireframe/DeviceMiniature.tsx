'use client';

// A device drawn small (docs/specs/007-editor/wireframe-pages.md "Choosing the device"): the
// export's own frame markup around a plain screen, fitted to a box, so a device tile shows the
// frame a page will wear.
import { memo, useMemo } from 'react';
import { trustedHtml } from '@liveplanner/ui';
import {
  deviceGeometry,
  deviceScreenPath,
  wireframeFrameOverSvg,
  wireframeFrameUnderSvg,
  type WireframeDeviceId,
  type WireframeFrameLook,
  type WireframeFrameTheme,
} from '@liveplanner/document';

export const DeviceMiniature = memo(function DeviceMiniature({
  device,
  look = 'theme',
  theme,
  landscape = false,
  width,
  height,
}: {
  device: WireframeDeviceId;
  look?: WireframeFrameLook;
  // The tab theme's colours, for the Theme look.
  theme?: WireframeFrameTheme | undefined;
  landscape?: boolean;
  // The box the device is fitted into, keeping its shape.
  width: number;
  height: number;
}) {
  const g = useMemo(() => deviceGeometry(device, landscape), [device, landscape]);
  const markup = useMemo(
    () =>
      wireframeFrameUnderSvg(g, look, 0, 0, undefined, theme) +
      `<path d="${deviceScreenPath(g)}" fill="#ffffff"/>` +
      wireframeFrameOverSvg(g, look, 0, 0, {
        systemBars: false,
        dark: false,
        ...(theme ? { theme } : {}),
      }),
    [g, look, theme],
  );
  return (
    <svg
      aria-hidden
      width={width}
      height={height}
      viewBox={`0 0 ${g.width} ${g.height}`}
      preserveAspectRatio="xMidYMid meet"
      className="drop-shadow-sm"
      // This app's own markup (packages/document wireframe-device-svg), never content.
      dangerouslySetInnerHTML={{ __html: trustedHtml(markup) }}
    />
  );
});
