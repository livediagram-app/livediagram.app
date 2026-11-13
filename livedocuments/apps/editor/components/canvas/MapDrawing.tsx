'use client';

// The map as SVG (docs/specs/009-elements/map.md "What it shows"; blueprint "Layout"): drawn from the
// same `mapLayout` the export writes, so the canvas, the Map dialog's preview and every export agree.
// Countries sit in one group scaled from the plane (a pan or zoom repaints it without React); pins
// and labels are drawn in px on top. The dialog passes the handlers that make it clickable.

import { memo, useMemo } from 'react';
import {
  mapLayout,
  pinLabelAnchor,
  type MapColours,
  type MapFields,
  type MapGeometry,
} from '@livedocuments/document';

// The placeholder's opacity while the geometry loads (D198), as in the export.
const PLACEHOLDER_OPACITY = 0.6;

export type MapDrawingProps = {
  fields: MapFields;
  width: number;
  height: number;
  geometry: MapGeometry | null;
  colours: MapColours;
  fontFamily?: string;
  // The dialog's preview: a press on a country, the country under the pointer, a press anywhere
  // (in the drawing's px, for placing a pin).
  onCountryPress?: (code: string) => void;
  onCountryHover?: (code: string | null) => void;
  onPress?: (planeX: number, planeY: number) => void;
  // How the pointer looks over the drawing: a country to toggle, or a place to drop a pin.
  cursor?: 'pointer' | 'crosshair';
  // The dialog's preview fills its frame; the canvas draws at the element's px.
  className?: string;
};

export const MapDrawing = memo(function MapDrawing({
  fields,
  width,
  height,
  geometry,
  colours,
  fontFamily,
  onCountryPress,
  onCountryHover,
  onPress,
  cursor,
  className = 'absolute inset-0 block overflow-hidden',
}: MapDrawingProps) {
  const layout = useMemo(
    () => mapLayout(fields, width, height, geometry, colours),
    [fields, width, height, geometry, colours],
  );
  if (!layout) return null;
  const interactive = !!(onCountryPress || onPress);
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      style={{ cursor }}
      aria-hidden={!interactive}
      onPointerDown={
        onPress
          ? (e) => {
              const box = e.currentTarget.getBoundingClientRect();
              const x = ((e.clientX - box.left) / box.width) * width;
              const y = ((e.clientY - box.top) / box.height) * height;
              onPress((x - layout.tx) / layout.scale, (y - layout.ty) / layout.scale);
            }
          : undefined
      }
      onPointerLeave={onCountryHover ? () => onCountryHover(null) : undefined}
    >
      {geometry ? (
        <g
          transform={`translate(${layout.tx} ${layout.ty}) scale(${layout.scale})`}
          stroke={colours.paper}
          strokeWidth={layout.borderWidth / layout.scale}
          strokeLinejoin="round"
        >
          {layout.countries.map((c) => (
            <path
              key={c.part ? `${c.code}-${c.part}` : c.code}
              d={c.d}
              fill={c.fill}
              fillOpacity={c.opacity}
              data-map-country={c.code || undefined}
              onPointerDown={
                onCountryPress && c.code
                  ? (e) => {
                      e.stopPropagation();
                      onCountryPress(c.code);
                    }
                  : undefined
              }
              onPointerEnter={onCountryHover && c.code ? () => onCountryHover(c.code) : undefined}
            />
          ))}
        </g>
      ) : (
        <rect
          width={width}
          height={height}
          rx={Math.min(width, height) * 0.06}
          fill={colours.land}
          opacity={PLACEHOLDER_OPACITY}
          data-map-placeholder=""
        />
      )}
      <g style={{ pointerEvents: 'none' }}>
        {layout.pins.map((p) => {
          const at = pinLabelAnchor(p, layout);
          return (
            <g key={p.id}>
              <circle
                cx={p.x}
                cy={p.y}
                r={layout.pinRadius}
                // In the ink, not the accent, so a pin reads on a highlighted country (map.md "What it shows").
                fill={colours.text}
                stroke={colours.paper}
                strokeWidth={layout.pinRing}
              />
              {p.label ? (
                <text
                  x={at.x}
                  y={p.y}
                  textAnchor={at.anchor}
                  dominantBaseline="central"
                  fontSize={layout.labelSize}
                  fontWeight={600}
                  fontFamily={fontFamily}
                  fill={colours.text}
                  stroke={colours.paper}
                  strokeWidth={layout.labelHalo}
                  strokeLinejoin="round"
                  paintOrder="stroke"
                >
                  {p.label}
                </text>
              ) : null}
            </g>
          );
        })}
      </g>
    </svg>
  );
});
