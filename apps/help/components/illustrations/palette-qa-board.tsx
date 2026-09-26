// The Q&A board's help scene (docs/specs/018-help/help-app.md, drawing docs/specs/012-collaboration/qa-board.md): the spotlight over a
// ranked queue, the top row marked Most wanted, a vote of your own filled in,
// and heat bars measuring each row against the top.

import { Scene, Label } from './primitives';
import { CollabCard } from './palette-collaborate';

const ROWS: { text: string; votes: number; mine?: boolean }[] = [
  { text: 'How do we measure success?', votes: 9, mine: true },
  { text: 'Who owns the rollout?', votes: 5 },
  { text: 'Can we pilot with one team first?', votes: 2 },
];

export function QaBoardCard() {
  const x = 90;
  const y = 10;
  const w = 240;
  const max = ROWS[0]!.votes;
  return (
    <Scene w={420} h={250}>
      <CollabCard x={x} y={y} w={w} h={228} title="Questions for the panel" aside="5 notes">
        {/* The spotlight */}
        <rect
          x={x + 12}
          y={y + 38}
          width={w - 24}
          height={46}
          rx={10}
          className="fill-brand-50 stroke-brand-400"
          strokeWidth={1.5}
        />
        <circle cx={x + 24} cy={y + 50} r={3} className="fill-brand-500" />
        <Label x={x + 32} y={y + 53} size={7.5} weight={700} tone="accent">
          NOW DISCUSSING
        </Label>
        <Label x={x + 22} y={y + 72} size={10} weight={700} tone="strong">
          What does launch look like?
        </Label>
        {ROWS.map((r, i) => {
          const ry = y + 94 + i * 42;
          const top = i === 0;
          return (
            <g key={r.text}>
              <rect
                x={x + 12}
                y={ry}
                width={w - 24}
                height={36}
                rx={9}
                className={
                  top ? 'fill-brand-50 stroke-brand-200' : 'fill-slate-50 stroke-slate-200'
                }
                strokeWidth={1.2}
              />
              <rect
                x={x + 18}
                y={ry + 5}
                width={24}
                height={26}
                rx={7}
                className={r.mine ? 'fill-brand-500' : 'fill-white stroke-slate-300'}
                strokeWidth={1.2}
              />
              <path
                d={`M ${x + 26} ${ry + 15} l 4 -4 l 4 4`}
                fill="none"
                strokeWidth={1.5}
                strokeLinecap="round"
                className={r.mine ? 'stroke-white' : 'stroke-slate-500'}
              />
              <Label
                x={x + 30}
                y={ry + 27}
                anchor="middle"
                size={9}
                weight={700}
                tone={r.mine ? 'onAccent' : 'body'}
              >
                {String(r.votes)}
              </Label>
              {top ? (
                <Label x={x + 50} y={ry + 13} size={6.5} weight={700} tone="accent">
                  MOST WANTED
                </Label>
              ) : null}
              <Label x={x + 50} y={ry + (top ? 25 : 21)} size={9} weight={600} tone="body">
                {r.text}
              </Label>
              {/* The heat bar: this row's share of the top row's votes. */}
              <rect
                x={x + 12}
                y={ry + 34}
                width={((w - 24) * r.votes) / max}
                height={2}
                rx={1}
                className="fill-brand-400"
              />
            </g>
          );
        })}
      </CollabCard>
    </Scene>
  );
}
