// The Public Roadmap article's scenes (docs/specs/026-plan/public-roadmap.md): the tab menu with Publish as Roadmap…
// under the pointer, the dialog's Published state (the live link, the chosen columns and fields as chips, Voting and
// the privacy note), and the public page a visitor sees (the chosen columns, each card's vote button, Suggest an
// Idea). Composed from the shared primitives so the house style holds.

import { Scene, Label, Dialog, Button } from '@liveworkspace/help-site/art/primitives';
import { Switch } from '@liveworkspace/help-site/art/illustrations/settings-dialog';
import {
  TabPill,
  AddTabButton,
  TabBar,
  MenuRowList,
} from '@liveworkspace/help-site/art/illustrations/tabs-parts';

/** The tab menu's rows, with Publish as Roadmap… under the pointer beside Subscribe to Calendar. */
export function RoadmapMenu() {
  const barY = 172;
  const mx = 130;
  const my = 22;
  return (
    <Scene w={420} h={224}>
      <TabBar y={barY} w={420} />
      <TabPill x={14} y={barY + 8} w={80} label="Roadmap" active />
      <TabPill x={100} y={barY + 8} w={64} label="Bugs" />
      <AddTabButton x={170} y={barY + 8} />
      <rect
        x={mx}
        y={my}
        width={212}
        height={132}
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
          'Clear',
        ]}
        highlight="Publish as Roadmap…"
      />
    </Scene>
  );
}

// A chip that is on (tinted, ticked) or off (outlined), as the dialog's Columns and Fields draw them.
function Chip({ x, y, label, on }: { x: number; y: number; label: string; on: boolean }) {
  const w = label.length * 5.6 + (on ? 30 : 20);
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={18}
        rx={9}
        className={on ? 'fill-brand-50 stroke-brand-300' : 'fill-white stroke-slate-200'}
      />
      {on ? (
        <path
          d={`M${x + 9} ${y + 9}l2.5 2.5 4.5-5`}
          fill="none"
          className="stroke-brand-700"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : null}
      <Label
        x={x + (on ? 20 : 10)}
        y={y + 9.5}
        size={9}
        weight={500}
        className={on ? 'fill-brand-800' : 'fill-slate-600'}
      >
        {label}
      </Label>
    </g>
  );
}

/** Publish as Roadmap once published: the live link with Copy Link, the Columns and Fields chips (triage hidden),
 *  Voting on and the amber privacy note. */
export function RoadmapDialog() {
  const W = 420;
  const H = 316;
  const dx = 30;
  const dy = 8;
  const dw = 360;
  const x = dx + 16;
  const w = dw - 32;
  const chips = (y: number, items: [string, boolean][]) => {
    let at = x;
    return items.map(([label, on]) => {
      const node = <Chip key={label} x={at} y={y} label={label} on={on} />;
      at += label.length * 5.6 + (on ? 30 : 20) + 5;
      return node;
    });
  };
  return (
    <Scene w={W} h={H}>
      <Dialog
        x={dx}
        y={dy}
        w={dw}
        h={H - 16}
        title="Publish as Roadmap"
        sceneW={W}
        sceneH={H}
        scrim={false}
      >
        <Label x={x} y={dy + 52} size={10} weight={600} className="fill-emerald-700">
          Your roadmap is live.
        </Label>
        <rect
          x={x}
          y={dy + 62}
          width={w - 86}
          height={24}
          rx={5}
          className="fill-slate-50 stroke-slate-200"
        />
        <Label x={x + 8} y={dy + 75} size={9} tone="body" className="fill-slate-600 font-mono">
          …/roadmap/…/lpr_4fQ…
        </Label>
        <Button x={x + w - 78} y={dy + 61} w={78} label="Copy Link" variant="primary" />
        <Label x={x} y={dy + 108} size={9} weight={700} tone="muted">
          COLUMNS
        </Label>
        {chips(dy + 116, [
          ['Under Review', false],
          ['Planned', true],
          ['In Progress', true],
          ['Shipped', true],
        ])}
        <Label x={x} y={dy + 150} size={9} weight={700} tone="muted">
          FIELDS
        </Label>
        {chips(dy + 158, [
          ['Description', true],
          ['Labels', false],
          ['Due Date', false],
        ])}
        <Label x={x + 4} y={dy + 198} size={10} weight={600} tone="strong">
          Voting
        </Label>
        <Switch x={x + w - 30} y={dy + 190} on />
        <rect
          x={x}
          y={dy + 218}
          width={w}
          height={44}
          rx={7}
          className="fill-amber-50 stroke-amber-200"
        />
        <Label x={x + 12} y={dy + 234} size={9.5} weight={600} className="fill-amber-900">
          Anyone with the link sees the chosen columns and fields.
        </Label>
        <Label x={x + 12} y={dy + 250} size={9.5} className="fill-amber-900">
          People, comments and other fields are never shown.
        </Label>
      </Dialog>
    </Scene>
  );
}

/** The public page: the title and Suggest an Idea, then Planned, In Progress and Shipped side by side, each card with
 *  its vote button and count, one voted for by this browser. */
export function RoadmapPage() {
  const W = 420;
  const H = 236;
  const colW = 124;
  const columns: { name: string; cards: [string, number, boolean][] }[] = [
    {
      name: 'PLANNED',
      cards: [
        ['Dark mode', 42, true],
        ['Offline plans', 17, false],
      ],
    },
    { name: 'IN PROGRESS', cards: [['Gantt export', 28, false]] },
    { name: 'SHIPPED', cards: [['Sort by votes', 35, false]] },
  ];
  return (
    <Scene w={W} h={H}>
      <rect x={8} y={8} width={W - 16} height={H - 16} rx={10} className="fill-slate-50" />
      <Label x={22} y={34} size={15} weight={700} tone="strong">
        Acme Roadmap
      </Label>
      <Label x={22} y={52} size={9.5} tone="muted">
        Vote for the ideas you want most.
      </Label>
      <Button x={W - 126} y={24} w={104} label="Suggest an Idea" variant="primary" />
      {columns.map((col, i) => {
        const cx = 18 + i * (colW + 6);
        return (
          <g key={col.name}>
            <rect
              x={cx}
              y={66}
              width={colW}
              height={H - 82}
              rx={8}
              className="fill-white/70 stroke-slate-200"
            />
            <Label x={cx + 10} y={82} size={8.5} weight={700} tone="muted">
              {col.name}
            </Label>
            {col.cards.map(([title, votes, voted], j) => {
              const y = 92 + j * 50;
              return (
                <g key={title}>
                  <rect
                    x={cx + 6}
                    y={y}
                    width={colW - 12}
                    height={42}
                    rx={6}
                    className="fill-white stroke-slate-200"
                  />
                  <rect
                    x={cx + 12}
                    y={y + 6}
                    width={24}
                    height={30}
                    rx={5}
                    className={voted ? 'fill-brand-600' : 'fill-slate-50 stroke-slate-200'}
                  />
                  <path
                    d={`M${cx + 20} ${y + 17}l4-4 4 4`}
                    fill="none"
                    className={voted ? 'stroke-white' : 'stroke-slate-500'}
                    strokeWidth={1.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <Label
                    x={cx + 24}
                    y={y + 28}
                    size={8.5}
                    weight={700}
                    anchor="middle"
                    className={voted ? 'fill-white' : 'fill-slate-700'}
                  >
                    {String(votes)}
                  </Label>
                  <Label x={cx + 42} y={y + 21} size={9.5} weight={600} tone="strong">
                    {title}
                  </Label>
                </g>
              );
            })}
          </g>
        );
      })}
    </Scene>
  );
}
