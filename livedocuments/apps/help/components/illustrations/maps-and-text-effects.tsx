// Maps and text effects illustrations (docs/specs/018-help/help-app.md): a map of Europe with offices
// pinned and markets highlighted, the Edit Map dialog, and a headline with a marker highlight, a gradient
// word and a soft shadow. The map is drawn from the element's own geometry and layout
// (@livedocuments/document), so the figure is the canvas's drawing, in the house palette. Server-rendered:
// the geometry never reaches the browser as script, and only the countries in view are written.

import { useId } from 'react';
import { Scene, Label, Dialog, Button } from '@liveworkspace/help-site/art/primitives';
import { mapLayout, pinLabelAnchor, type MapFields } from '@livedocuments/document';
import { MAP_GEOMETRY } from '@livedocuments/document/map-geometry';

// Markers mapLayout hands back, swapped for house classes below.
const COLOURS = { land: 'land', accent: 'accent', paper: 'paper', text: 'text' };
const FILL: Record<string, string> = { land: 'fill-slate-200', accent: 'fill-brand-500' };

function MapArt({
  fields,
  x,
  y,
  w,
  h,
}: {
  fields: MapFields;
  x: number;
  y: number;
  w: number;
  h: number;
}) {
  const layout = mapLayout(fields, w, h, MAP_GEOMETRY, COLOURS)!;
  const clip = `mapclip-${useId().replace(/:/g, '')}`;
  // Only the countries whose frame meets the box.
  const left = -layout.tx / layout.scale;
  const top = -layout.ty / layout.scale;
  const right = left + w / layout.scale;
  const bottom = top + h / layout.scale;
  const inView = new Set(
    MAP_GEOMETRY.countries
      .filter((c) => c[5] >= left && c[3] <= right && c[6] >= top && c[4] <= bottom)
      .map((c) => c[0]),
  );
  return (
    <g transform={`translate(${x} ${y})`}>
      <defs>
        <clipPath id={clip}>
          <rect width={w} height={h} rx={10} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clip})`}>
        <rect width={w} height={h} className="fill-white" />
        <g
          transform={`translate(${layout.tx} ${layout.ty}) scale(${layout.scale})`}
          className="stroke-white"
          strokeWidth={layout.borderWidth / layout.scale}
          strokeLinejoin="round"
        >
          {layout.countries
            .filter((c) => inView.has(c.code))
            .map((c) => (
              <path
                key={c.part ? `${c.code}-${c.part}` : c.code}
                d={c.d}
                className={FILL[c.fill]}
                fillOpacity={c.opacity}
              />
            ))}
        </g>
        {layout.pins.map((p) => {
          const at = pinLabelAnchor(p, layout);
          return (
            <g key={p.id}>
              <circle
                cx={p.x}
                cy={p.y}
                r={layout.pinRadius}
                className="fill-brand-700 stroke-white"
                strokeWidth={layout.pinRing}
              />
              <text
                x={at.x}
                y={p.y}
                textAnchor={at.anchor}
                dominantBaseline="central"
                fontSize={layout.labelSize}
                fontWeight={600}
                className="fill-slate-800 stroke-white"
                strokeWidth={layout.labelHalo}
                strokeLinejoin="round"
                paintOrder="stroke"
              >
                {p.label}
              </text>
            </g>
          );
        })}
      </g>
      <rect width={w} height={h} rx={10} className="fill-none stroke-slate-200" strokeWidth={1.5} />
    </g>
  );
}

const OFFICES: MapFields = {
  mapRegion: 'europe',
  mapHighlights: ['GB', 'DE', 'ES', 'PL', 'SE'],
  mapPins: [
    { id: 'l', lat: 51.51, lon: -0.13, label: 'London' },
    { id: 'b', lat: 52.52, lon: 13.4, label: 'Berlin' },
    { id: 'm', lat: 40.42, lon: -3.7, label: 'Madrid' },
    { id: 's', lat: 59.33, lon: 18.07, label: 'Stockholm' },
  ],
};

/** A slide's map: Europe, five markets highlighted and four offices pinned. */
export function MapOffices() {
  return (
    <Scene w={420} h={240} bg="canvas">
      <Label x={24} y={26} size={14} weight={700} tone="strong">
        Where We Work
      </Label>
      <MapArt fields={OFFICES} x={24} y={40} w={372} h={184} />
    </Scene>
  );
}

/** The Edit Map dialog: the preview with its mode switch, and the side panel's countries and pins. */
export function MapEditDialog() {
  const W = 440;
  const H = 260;
  return (
    <Scene w={W} h={H} bg="canvas">
      <Dialog x={12} y={10} w={416} h={240} title="Edit Map" sceneW={W} sceneH={H}>
        {/* The mode switch */}
        <rect x={28} y={56} width={204} height={22} rx={7} className="fill-slate-100" />
        <rect x={30} y={58} width={110} height={18} rx={6} className="fill-brand-500" />
        <Label x={85} y={68} size={9.5} weight={600} anchor="middle" tone="onAccent">
          Highlight Countries
        </Label>
        <Label x={186} y={68} size={9.5} weight={600} anchor="middle" tone="muted">
          Place Pins
        </Label>
        <MapArt fields={OFFICES} x={28} y={86} w={234} h={118} />
        {/* The side panel */}
        <Label x={278} y={64} size={10} weight={700} tone="strong">
          Countries
        </Label>
        {[
          ['Germany', 278, 74, 58],
          ['Spain', 340, 74, 44],
          ['Poland', 278, 94, 50],
        ].map(([name, cx, cy, cw]) => (
          <g key={name as string}>
            <rect
              x={cx as number}
              y={cy as number}
              width={cw as number}
              height={16}
              rx={8}
              className="fill-white stroke-slate-200"
              strokeWidth={1}
            />
            <circle
              cx={(cx as number) + 8}
              cy={(cy as number) + 8}
              r={2.5}
              className="fill-brand-500"
            />
            <Label x={(cx as number) + 14} y={(cy as number) + 8.5} size={8.5}>
              {name}
            </Label>
          </g>
        ))}
        <Label x={278} y={130} size={10} weight={700} tone="strong">
          Pins
        </Label>
        <rect
          x={278}
          y={138}
          width={134}
          height={18}
          rx={5}
          className="fill-white stroke-slate-300"
          strokeWidth={1}
        />
        <Label x={285} y={147.5} size={8.5} tone="muted">
          Find a city…
        </Label>
        {['London', 'Berlin'].map((name, i) => (
          <g key={name}>
            <rect
              x={278}
              y={162 + i * 21}
              width={134}
              height={18}
              rx={5}
              className="fill-white stroke-slate-200"
              strokeWidth={1}
            />
            <Label x={285} y={171.5 + i * 21} size={8.5}>
              {name}
            </Label>
          </g>
        ))}
        <line x1={12} y1={214} x2={428} y2={214} className="stroke-slate-200" strokeWidth={1.5} />
        <Button x={290} y={222} w={58} h={22} label="Cancel" />
        <Button x={354} y={222} w={58} h={22} label="Done" variant="primary" />
      </Dialog>
    </Scene>
  );
}

/** A headline with each effect: a marker highlight, a gradient word, and a soft shadow behind the letters. */
export function TextEffectsHeadline() {
  const id = useId().replace(/:/g, '');
  return (
    <Scene w={420} h={200} bg="canvas">
      <defs>
        <linearGradient id={`tg-${id}`} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" style={{ stopColor: 'var(--color-orange-500)' }} />
          <stop offset="1" style={{ stopColor: 'var(--color-pink-600)' }} />
        </linearGradient>
        <filter id={`ts-${id}`} x="-10%" y="-30%" width="120%" height="160%">
          <feDropShadow dx="0" dy="3" stdDeviation="4" floodOpacity="0.22" />
        </filter>
      </defs>
      {/* The marker band sits behind the lower part of the word, as the canvas draws it. */}
      <rect x={42} y={70} width={112} height={26} rx={5} className="fill-amber-200" />
      <g filter={`url(#ts-${id})`}>
        <text x={44} y={86} fontSize={36} fontWeight={800} className="fill-slate-800">
          Grow
        </text>
        <text x={164} y={86} fontSize={36} fontWeight={800} fill={`url(#tg-${id})`}>
          faster
        </text>
        <text x={44} y={132} fontSize={36} fontWeight={800} className="fill-slate-800">
          this year
        </text>
      </g>
      <Label x={44} y={168} size={11} tone="muted">
        Highlight on “Grow”, Sunset gradient on “faster”, Soft shadow on the text.
      </Label>
    </Scene>
  );
}
