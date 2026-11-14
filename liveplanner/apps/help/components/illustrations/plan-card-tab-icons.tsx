// A card type's tab icons (docs/specs/026-plan/item-types.md "Tab icons"), re-exported from ./plan: on the left the
// type editor's Design tab group, its icon button open on the glyph picker with Reset To Default; on the right the
// card panel's tab strip, each tab's icon before its name. The labels are the editor's own (TabGlyphButton,
// ItemPanelTabs). The glyphs are the Plan glyph set's own paths (packages/items/src/glyphs.ts), drawn at 16 units.

import { Scene, Label } from '@liveworkspace/help-site/art/primitives';

const GLYPH = {
  page: 'M3.5 1.5h6l3 3v10h-9ZM9.5 1.5v3h3M5.5 8h5M5.5 10.5h5',
  kanban: 'M2.5 2.5h11v11h-11ZM4.5 4.5v5M8 4.5v7M11.5 4.5v3',
  code: 'M5.5 4 1.5 8l4 4M10.5 4l4 4-4 4M9 2.5 7 13.5',
  risk: 'M8 2 14.5 13.5h-13ZM8 6.5v3.2M8 11.6v.1',
  clock: 'M8 14.5a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13ZM8 4.5V8l2.5 1.5',
  checklist: 'M2 4l1 1 2-2M2 9l1 1 2-2M7 4h7M7 9h7M7 13h7M2.5 13h1',
  bug: 'M5.5 6.5h5v5a2.5 2.5 0 0 1-5 0ZM6 6.5a2 2 0 0 1 4 0M3 8.5h2.5M10.5 8.5H13M3.5 12l2-1M12.5 12l-2-1M8 6.5v7',
  wrench:
    'M10.5 2a3.5 3.5 0 0 0-3.3 4.6L2.3 11.5a1.4 1.4 0 0 0 2 2l4.9-4.9A3.5 3.5 0 0 0 14 5.5l-2 2-2-.5-.5-2 2-2a3.5 3.5 0 0 0-1-.5Z',
  laptop: 'M3 3.5h10v7H3ZM1.5 12.5h13',
  database:
    'M2.5 3.5c0-1.1 2.5-2 5.5-2s5.5.9 5.5 2-2.5 2-5.5 2-5.5-.9-5.5-2Zm0 0v9c0 1.1 2.5 2 5.5 2s5.5-.9 5.5-2v-9M2.5 8c0 1.1 2.5 2 5.5 2s5.5-.9 5.5-2',
} as const;

// A Plan glyph at (x, y), `size` units square, stroked in the class given.
function Glyph({
  id,
  x,
  y,
  size = 12,
  className = 'stroke-slate-500',
}: {
  id: keyof typeof GLYPH;
  x: number;
  y: number;
  size?: number;
  className?: string;
}) {
  return (
    <g transform={`translate(${x} ${y}) scale(${size / 16})`}>
      <path
        d={GLYPH[id]}
        fill="none"
        className={className}
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </g>
  );
}

