// The History illustration for the History article (docs/specs/018-help/help-app.md; drawing
// livediagram/docs/specs/013-workspace/history.md "The dialog" and liveworkspace/docs/specs/004-index/footer-tools-menu.md
// "History, with Snapshots in it"). Real labels from the shared Explorer's HistoryParts.tsx (History, Today) and
// @liveworkspace/snapshots' snapshot-parts.tsx (Take Snapshot): the At a Glance card with its faces and 14-day bars,
// the rail of who changed what, a snapshot pinned on it, and Take Snapshot at the foot.

import { Avatar, Button, Label, Scene } from '@liveworkspace/help-site/art/primitives';

const BARS = [2, 0, 1, 3, 0, 0, 2, 4, 1, 0, 3, 5, 2, 6];

type Entry = {
  y: number;
  who: string;
  colour: 'emerald' | 'violet' | 'amber';
  what: string;
  when: string;
};

const ENTRIES: Entry[] = [
  { y: 150, who: 'You', colour: 'emerald', what: 'Design Edited', when: '14:32' },
  { y: 206, who: 'Sam', colour: 'violet', what: 'Design Renamed', when: '11:05' },
];

/** History inside Tools: the At a Glance card, then the rail with a snapshot pinned on it, and Take Snapshot. */
export function HistoryScene() {
  return (
    <Scene w={420} h={290} bg="plain">
      <rect
        x={16}
        y={8}
        width={388}
        height={274}
        rx={12}
        className="fill-white stroke-slate-200"
        strokeWidth={2}
      />
      <Label x={32} y={28} size={13} weight={700} tone="strong">
        Brand Refresh
      </Label>
      <Label x={32} y={44} size={10} tone="muted">
        History
      </Label>
      <rect
        x={32}
        y={56}
        width={356}
        height={66}
        rx={9}
        className="fill-slate-50 stroke-slate-200"
        strokeWidth={1.5}
      />
      <Label x={44} y={72} size={11} weight={700} tone="strong">
        Changed 12 mins ago
      </Label>
      <Avatar cx={318} cy={72} r={9} initial="Y" colour="emerald" />
      <Avatar cx={334} cy={72} r={9} initial="S" colour="violet" />
      <Avatar cx={350} cy={72} r={9} initial="A" colour="amber" />
      <Label x={44} y={88} size={10} tone="body">
        Created 3 Nov 2026 · 29 events
      </Label>
      {BARS.map((b, i) => (
        <rect
          key={i}
          x={44 + i * 24}
          y={114 - b * 3 - 1}
          width={14}
          height={b * 3 + 1}
          rx={2}
          className={i === BARS.length - 1 ? 'fill-brand-500' : 'fill-slate-300'}
        />
      ))}
      <Label x={32} y={138} size={10} weight={700} tone="muted">
        Today
      </Label>
      <line x1={46} y1={146} x2={46} y2={240} className="stroke-slate-200" strokeWidth={2} />
      {ENTRIES.map((e) => (
        <g key={e.what}>
          <circle cx={46} cy={e.y + 8} r={7} className="fill-emerald-400" />
          <Avatar cx={70} cy={e.y + 8} r={8} initial={e.who[0]} colour={e.colour} />
          <Label x={84} y={e.y + 4} size={11} weight={600} tone="strong">
            {e.who}
          </Label>
          <Label x={84} y={e.y + 17} size={10} tone="body">
            {e.what}
          </Label>
          <Label x={380} y={e.y + 8} size={10} tone="muted" anchor="end">
            {e.when}
          </Label>
        </g>
      ))}
      <circle cx={46} cy={186} r={7} className="fill-brand-500" />
      <rect
        x={60}
        y={174}
        width={320}
        height={24}
        rx={6}
        className="fill-brand-50 stroke-brand-300"
        strokeWidth={1.2}
      />
      <Label x={70} y={187} size={10} weight={600} tone="accent">
        Snapshot: Before the workshop
      </Label>
      <Label x={372} y={187} size={10} tone="muted" anchor="end">
        12:40
      </Label>
      <Button x={272} y={248} w={116} h={24} label="Take Snapshot" variant="primary" />
    </Scene>
  );
}
