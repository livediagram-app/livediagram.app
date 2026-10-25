import { Label } from '@liveworkspace/help-site/art/primitives';
import { Chip, Stage, Window } from '@liveworkspace/help-site/art/parts';

// About livedesign: what it is in one picture. Three windows fanned out, one per kind of page (a logo, a
// wireframe, a photo), under the two promises: free, and open source.
export function AboutArt() {
  return (
    <Stage>
      {/* A logo: a mark over its wordmark, tilted back on the left. */}
      <g transform="rotate(-7 92 120)">
        <Window x={18} y={52} w={150} h={118} title="Logo">
          <rect x={30} y={84} width={126} height={74} rx={4} className="fill-slate-50" />
          <circle cx={93} cy={108} r={16} className="fill-violet-400" />
          <path d="M84 116 L93 100 L102 116 Z" className="fill-white help-art-as-drawn" />
          <rect x={68} y={134} width={50} height={7} rx={3.5} className="fill-slate-700" />
          <rect x={78} y={146} width={30} height={4} rx={2} className="fill-slate-300" />
        </Window>
      </g>
      {/* A photo: a landscape picture, tilted forward on the right. */}
      <g transform="rotate(7 308 120)">
        <Window x={232} y={52} w={150} h={118} title="Photo">
          <rect x={244} y={84} width={126} height={74} rx={4} className="fill-sky-200" />
          <circle cx={346} cy={102} r={10} className="fill-amber-300" />
          <path d="M244 158 L282 116 L310 140 L332 124 L370 158 Z" className="fill-emerald-500" />
          <rect
            x={252}
            y={92}
            width={48}
            height={30}
            rx={2}
            className="fill-none stroke-brand-600"
            strokeWidth={1.2}
            strokeDasharray="3 2"
          />
        </Window>
      </g>
      {/* A wireframe: in front, in the middle, a phone screen. */}
      <Window x={110} y={40} w={180} h={140} title="Wireframe">
        <rect x={170} y={70} width={60} height={104} rx={9} className="fill-slate-800" />
        <rect x={174} y={74} width={52} height={96} rx={6} className="fill-white" />
        <rect x={180} y={84} width={30} height={5} rx={2.5} className="fill-brand-500" />
        <rect x={180} y={95} width={40} height={26} rx={3} className="fill-emerald-50" />
        {[0, 1].map((i) => (
          <rect
            key={i}
            x={180}
            y={128 + i * 8}
            width={i === 1 ? 26 : 40}
            height={4}
            rx={2}
            className="fill-slate-200"
          />
        ))}
        <rect x={180} y={154} width={40} height={9} rx={4.5} className="fill-brand-500" />
      </Window>

      <Chip x={118} y={12} label="Free for everyone" tone="emerald" h={20} size={10} />
      <Chip x={236} y={12} label="Open source" tone="violet" h={20} size={10} />
      <Label x={200} y={204} anchor="middle" size={9} weight={600} tone="muted">
        Logos · Wireframes · Photos
      </Label>
    </Stage>
  );
}
