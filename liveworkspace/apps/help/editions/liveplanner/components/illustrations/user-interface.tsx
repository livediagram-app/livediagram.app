// User-Interface-category illustrations (liveworkspace/docs/specs/017-help/help-centre.md) for liveplanner: the top
// of a Board tab, labelled part by part, and a Sheet's zoom controls with their preset menu open. Drawn from
// ./planner-chrome, so the labels, icons and order are the editor's own (liveplanner/apps/editor: the board's
// header row, ChromeControls, ZoomControls, ZoomMenu).

import { Label, Scene } from '@liveworkspace/help-site/art/primitives';
import {
  AccountCard,
  BoardHeader,
  ChromeCard,
  CompletionWidget,
  headerWidgetsX,
  HAIR,
  TopCards,
  textW,
  type HeaderType,
} from './planner-chrome';
import { CornerControls } from './planner-bars';
import { BUDGET_ROWS, SheetFragment } from './sheet-fragment';

/** A Sheet tab with the zoom presets open above the level: 50% to 150% and Fit to Screen, over the corner
 *  cluster's Undo / Redo, Style and zoom cards. */
export function ZoomControls() {
  const presets = ['50%', '75%', '100%', '125%', '150%'];
  const px = 332;
  const py = 62;
  return (
    <Scene w={420} h={240}>
      <TopCards x={10} y={10} tab="Budget" />
      <ChromeCard x={10} y={44} w={226} h={110} r={6} lift={false}>
        <SheetFragment
          x={10.5}
          y={44.5}
          cols={[74, 66, 66]}
          rows={BUDGET_ROWS}
          rh={15.5}
          sel={[1, 2]}
        />
      </ChromeCard>
      <ChromeCard x={px} y={py} w={82} h={140} r={8}>
        {presets.map((p, i) => {
          const ry = py + 6 + i * 20;
          const on = p === '100%';
          return (
            <g key={p}>
              {on && (
                <rect x={px + 4} y={ry} width={74} height={18} rx={4} className="fill-brand-50" />
              )}
              <Label
                x={px + 41}
                y={ry + 9.5}
                size={9.5}
                weight={on ? 600 : 400}
                tone={on ? 'accent' : 'body'}
                anchor="middle"
              >
                {p}
              </Label>
            </g>
          );
        })}
        <line
          x1={px + 6}
          y1={py + 112}
          x2={px + 76}
          y2={py + 112}
          className="stroke-slate-200"
          strokeWidth={HAIR}
        />
        <Label x={px + 41} y={py + 125} size={9.5} tone="body" anchor="middle">
          Fit to Screen
        </Label>
      </ChromeCard>
      <CornerControls right={410} y={208} groups={['undo', 'style', 'zoom']} />
    </Scene>
  );
}

/** One callout: a short dotted tick down from a part of the header to its name. */
function Callout({ x, y, label, top }: { x: number; y: number; label: string; top: number }) {
  return (
    <g>
      <line
        x1={x}
        y1={top}
        x2={x}
        y2={y - 8}
        className="stroke-slate-300"
        strokeWidth={HAIR}
        strokeDasharray="2 2"
      />
      <circle cx={x} cy={top} r={1.5} className="fill-slate-400" />
      <Label x={x} y={y} size={9} anchor="middle" tone="body">
        {label}
      </Label>
    </g>
  );
}

/** The top of a plan: on a Board tab the board's header row carries the logo, the menu, the board's name, its card
 *  types and widgets, then Share and the account; a Sheet, Dashboard or Form keeps them as floating cards. */
export function TitleBarParts() {
  const types: HeaderType[] = [{ name: 'Task', icon: 'task', hue: 'teal' }];
  const wx = headerWidgetsX(6, 'Sprint 12', types);
  const typesX = 6 + 106 + textW('Sprint 12', 10) + 12;
  return (
    <Scene w={440} h={200}>
      <Label x={10} y={14} size={9} weight={600} tone="muted">
        ON A BOARD
      </Label>
      <ChromeCard x={6} y={22} w={428} h={34} r={8} />
      <BoardHeader x={6} y={22} w={428} title="Sprint 12" types={types} account={false}>
        <CompletionWidget x={wx} y={22 + 5.5} pct={60} of="3/5" />
      </BoardHeader>
      <AccountCard
        right={430}
        y={22}
        card={false}
        shared
        signedIn={{ initial: 'S', colour: 'emerald' }}
      />
      <Callout x={20} top={41} y={78} label="Logo" />
      <Callout x={100} top={41} y={78} label="Menu" />
      <Callout x={130} top={41} y={92} label="Board" />
      <Callout x={typesX + 30} top={41} y={78} label="Card Types" />
      <Callout x={wx + 30} top={41} y={92} label="Widgets" />
      <Callout x={385} top={41} y={78} label="Share" />
      <Callout x={418} top={41} y={92} label="Account" />

      <Label x={10} y={118} size={9} weight={600} tone="muted">
        ON A SHEET, DASHBOARD OR FORM
      </Label>
      <TopCards x={6} y={128} tab="Budget" />
      <AccountCard right={434} y={128} shared signedIn={{ initial: 'S', colour: 'emerald' }} />
      <Callout x={50} top={156} y={184} label="Logo Card" />
      <Callout x={140} top={156} y={184} label="Menu and Tab Name" />
      <Callout x={396} top={156} y={184} label="Share and Account" />
    </Scene>
  );
}
