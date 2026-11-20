import { Avatar, DiscText, Label } from '@liveworkspace/help-site/art/primitives';
import { Card, Stage, TickDisc } from '@liveworkspace/help-site/art/parts';

// A numbered step disc, sitting on the top edge of its card.
function Step({ cx, cy, n }: { cx: number; cy: number; n: number }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={11} className="fill-brand-500 stroke-white" strokeWidth={2.5} />
      {/* Raised 0.3 units: these heavy numerals stand a touch short of the cap band DiscText centres, and sat
          0.55px low on the help home at its 1.6x scale (the optical audit's 0.5px line). */}
      <DiscText cx={cx} cy={cy - 0.3} size={11} weight={800}>
        {n}
      </DiscText>
    </g>
  );
}

// A small page on the picker: a white sheet, ringed in brand when it is the one picked.
function PageTile({
  x,
  y,
  w,
  h,
  on = false,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  on?: boolean;
}) {
  return (
    <rect
      x={x}
      y={y}
      width={w}
      height={h}
      rx={4}
      className={on ? 'fill-white stroke-brand-500' : 'fill-white stroke-slate-200'}
      strokeWidth={on ? 2 : 1.2}
    />
  );
}

// Getting Started: the first three things a new person does in livedocuments, as three cards on a path. Pick a
// page (an article, a slide or an infographic), write on it, share the link.
export function GettingStartedArt() {
  return (
    <Stage>
      <path
        d="M72 41 Q136 4 200 41 Q264 4 328 41"
        className="fill-none stroke-brand-300"
        strokeWidth={2}
        strokeDasharray="2 6"
        strokeLinecap="round"
      />

      {/* 1: pick a page. A portrait article (picked), a landscape slide with a chart, a square infographic. */}
      <Card x={18} y={52} w={108} h={140} r={12}>
        <PageTile x={28} y={68} w={40} h={56} on />
        <rect x={34} y={75} width={20} height={4} rx={2} className="fill-brand-400" />
        {[0, 1, 2, 3, 4].map((i) => (
          <rect
            key={i}
            x={34}
            y={84 + i * 7}
            width={i === 4 ? 16 : 28}
            height={2.8}
            rx={1.4}
            className="fill-slate-200"
          />
        ))}

        <PageTile x={74} y={68} w={42} h={27} />
        <rect x={79} y={73} width={18} height={3.5} rx={1.7} className="fill-slate-300" />
        {[
          { fill: 'fill-sky-400', h: 10 },
          { fill: 'fill-emerald-400', h: 14 },
          { fill: 'fill-violet-400', h: 7 },
        ].map((bar, i) => (
          <rect
            key={i}
            x={81 + i * 9}
            y={91 - bar.h}
            width={6}
            height={bar.h}
            rx={1.2}
            className={bar.fill}
          />
        ))}

        <PageTile x={74} y={100} w={42} h={42} />
        <Label x={95} y={115} anchor="middle" size={12} weight={800} tone="accent">
          87%
        </Label>
        <rect x={81} y={125} width={28} height={4} rx={2} className="fill-slate-100" />
        <rect x={81} y={125} width={24} height={4} rx={2} className="fill-emerald-400" />
        <rect x={84} y={133} width={22} height={2.8} rx={1.4} className="fill-slate-200" />

        <Label x={72} y={170} anchor="middle" size={10.5} weight={700} tone="strong">
          Pick a page
        </Label>
      </Card>
      <Step cx={72} cy={52} n={1} />

      {/* 2: write it. An article page mid-sentence, the caret at the end of the line, the format bar above. */}
      <Card x={146} y={52} w={108} h={140} r={12}>
        <rect
          x={160}
          y={74}
          width={80}
          height={80}
          rx={4}
          className="fill-white stroke-slate-200"
          strokeWidth={1.2}
        />
        <rect x={168} y={82} width={44} height={6} rx={3} className="fill-slate-700" />
        {[56, 64, 48].map((w, i) => (
          <rect
            key={i}
            x={168}
            y={96 + i * 8}
            width={w}
            height={3.2}
            rx={1.6}
            className="fill-slate-300"
          />
        ))}
        {/* The line being written, its words highlighted, and the caret after them. */}
        <rect x={167} y={118.5} width={36} height={7} rx={1.5} className="fill-brand-100" />
        <rect x={168} y={120.5} width={34} height={3.2} rx={1.6} className="fill-brand-500" />
        <line x1={206} y1={117} x2={206} y2={127} className="stroke-brand-600" strokeWidth={1.5} />
        {[44, 30].map((w, i) => (
          <rect
            key={i}
            x={168}
            y={134 + i * 8}
            width={w}
            height={3.2}
            rx={1.6}
            className="fill-slate-200"
          />
        ))}
        {/* The format bar: bold, italic, a heading, a link. */}
        <g className="help-art-as-drawn">
          <rect x={164} y={98} width={68} height={16} rx={5} className="fill-slate-800" />
          <Label x={174} y={106.5} anchor="middle" size={8.5} weight={800} tone="onAccent">
            B
          </Label>
          <text
            x={188}
            y={106.5}
            fontSize={8.5}
            fontWeight={600}
            fontStyle="italic"
            textAnchor="middle"
            dominantBaseline="middle"
            className="fill-white"
            style={{ fontFamily: 'system-ui, sans-serif' }}
          >
            I
          </text>
          <Label x={204} y={106.5} anchor="middle" size={8} weight={700} tone="onAccent">
            H1
          </Label>
          <path
            d="M217 106.5 a2.4 2.4 0 0 1 2.4 -2.4 h2.4 M225 106.5 a2.4 2.4 0 0 1 -2.4 2.4 h-2.4 M219 106.5 h4.6"
            className="fill-none stroke-white"
            strokeWidth={1.2}
            strokeLinecap="round"
          />
        </g>
        <Label x={200} y={170} anchor="middle" size={10.5} weight={700} tone="strong">
          Write it
        </Label>
      </Card>
      <Step cx={200} cy={52} n={2} />

      {/* 3: share the link. */}
      <Card x={274} y={52} w={108} h={140} r={12}>
        <rect
          x={284}
          y={76}
          width={88}
          height={22}
          rx={6}
          className="fill-slate-50 stroke-slate-200"
          strokeWidth={1.2}
        />
        <path
          d="M291 87 a3 3 0 0 1 3 -3 h3 M301 87 a3 3 0 0 1 -3 3 h-3 M293 87 h6"
          className="fill-none stroke-brand-500"
          strokeWidth={1.4}
          strokeLinecap="round"
        />
        <rect x={306} y={84.5} width={54} height={5} rx={2.5} className="fill-slate-300" />
        <rect x={292} y={106} width={72} height={20} rx={6} className="fill-brand-500" />
        <Label x={328} y={116.5} anchor="middle" size={9.5} weight={700} tone="onAccent">
          Copy link
        </Label>
        <Avatar cx={302} cy={145} r={9} initial="A" colour="emerald" />
        <Avatar cx={316} cy={145} r={9} initial="T" colour="violet" />
        <Avatar cx={330} cy={145} r={9} initial="R" colour="rose" />
        <TickDisc cx={356} cy={145} r={8} />
        <Label x={328} y={170} anchor="middle" size={10.5} weight={700} tone="strong">
          Share it
        </Label>
      </Card>
      <Step cx={328} cy={52} n={3} />
    </Stage>
  );
}
