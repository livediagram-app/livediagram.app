import { Label } from '@liveworkspace/help-site/art/primitives';
import { Chip, Stage, Window } from '@liveworkspace/help-site/art/parts';

// About livedocuments: what it is in one picture. Three windows fanned out, one per kind of page (a slide, an article,
// an infographic), under the two promises: free, and open source.
export function AboutArt() {
  return (
    <Stage>
      {/* A slide: a title and a bar chart, tilted back on the left. */}
      <g transform="rotate(-7 92 120)">
        <Window x={18} y={52} w={150} h={118} title="Slide">
          <rect x={30} y={84} width={126} height={74} rx={4} className="fill-slate-50" />
          <rect x={40} y={94} width={66} height={7} rx={3.5} className="fill-slate-700" />
          <rect x={40} y={107} width={44} height={4} rx={2} className="fill-slate-300" />
          {[18, 30, 22, 38].map((h, i) => (
            <rect
              key={i}
              x={92 + i * 14}
              y={150 - h}
              width={9}
              height={h}
              rx={1.5}
              className={i === 3 ? 'fill-violet-400' : 'fill-violet-200'}
            />
          ))}
        </Window>
      </g>
      {/* An infographic: a bold page, tilted forward on the right. */}
      <g transform="rotate(7 308 120)">
        <Window x={232} y={52} w={150} h={118} title="Infographic">
          <rect x={244} y={84} width={126} height={74} rx={6} className="fill-brand-500" />
          <rect
            x={254}
            y={96}
            width={70}
            height={7}
            rx={3.5}
            className="fill-white help-art-as-drawn"
          />
          <rect x={254} y={110} width={50} height={4} rx={2} className="fill-brand-200" />
          <circle cx={346} cy={136} r={14} className="fill-amber-300" />
          <rect x={254} y={136} width={34} height={14} rx={3} className="fill-brand-600" />
        </Window>
      </g>
      {/* An article: in front, in the middle, a heading and lines of text. */}
      <Window x={110} y={40} w={180} h={140} title="Article">
        <rect x={126} y={76} width={86} height={8} rx={4} className="fill-brand-500" />
        {[0, 1, 2, 3].map((i) => (
          <rect
            key={i}
            x={126}
            y={94 + i * 11}
            width={i === 3 ? 96 : 148}
            height={4.5}
            rx={2.2}
            className="fill-slate-200"
          />
        ))}
        <rect
          x={126}
          y={140}
          width={148}
          height={28}
          rx={4}
          className="fill-emerald-50 stroke-emerald-200"
          strokeWidth={1.2}
        />
      </Window>

      <Chip x={118} y={12} label="Free for everyone" tone="emerald" h={20} size={10} />
      <Chip x={236} y={12} label="Open source" tone="violet" h={20} size={10} />
      <Label x={200} y={204} anchor="middle" size={9} weight={600} tone="muted">
        Articles · Slides · Infographics
      </Label>
    </Stage>
  );
}
