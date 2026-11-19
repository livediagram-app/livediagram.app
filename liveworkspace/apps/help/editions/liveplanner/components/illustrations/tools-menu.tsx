// The footer's Tools menu (liveworkspace/docs/specs/004-index/footer-tools-menu.md), as the Calendar feed, Email to
// Board and Public Roadmap articles show it: the Tools button pressed in the bottom bar and its popover above, its rows
// under their group headings, one row under the pointer, and (for Quick Controls) the Sign In or Sync Plan badges a
// tool wears while it needs an account or a synced plan. Composed from the shared primitives so the house style holds.

import { Scene, Label } from '@liveworkspace/help-site/art/primitives';
import { TabBar, TabPill } from '@liveworkspace/help-site/art/illustrations/tabs-parts';

const GROUPS: readonly { title: string; rows: readonly string[] }[] = [
  { title: 'FIND', rows: ['Search…'] },
  { title: 'AUTOMATE', rows: ['Automations…', 'Webhooks', 'Email to Board'] },
  { title: 'COLLABORATE', rows: ['Subscribe to Calendar', 'Publish as Roadmap'] },
  { title: 'VERSIONING', rows: ['History'] },
];

const W = 420;
const POP_X = 150;
const POP_W = 256;
const POP_Y = 10;
const HEAD = 30;
const HEADING = 15;
const ROW = 21;
const POP_H = HEAD + GROUPS.reduce((h, g) => h + HEADING + g.rows.length * ROW, 0) + 8;
const BAR_Y = POP_Y + POP_H + 14;

// Each heading's and row's top, laid out once from the groups.
const LAYOUT = GROUPS.reduce<{
  y: number;
  groups: { title: string; top: number; rows: { r: string; ry: number }[] }[];
}>(
  (acc, g) => {
    const top = acc.y;
    const rows = g.rows.map((r, i) => ({ r, ry: top + HEADING + i * ROW }));
    return {
      y: top + HEADING + g.rows.length * ROW,
      groups: [...acc.groups, { title: g.title, top, rows }],
    };
  },
  { y: POP_Y + HEAD, groups: [] },
).groups;

// A badge's width, near enough for its short words at 7.5px.
const badgeW = (text: string) => text.length * 4.4 + 10;

/** The Tools popover open over the bottom bar, `highlight` the row under the pointer, `badges` what a row needs first. */
export function ToolsMenuFigure({
  highlight,
  badges = {},
}: {
  highlight: string;
  badges?: Readonly<Record<string, readonly string[]>>;
}) {
  const rows = LAYOUT.map((g) => {
    const top = g.top;
    const items = g.rows.map(({ r, ry }) => {
      const on = r === highlight;
      return (
        <g key={r}>
          {on ? (
            <rect
              x={POP_X + 6}
              y={ry}
              width={POP_W - 12}
              height={ROW - 2}
              rx={6}
              className="fill-brand-50"
            />
          ) : null}
          <rect
            x={POP_X + 14}
            y={ry + 3}
            width={13}
            height={13}
            rx={3.5}
            className={on ? 'fill-brand-100 stroke-brand-500' : 'fill-slate-50 stroke-slate-300'}
            strokeWidth={1.1}
          />
          <Label
            x={POP_X + 36}
            y={ry + 10}
            size={10}
            weight={on ? 600 : 500}
            tone={on ? 'accent' : 'body'}
          >
            {r}
          </Label>
          {(badges[r] ?? []).map((b, i, all) => {
            const bx =
              POP_X +
              36 +
              r.length * 5.6 +
              6 +
              all.slice(0, i).reduce((w, a) => w + badgeW(a) + 4, 0);
            return (
              <g key={b}>
                <rect
                  x={bx}
                  y={ry + 4}
                  width={badgeW(b)}
                  height={12}
                  rx={6}
                  className="fill-slate-100 stroke-slate-300"
                  strokeWidth={0.8}
                />
                <Label
                  x={bx + badgeW(b) / 2}
                  y={ry + 10}
                  size={7.5}
                  weight={600}
                  tone="muted"
                  anchor="middle"
                >
                  {b}
                </Label>
              </g>
            );
          })}
          <path
            d={`M${POP_X + POP_W - 22} ${ry + 6.5} l3 3 -3 3`}
            className={on ? 'fill-none stroke-brand-500' : 'fill-none stroke-slate-300'}
            strokeWidth={1.3}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
      );
    });
    return (
      <g key={g.title}>
        <Label x={POP_X + 14} y={top + 8} size={7.5} weight={600} tone="muted">
          {g.title}
        </Label>
        {items}
      </g>
    );
  });
  return (
    <Scene w={W} h={BAR_Y + 40}>
      <rect
        x={POP_X}
        y={POP_Y}
        width={POP_W}
        height={POP_H}
        rx={10}
        className="fill-white stroke-slate-200"
        strokeWidth={1.5}
      />
      <Label x={POP_X + 14} y={POP_Y + 16} size={12} weight={700} tone="strong">
        Tools
      </Label>
      {rows}
      <TabBar y={BAR_Y} w={W} />
      <TabPill x={14} y={BAR_Y + 8} w={90} label="Requests" active />
      {/* The Tools button, pressed, under the popover. */}
      <rect x={334} y={BAR_Y + 7} width={52} height={20} rx={6} className="fill-slate-200" />
      <Label x={360} y={BAR_Y + 17} size={9.5} weight={600} tone="strong" anchor="middle">
        Tools
      </Label>
    </Scene>
  );
}
