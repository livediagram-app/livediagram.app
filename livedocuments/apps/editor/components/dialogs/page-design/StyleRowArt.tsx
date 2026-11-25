'use client';

// Tab Style's home pictures for Text and Finish in livedocuments (docs/specs/011-theme/canvas-and-theme-dialog.md
// "Page Design"): each a small page in the tab's colours, as the Design and Background rows' are. Text sets a heading
// in the tab's typeface over lines of writing; Finish draws two boxes and an arrow the way the finish draws shapes.
import { resolveFontStack } from '@liveworkspace/model-core/fonts';
import { designPalette, type DesignTheme, type Finish, type Page } from '@livedocuments/document';

type Paint = { theme: DesignTheme; page: Pick<Page, 'background'>; paperDark: boolean };

const W = 64;
const H = 36;

function paletteOf({ theme, page, paperDark }: Paint) {
  return designPalette(theme, page, paperDark);
}

/** Text: "Aa" in the tab's typeface, with lines of writing under it. */
export function TextRowArt({ font, ...paint }: Paint & { font: string | null }) {
  const p = paletteOf(paint);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 h-full w-full" aria-hidden="true">
      <rect width={W} height={H} fill={p.base} />
      <text
        x={7}
        y={19}
        fill={p.ink}
        style={{ fontFamily: resolveFontStack(font), fontSize: 15, fontWeight: 700 }}
      >
        Aa
      </text>
      <rect x={31} y={9} width={26} height={2.5} rx={1.25} fill={p.a} />
      <rect x={31} y={14.5} width={20} height={2} rx={1} fill={p.ink} opacity={0.25} />
      <rect x={7} y={24} width={50} height={2} rx={1} fill={p.ink} opacity={0.25} />
      <rect x={7} y={28.5} width={38} height={2} rx={1} fill={p.ink} opacity={0.25} />
    </svg>
  );
}

// How each finish draws: corner rounding, stroke weight, and a hand-drawn wobble (Sketch) or a felt-tip's colouring
// in (Marker).
const STROKE: Record<Finish, { rx: number; width: number }> = {
  flexible: { rx: 4, width: 1.4 },
  professional: { rx: 0.5, width: 1 },
  sketch: { rx: 1.5, width: 1.1 },
  marker: { rx: 2, width: 2.4 },
};

// A box drawn by hand: its edges bow a little and the pen overshoots the corners.
function sketchBox(x: number, y: number, w: number, h: number): string {
  return [
    `M${x - 1} ${y + 0.4} Q${x + w / 2} ${y - 1} ${x + w + 1} ${y + 0.2}`,
    `M${x + w + 0.2} ${y - 0.8} Q${x + w + 1} ${y + h / 2} ${x + w - 0.2} ${y + h + 1}`,
    `M${x + w + 0.8} ${y + h - 0.3} Q${x + w / 2} ${y + h + 1} ${x - 0.8} ${y + h}`,
    `M${x + 0.3} ${y + h + 0.8} Q${x - 0.8} ${y + h / 2} ${x + 0.4} ${y - 1}`,
  ].join(' ');
}

/** Finish: two boxes joined by an arrow, drawn in the finish. */
export function FinishRowArt({ finish, ...paint }: Paint & { finish: Finish }) {
  const p = paletteOf(paint);
  const s = STROKE[finish] ?? STROKE.flexible;
  const box = (x: number, colour: string) =>
    finish === 'sketch' ? (
      <path
        d={sketchBox(x, 10, 18, 16)}
        fill="none"
        stroke={colour}
        strokeWidth={s.width}
        strokeLinecap="round"
      />
    ) : (
      <>
        {finish === 'marker' ? (
          <rect x={x + 2} y={13} width={14} height={10} rx={1} fill={colour} opacity={0.25} />
        ) : null}
        <rect
          x={x}
          y={10}
          width={18}
          height={16}
          rx={s.rx}
          fill={finish === 'marker' ? 'none' : colour}
          fillOpacity={finish === 'marker' ? undefined : 0.15}
          stroke={colour}
          strokeWidth={s.width}
          strokeLinejoin={finish === 'professional' ? 'miter' : 'round'}
        />
      </>
    );
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 h-full w-full" aria-hidden="true">
      <rect width={W} height={H} fill={p.base} />
      {box(7, p.a)}
      {box(39, p.b)}
      <path
        d={finish === 'sketch' ? 'M26.5 18.4 Q31 17.2 36 18.2' : 'M26.5 18 H36'}
        fill="none"
        stroke={p.ink}
        strokeWidth={Math.max(1, s.width * 0.8)}
        strokeLinecap={finish === 'professional' ? 'butt' : 'round'}
      />
      <path
        d="M33.5 15.5 L36.5 18 L33.5 20.5"
        fill="none"
        stroke={p.ink}
        strokeWidth={Math.max(1, s.width * 0.8)}
        strokeLinecap="round"
        strokeLinejoin={finish === 'professional' ? 'miter' : 'round'}
      />
    </svg>
  );
}
