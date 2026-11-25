'use client';

// A page design drawn small (docs/specs/011-theme/canvas-and-theme-dialog.md "Page Design"): the still frame as an
// image, so forty tiles are forty pictures the browser rasterises once, not thousands of live SVG nodes, and nothing
// in them moves or takes a press.
import { memo, useMemo } from 'react';
import { designTileSvg, type DesignTileInput } from './design-tile-svg';

export const svgDataUri = (svg: string) =>
  `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

export const DesignTileImage = memo(function DesignTileImage({
  input,
  className = '',
}: {
  input: DesignTileInput;
  className?: string;
}) {
  const src = useMemo(() => svgDataUri(designTileSvg(input).svg), [input]);
  return (
    <img
      src={src}
      alt=""
      draggable={false}
      decoding="async"
      className={`pointer-events-none block h-full w-full select-none object-cover ${className}`}
    />
  );
});
