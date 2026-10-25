import { Label } from '@/components/illustrations/primitives';
import { Chip, Stage, Window } from './parts';

// About liveplanner: what it is in one picture. Three windows fanned out, one per kind of tab (a board of cards, a
// sheet of rows, a form to fill in), under the two promises: free, and no trackers.
export function AboutArt() {
  return (
    <Stage>
      {/* Board: cards in columns, tilted back on the left. */}
      <g transform="rotate(-7 92 120)">
        <Window x={18} y={52} w={150} h={118} title="Board">
          {[0, 1, 2].map((c) => (
            <g key={c}>
              <rect
                x={28 + c * 46}
                y={84}
                width={40}
                height={6}
                rx={3}
                className={['fill-violet-300', 'fill-amber-300', 'fill-emerald-300'][c]}
              />
              {[0, 1, 2].slice(0, 3 - c).map((r) => (
                <rect
                  key={r}
                  x={28 + c * 46}
                  y={96 + r * 22}
                  width={40}
                  height={18}
                  rx={4}
                  className="fill-white stroke-slate-200"
                  strokeWidth={1.2}
                />
              ))}
            </g>
          ))}
        </Window>
      </g>
      {/* Form: questions to fill in, tilted forward on the right. */}
      <g transform="rotate(7 308 120)">
        <Window x={232} y={52} w={150} h={118} title="Form">
          {[0, 1].map((i) => (
            <g key={i}>
              <rect
                x={246}
                y={84 + i * 28}
                width={i === 0 ? 50 : 36}
                height={4}
                rx={2}
                className="fill-slate-400"
              />
              <rect
                x={246}
                y={92 + i * 28}
                width={120}
                height={12}
                rx={3}
                className="fill-white stroke-slate-200"
                strokeWidth={1.2}
              />
            </g>
          ))}
          <rect x={246} y={144} width={52} height={16} rx={5} className="fill-brand-500" />
          <rect
            x={256}
            y={150}
            width={32}
            height={4}
            rx={2}
            className="fill-white help-art-as-drawn"
          />
        </Window>
      </g>
      {/* Sheet: in front, in the middle. A header row, rows of figures and a status column. */}
      <Window x={110} y={40} w={180} h={140} title="Sheet">
        <rect x={122} y={72} width={156} height={16} rx={3} className="fill-brand-100" />
        {[0, 1, 2].map((c) => (
          <rect
            key={c}
            x={130 + c * 52}
            y={78}
            width={30}
            height={4}
            rx={2}
            className="fill-brand-400"
          />
        ))}
        {[0, 1, 2, 3].map((r) => {
          const y = 88 + r * 20;
          return (
            <g key={r}>
              <line
                x1={122}
                y1={y + 20}
                x2={278}
                y2={y + 20}
                className="stroke-slate-200"
                strokeWidth={1}
              />
              <rect
                x={130}
                y={y + 8}
                width={[36, 28, 40, 24][r]}
                height={4}
                rx={2}
                className="fill-slate-300"
              />
              <rect x={182} y={y + 8} width={22} height={4} rx={2} className="fill-slate-300" />
              <rect
                x={234}
                y={y + 6}
                width={32}
                height={8}
                rx={4}
                className={
                  ['fill-emerald-300', 'fill-amber-300', 'fill-emerald-300', 'fill-sky-300'][r]
                }
              />
            </g>
          );
        })}
        <line x1={174} y1={72} x2={174} y2={168} className="stroke-slate-200" strokeWidth={1} />
        <line x1={226} y1={72} x2={226} y2={168} className="stroke-slate-200" strokeWidth={1} />
      </Window>

      <Chip x={118} y={12} label="Free for everyone" tone="emerald" h={20} size={10} />
      <Chip x={236} y={12} label="No trackers" tone="violet" h={20} size={10} />
      <Label x={200} y={204} anchor="middle" size={9} weight={600} tone="muted">
        Boards · Sheets · Dashboards · Forms
      </Label>
    </Stage>
  );
}
