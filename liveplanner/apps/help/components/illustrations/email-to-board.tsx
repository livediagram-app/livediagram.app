// The Email to Board article's scenes (docs/specs/026-plan/email-to-board.md): the tab menu with Email to Board…
// under the pointer, the dialog once an address is on (the address with Copy Address, its counts line, Who Can Send
// and the amber warning), and the panel footer of a card an email made (From email beside Created by). Composed from
// the shared primitives so the house style holds.

import { Scene, Label, Dialog, Button } from '@liveworkspace/help-site/art/primitives';
import {
  TabPill,
  AddTabButton,
  TabBar,
  MenuRowList,
} from '@liveworkspace/help-site/art/illustrations/tabs-parts';

/** The tab menu's rows, with Email to Board… under the pointer below Publish as Roadmap. */
export function EmailMenu() {
  const barY = 186;
  const mx = 130;
  const my = 16;
  return (
    <Scene w={420} h={238}>
      <TabBar y={barY} w={420} />
      <TabPill x={14} y={barY + 8} w={100} label="Requests" active />
      <TabPill x={120} y={barY + 8} w={64} label="Bugs" />
      <AddTabButton x={190} y={barY + 8} />
      <rect
        x={mx}
        y={my}
        width={212}
        height={152}
        rx={8}
        className="fill-white stroke-slate-200"
        strokeWidth={1.5}
      />
      <MenuRowList
        x={mx}
        y={my + 6}
        w={212}
        rows={[
          'Organise in Tab Folder',
          null,
          'Import…',
          'Export',
          'Subscribe to Calendar…',
          'Publish as Roadmap…',
          'Email to Board…',
          'Clear',
        ]}
        highlight="Email to Board…"
      />
    </Scene>
  );
}

// One Who Can Send choice: chosen (brand ring, filled icon tile) or not (plain outline).
function Choice({
  x,
  y,
  w,
  label,
  hint,
  on,
}: {
  x: number;
  y: number;
  w: number;
  label: string;
  hint: string;
  on: boolean;
}) {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={44}
        rx={7}
        className={on ? 'fill-brand-50 stroke-brand-500' : 'fill-white stroke-slate-200'}
      />
      <rect
        x={x + 8}
        y={y + 9}
        width={16}
        height={16}
        rx={4}
        className={on ? 'fill-brand-700' : 'fill-slate-100'}
      />
      <Label x={x + 32} y={y + 17} size={9.5} weight={600} tone="strong">
        {label}
      </Label>
      <Label x={x + 32} y={y + 32} size={8.5} tone="muted">
        {hint}
      </Label>
    </g>
  );
}

/** Email to Board once on: the board's address with Copy Address, what it has done, Who Can Send and the warning,
 *  then New Address, Turn Off and Done. */
export function EmailDialog() {
  const W = 420;
  const H = 304;
  const dx = 30;
  const dy = 8;
  const dw = 360;
  const x = dx + 16;
  const w = dw - 32;
  const half = (w - 8) / 2;
  return (
    <Scene w={W} h={H}>
      <Dialog
        x={dx}
        y={dy}
        w={dw}
        h={H - 16}
        title="Email to Board"
        sceneW={W}
        sceneH={H}
        scrim={false}
      >
        <Label x={x} y={dy + 52} size={10} weight={600} className="fill-emerald-700">
          Mail to this address becomes a card in Backlog.
        </Label>
        <rect
          x={x}
          y={dy + 62}
          width={w - 92}
          height={24}
          rx={5}
          className="fill-slate-50 stroke-slate-200"
        />
        <Label x={x + 8} y={dy + 75} size={9} tone="body" className="fill-slate-600 font-mono">
          board+2peys2lkq3…@in.liveplanner.app
        </Label>
        <Button x={x + w - 84} y={dy + 61} w={84} label="Copy Address" variant="primary" />
        <Label x={x} y={dy + 102} size={8.5} tone="muted">
          3 cards made · 1 refused · Last card 2 hours ago
        </Label>
        <Label x={x} y={dy + 126} size={9} weight={700} tone="muted">
          WHO CAN SEND
        </Label>
        <Choice
          x={x}
          y={dy + 134}
          w={half}
          label="Plan Members"
          hint="The plan's owner and team"
          on
        />
        <Choice
          x={x + half + 8}
          y={dy + 134}
          w={half}
          label="Anyone with the Address"
          hint="Keep it private"
          on={false}
        />
        <rect
          x={x}
          y={dy + 188}
          width={w}
          height={40}
          rx={7}
          className="fill-amber-50 stroke-amber-200"
        />
        <Label x={x + 12} y={dy + 203} size={9} className="fill-amber-900">
          Anyone who can send from an allowed address can add
        </Label>
        <Label x={x + 12} y={dy + 218} size={9} className="fill-amber-900">
          cards to this board. If the address leaks, press New Address.
        </Label>
        <Button x={x + w - 230} y={dy + 254} w={86} label="New Address" />
        <Button x={x + w - 138} y={dy + 254} w={70} label="Turn Off" />
        <Button x={x + w - 60} y={dy + 254} w={60} label="Done" variant="primary" />
      </Dialog>
    </Scene>
  );
}

/** The foot of a card an email made: Created by and From email name the sender, with a mail glyph on From email. */
export function EmailCardFooter() {
  const W = 420;
  const H = 120;
  const x = 40;
  const rows: { label: string; who: string; mail: boolean }[] = [
    { label: 'From email', who: 'alice@example.com', mail: true },
    { label: 'Created by', who: 'alice@example.com', mail: false },
  ];
  return (
    <Scene w={W} h={H}>
      <rect
        x={24}
        y={12}
        width={W - 48}
        height={H - 24}
        rx={10}
        className="fill-slate-50 stroke-slate-200"
      />
      <Label x={x} y={36} size={9} weight={700} tone="muted">
        DETAILS
      </Label>
      {rows.map((row, i) => {
        const y = 58 + i * 26;
        return (
          <g key={row.label}>
            {row.mail ? (
              <g fill="none" className="stroke-slate-500" strokeWidth={1.3}>
                <rect x={x} y={y - 6} width={13} height={10} rx={1.5} />
                <path d={`M${x} ${y - 5}l6.5 5 6.5-5`} />
              </g>
            ) : (
              <circle cx={x + 6.5} cy={y - 1} r={7} className="fill-emerald-700" />
            )}
            <Label x={x + 22} y={y + 2} size={10} tone="body">
              {row.label}
            </Label>
            <Label
              x={x + 22 + row.label.length * 5.6 + 6}
              y={y + 2}
              size={10}
              weight={600}
              tone="strong"
            >
              {row.who}
            </Label>
          </g>
        );
      })}
    </Scene>
  );
}
