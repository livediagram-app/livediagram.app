import { Label } from '@liveworkspace/help-site/art/primitives';
import { Chip, Stage, Window } from '@liveworkspace/help-site/art/parts';
import { Character } from './character';

// About livehuddle: what it is in one picture. Three windows fanned out, one per part of a meeting in a Space (the
// day's sticky notes on the wall, the team round its table, a Timer on the wall), under the two promises: free, and
// open source.

export function AboutArt() {
  return (
    <Stage>
      {/* Notes: the day's sticky notes on the wall, tilted back on the left. */}
      <g transform="rotate(-7 92 120)">
        <Window x={18} y={52} w={150} h={118} title="Notes">
          {[0, 1, 2, 3, 4, 5].map((n) => (
            <rect
              key={n}
              x={30 + (n % 3) * 44}
              y={86 + Math.floor(n / 3) * 40}
              width={36}
              height={32}
              rx={2}
              className={['fill-amber-200', 'fill-sky-200', 'fill-rose-200'][n % 3]}
            />
          ))}
        </Window>
      </g>
      {/* Timer: the meeting's countdown, tilted forward on the right. */}
      <g transform="rotate(7 308 120)">
        <Window x={232} y={52} w={150} h={118} title="Timer">
          <circle cx={307} cy={120} r={30} className="fill-none stroke-slate-200" strokeWidth={6} />
          <path
            d="M307 90a30 30 0 1 1 -30 30"
            className="fill-none stroke-brand-500"
            strokeWidth={6}
            strokeLinecap="round"
          />
          <Label x={307} y={124} anchor="middle" size={11} weight={600} tone="strong">
            5:00
          </Label>
        </Window>
      </g>
      {/* The Space: in front, in the middle, the team gathered round the meeting table. */}
      <Window x={110} y={40} w={180} h={140} title="Team Pod">
        <rect
          x={120}
          y={70}
          width={160}
          height={100}
          rx={3}
          className="fill-amber-50 stroke-slate-300"
          strokeWidth={2}
        />
        <rect
          x={170}
          y={100}
          width={60}
          height={36}
          rx={4}
          className="fill-slate-200 stroke-slate-400"
          strokeWidth={1.2}
        />
        <Character x={160} y={110} shirt="fill-brand-500" />
        <Character x={240} y={110} shirt="fill-violet-400" />
        <Character x={186} y={146} shirt="fill-rose-400" />
        <Character x={214} y={146} shirt="fill-amber-400" />
        <Character x={200} y={86} shirt="fill-sky-400" />
      </Window>

      <Chip x={118} y={12} label="Free for everyone" tone="emerald" h={20} size={10} />
      <Chip x={236} y={12} label="Open source" tone="violet" h={20} size={10} />
      <Label x={200} y={204} anchor="middle" size={9} weight={600} tone="muted">
        Meet · Talk · Keep Time
      </Label>
    </Stage>
  );
}
