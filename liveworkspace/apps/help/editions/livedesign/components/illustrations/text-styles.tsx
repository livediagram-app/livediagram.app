// Text styles illustrations (docs/specs/008-canvas/canvas-and-palette.md "Text styles"): Write's seven text style
// rows beside a wireframe screen set in them, and the Text menu's Text Style list. Each draws the real surface with
// its real labels: tool-tiles.tsx (the Write rows and their blurbs) and TextStyleSection.tsx (the Text Style rows,
// each name in its own weight at a size that keeps the order, its size beside it). Composed from the shared
// primitives so the house style holds.

import { Label, Menu, Scene, SelectionBox } from '@liveworkspace/help-site/art/primitives';

type Row = { name: string; px: number; weight: number; italic?: boolean; blurb: string };

// The table in packages/design/src/text-presets.ts, with each tile's blurb.
const STYLES: readonly Row[] = [
  { name: 'Title', px: 40, weight: 700, blurb: 'The name at the top of a screen' },
  { name: 'Subtitle', px: 24, weight: 400, blurb: 'A line under the title' },
  { name: 'Heading', px: 32, weight: 700, blurb: 'Starts a section' },
  { name: 'Subheading', px: 20, weight: 700, blurb: 'Splits a section up' },
  { name: 'Paragraph', px: 16, weight: 400, blurb: 'Body text that wraps' },
  { name: 'Quote', px: 20, weight: 400, italic: true, blurb: 'A line worth pulling out' },
  { name: 'Caption', px: 12, weight: 400, blurb: 'Small print under a picture' },
];

const FONT = { fontFamily: 'system-ui, sans-serif' } as const;

/** A phone wireframe set in the text styles, beside the palette's Write category: one row per style, its glyph, name
 *  and blurb, the Heading row pressed as it is while it is armed. */
export function WriteTextStyles() {
  const rowH = 24;
  const top = 44;
  return (
    <Scene w={420} h={236}>
      {/* The screen: a Title, a Subtitle, a Heading over a Paragraph, a Quote and a Caption. */}
      <rect
        x={18}
        y={14}
        width={150}
        height={208}
        rx={16}
        className="fill-white stroke-slate-300"
        strokeWidth={1.5}
      />
      <Label x={32} y={42} size={18} weight={700} tone="strong">
        Pricing
      </Label>
      <Label x={32} y={62} size={11} tone="body">
        Plans for every team
      </Label>
      <Label x={32} y={90} size={14} weight={700} tone="strong">
        Starter
      </Label>
      {[104, 113, 122].map((y, i) => (
        <rect
          key={y}
          x={32}
          y={y}
          width={i === 2 ? 78 : 118}
          height={5}
          rx={2.5}
          className="fill-slate-200"
        />
      ))}
      <rect x={32} y={138} width={2.5} height={18} rx={1.25} className="fill-brand-400" />
      <text
        x={40}
        y={148}
        fontSize={11}
        fontStyle="italic"
        dominantBaseline="middle"
        className="fill-slate-600"
        style={FONT}
      >
        Set up in a minute.
      </text>
      <rect x={32} y={168} width={122} height={30} rx={6} className="fill-slate-100" />
      <Label x={32} y={209} size={10} tone="muted">
        Billed monthly
      </Label>
      {/* The Write category: its seven text style rows. */}
      <rect
        x={186}
        y={14}
        width={218}
        height={208}
        rx={10}
        className="fill-white stroke-slate-200"
        strokeWidth={1.5}
      />
      <Label x={200} y={31} size={11} weight={600} tone="strong">
        Write
      </Label>
      {STYLES.map((s, i) => {
        const y = top + i * rowH;
        const on = s.name === 'Heading';
        return (
          <g key={s.name}>
            {on && (
              <rect x={192} y={y} width={206} height={rowH - 2} rx={5} className="fill-brand-50" />
            )}
            <rect
              x={200}
              y={y + 5}
              width={12}
              height={12}
              rx={3}
              className={on ? 'fill-brand-100 stroke-brand-500' : 'fill-slate-50 stroke-slate-300'}
              strokeWidth={1.2}
            />
            <Label x={220} y={y + 11} size={11} weight={600} tone={on ? 'accent' : 'strong'}>
              {s.name}
            </Label>
            <Label x={288} y={y + 11} size={10} tone="muted">
              {s.blurb.length > 20 ? `${s.blurb.slice(0, 19)}…` : s.blurb}
            </Label>
          </g>
        );
      })}
    </Scene>
  );
}

/** A selected text's menu open on Text, its flyout on Text Style: each style's name in its own weight and slant, at a
 *  size that keeps the order, its size in px beside it, the Heading the text wears pressed. */
export function TextStyleMenu() {
  const rowH = 22;
  const top = 50;
  return (
    <Scene w={420} h={230}>
      <Label x={24} y={106} size={16} weight={700} tone="strong">
        Starter
      </Label>
      <SelectionBox x={18} y={92} w={84} h={28} />
      <Menu x={118} y={40} w={104} items={['Style', 'Text']} active={1} rowH={24} />
      <Label x={210} y={81} anchor="end" size={11} weight={600} tone="accent">
        ›
      </Label>
      <rect
        x={232}
        y={18}
        width={172}
        height={196}
        rx={8}
        className="fill-white stroke-slate-200"
        strokeWidth={1.5}
      />
      <Label x={246} y={35} size={11} weight={600} tone="strong">
        Text Style
      </Label>
      {STYLES.map((s, i) => {
        const y = top + i * rowH;
        const on = s.name === 'Heading';
        // The menu's own scale: 10 px for the Caption, a px more for every 4 px of the style's size.
        const size = Math.round(10 + (s.px - 12) * 0.25);
        return (
          <g key={s.name}>
            {on && (
              <rect x={238} y={y} width={160} height={rowH - 2} rx={5} className="fill-brand-100" />
            )}
            <text
              x={248}
              y={y + 10}
              fontSize={size}
              fontWeight={s.weight}
              fontStyle={s.italic ? 'italic' : 'normal'}
              dominantBaseline="middle"
              className={on ? 'fill-brand-700' : 'fill-slate-700'}
              style={FONT}
            >
              {s.name}
            </text>
            <Label x={388} y={y + 10} size={10} anchor="end" tone={on ? 'accent' : 'muted'}>
              {s.px}
            </Label>
          </g>
        );
      })}
    </Scene>
  );
}