/** The Design tab's icon chosen in the type editor, and the card panel's tabs each wearing theirs. */
export function PlanCardTabIconsScene() {
  const tabs = [
    { label: 'Overview', glyph: 'page' as const, x: 236 },
    { label: 'Design', glyph: 'code' as const, x: 300, on: true },
    { label: 'Risks', glyph: 'risk' as const, x: 358 },
  ];
  const tiles: (keyof typeof GLYPH)[] = ['bug', 'code', 'wrench', 'laptop', 'database', 'kanban'];
  return (
    <Scene w={420} h={230} bg="plain">
      {/* The type editor: the Design tab's group, its icon button pressed. */}
      <rect
        x={10}
        y={12}
        width={196}
        height={44}
        rx={10}
        className="fill-slate-50 stroke-slate-200"
        strokeWidth={1.5}
      />
      <rect x={20} y={24} width={20} height={20} rx={5} className="fill-brand-100" />
      <Glyph id="code" x={24} y={28} className="stroke-brand-700" />
      <path
        d="M44 32l3 3 3-3"
        fill="none"
        className="stroke-slate-400"
        strokeWidth={1.4}
        strokeLinecap="round"
      />
      <Label x={58} y={38} size={12} weight={700} tone="strong">
        Design
      </Label>
      <rect x={110} y={28} width={30} height={14} rx={7} className="fill-slate-200" />
      <Label x={125} y={38} size={9} weight={500} anchor="middle" tone="body">
        Tab
      </Label>
      {/* The glyph picker under it. */}
      <rect
        x={10}
        y={64}
        width={196}
        height={156}
        rx={10}
        className="fill-white stroke-slate-200"
        strokeWidth={1.5}
      />
      <rect
        x={20}
        y={74}
        width={176}
        height={22}
        rx={6}
        className="fill-white stroke-slate-300"
        strokeWidth={1}
      />
      <Label x={30} y={88} size={10} tone="muted">
        Search glyphs
      </Label>
      <Label x={20} y={114} size={9} weight={700} tone="muted">
        DESIGN ICON
      </Label>
      {tiles.map((g, i) => {
        const x = 20 + i * 30;
        const chosen = g === 'code';
        return (
          <g key={g}>
            <rect
              x={x}
              y={122}
              width={26}
              height={26}
              rx={6}
              className={chosen ? 'fill-brand-100 stroke-brand-500' : 'fill-slate-50'}
              strokeWidth={chosen ? 1.2 : 0}
            />
            <Glyph
              id={g}
              x={x + 5}
              y={127}
              size={16}
              className={chosen ? 'stroke-brand-700' : 'stroke-slate-500'}
            />
          </g>
        );
      })}
      <line x1={20} y1={164} x2={196} y2={164} className="stroke-slate-200" strokeWidth={1} />
      {/* Reset To Default, while the icon isn't the default. */}
      <path
        d="M85 186a6 6 0 1 0 2-5M85 178v4h4"
        fill="none"
        className="stroke-slate-500"
        strokeWidth={1.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Label x={102} y={190} size={11} weight={600} tone="body">
        Reset To Default
      </Label>

      {/* The card panel: its tab strip, each tab's icon before its name. */}
      <rect
        x={222}
        y={12}
        width={188}
        height={208}
        rx={12}
        className="fill-white stroke-slate-200"
        strokeWidth={1.5}
      />
      <Label x={234} y={40} size={13} weight={700} tone="strong">
        Redesign checkout
      </Label>
      <line x1={232} y1={70} x2={400} y2={70} className="stroke-slate-200" strokeWidth={1} />
      {tabs.map((t) => (
        <g key={t.label}>
          <Glyph
            id={t.glyph}
            x={t.x}
            y={55}
            size={11}
            className={t.on ? 'stroke-brand-600' : 'stroke-slate-400'}
          />
          <Label x={t.x + 14} y={64} size={10} weight={500} tone={t.on ? 'accent' : 'muted'}>
            {t.label}
          </Label>
          {t.on ? (
            <rect x={t.x} y={69} width={50} height={2} rx={1} className="fill-brand-600" />
          ) : null}
        </g>
      ))}
      {/* The Design tab's fields. */}
      {[92, 128, 164].map((y, i) => (
        <g key={y}>
          <Label x={234} y={y} size={10} weight={600} tone="body">
            {['Mock-ups', 'Design Review', 'Hand-off'][i]}
          </Label>
          <rect x={234} y={y + 6} width={164} height={16} rx={4} className="fill-slate-50" />
        </g>
      ))}
      <Glyph id="clock" x={234} y={198} size={10} className="stroke-slate-400" />
      <Glyph id="checklist" x={248} y={198} size={10} className="stroke-slate-400" />
      <Label x={264} y={206} size={9} tone="muted">
        Activity and Details too
      </Label>
    </Scene>
  );
}
