import type { ReactElement } from 'react';
import type { TemplateKind } from '@livedesign/templates';
import { pv } from '@liveworkspace/template-previews/motion';

// Group brand: the Brand Board (docs/specs/007-editor/logo-pages.md "Branding templates"). Static SVG preview tile,
// drawn from the board's own pages: the logo, the mark and its icons, the colours, the type and the logo on dark,
// in the brand's teal, coral and sand. Hover story: each page lights in turn, the board's order.
const TEAL = 'rgb(15 76 92)';
const CORAL = 'rgb(255 107 74)';
const SAND = 'rgb(244 236 223)';
const INK = 'rgb(20 33 61)';
const LINE = 'rgb(203 213 225)';

// The mark: a back disc and a coral one over it.
function Mark({ x, y, r, back = TEAL }: { x: number; y: number; r: number; back?: string }) {
  return (
    <>
      <circle cx={x} cy={y} r={r} fill={back} />
      <circle cx={x + r * 1.2} cy={y} r={r} fill={CORAL} />
    </>
  );
}

// An artboard, lit on hover `at` ms into the story.
type BoardProps = { x: number; y: number; w: number; h: number; fill?: string; at: number };
function Board({ x, y, w, h, fill = 'white', at }: BoardProps) {
  return (
    <rect
      x={x}
      y={y}
      width={w}
      height={h}
      rx="1"
      fill={fill}
      stroke={fill === 'white' ? LINE : fill}
      strokeWidth="0.6"
      className="pv-pulse"
      style={pv({ '--pv-at': `${at}ms` })}
    />
  );
}

export function templatePreviewGroupBrand(kind: TemplateKind): ReactElement | null {
  if (kind !== 'logo-brand-board') return null;
  return (
    <svg width="80" height="50" viewBox="0 0 80 50" aria-hidden>
      {/* 01 Logo: the lockup, large, across the top left. */}
      <Board x={3} y={3} w={36} h={21} at={200} />
      <Mark x={10} y={13.5} r={2.6} />
      <rect x="16.5" y="11.3" width="16" height="3.2" rx="0.8" fill={INK} />
      <rect x="16.5" y="16" width="11" height="1.3" rx="0.5" fill="rgb(75 85 99)" />
      {/* 02 Mark and icons: the app tile and two favicons. */}
      <Board x={41} y={3} w={36} h={21} at={420} />
      <Mark x={48} y={10.5} r={3} />
      <rect x="58" y="7" width="8" height="8" rx="2" fill={TEAL} />
      <Mark x={60.6} y={11} r={1.3} back={SAND} />
      <rect x="68.5" y="10" width="4" height="4" rx="1" fill={TEAL} />
      <rect x="73.5" y="11.5" width="2" height="2" rx="0.5" fill={TEAL} />
      <rect x="47" y="18" width="24" height="1.2" rx="0.5" fill={LINE} />
      {/* 03 Colours: four swatches. */}
      <Board x={3} y={26} w={24} h={21} at={640} />
      {[TEAL, CORAL, SAND, INK].map((fill, i) => (
        <rect
          key={fill}
          x={5.5 + (i % 2) * 10}
          y={28.5 + Math.floor(i / 2) * 8.5}
          width="9"
          height="7"
          rx="1.2"
          fill={fill}
          stroke={fill === SAND ? 'rgb(214 207 194)' : fill}
          strokeWidth="0.4"
        />
      ))}
      {/* 04 Type: the heading face large, then the specimen lines. */}
      <Board x={29} y={26} w={24} h={21} at={860} />
      <rect x="31.5" y="29.5" width="12" height="6.5" rx="1.2" fill={INK} />
      <rect x="31.5" y="40" width="18" height="1.3" rx="0.5" fill={INK} />
      <rect x="31.5" y="42.8" width="14" height="1.1" rx="0.5" fill={LINE} />
      {/* 05 On dark: the lockup reversed on ink. */}
      <Board x={55} y={26} w={22} h={21} fill={INK} at={1080} />
      <Mark x={60} y={36.5} r={2} back={SAND} />
      <rect x="65" y="35" width="9" height="2.6" rx="0.7" fill={SAND} />
    </svg>
  );
}
