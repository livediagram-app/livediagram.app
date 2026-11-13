// The Tabs category's Import and Export scenes (docs/specs/018-help/help-app.md), re-exported from
// ./tabs: the tab menu with Import under the pointer, the Export Tab dialog's formats and the Import to
// Tab dialog's warning, the one Import dialog's list and its preview of a board from another tool. Composed only from the shared primitives so the house style holds.

import type { ReactNode } from 'react';
import { Scene, Label, Dialog } from '@liveworkspace/help-site/art/primitives';
import {
  TabPill,
  AddTabButton,
  TabBar,
  FormatCard,
  MenuRowList,
} from '@liveworkspace/help-site/art/illustrations/tabs-parts';

/** The tab menu's rows, with Import under the pointer beside Export and Clear. */
export function ImportMenu() {
  const barY = 158;
  const mx = 150;
  const my = 32;
  return (
    <Scene w={420} h={210}>
      <TabBar y={barY} w={420} />
      <TabPill x={14} y={barY + 8} w={64} label="Notes" />
      <TabPill x={252} y={barY + 8} w={90} label="Draft" active />
      <AddTabButton x={348} y={barY + 8} />
      <rect
        x={mx}
        y={my}
        width={192}
        height={92}
        rx={8}
        className="fill-white stroke-slate-200"
        strokeWidth={1.5}
      />
      <MenuRowList
        x={mx}
        y={my + 6}
        w={192}
        rows={['Organise in Tab Folder', null, 'Import…', 'Export', 'Clear']}
        highlight="Import…"
      />
    </Scene>
  );
}

/** The one Import dialog's list (docs/specs/026-plan/plan-tabs.md "The Import dialog"): on a Board tab, its own CSV
 *  under Into This Tab, then the four tools under A Board from Another Tool, each with its mark and what file to
 *  bring. */
export function ImportChooser() {
  const W = 440;
  const H = 302;
  const dx = 20;
  const dy = 8;
  const x = dx + 16;
  const w = 368;
  const ROW = 32;
  const row = (
    y: number,
    tile: string,
    mark: ReactNode,
    label: string,
    hint: string,
    file: string,
    last: boolean,
  ) => (
    <g key={label}>
      <rect x={x + 10} y={y + 7} width={18} height={18} rx={4.5} className={tile} />
      <g transform={`translate(${x + 10} ${y + 7})`}>{mark}</g>
      <Label x={x + 38} y={y + 11} size={10} weight={600} tone="strong">
        {label}
      </Label>
      <Label x={x + 38} y={y + 23} size={8.5} tone="muted">
        {hint}
      </Label>
      <rect x={x + w - 36} y={y + 10} width={28} height={12} rx={3} className="fill-slate-100" />
      <Label x={x + w - 22} y={y + 16} size={7.5} weight={700} anchor="middle" tone="body">
        {file}
      </Label>
      {last ? null : (
        <line x1={x} y1={y + ROW} x2={x + w} y2={y + ROW} className="stroke-slate-100" />
      )}
    </g>
  );
  const tools: [string, ReactNode, string, string, string][] = [
    [
      'fill-indigo-500',
      <>
        <rect x={4} y={4} width={4.4} height={10} rx={1} className="fill-white" />
        <rect x={9.8} y={4} width={4.4} height={6.4} rx={1} className="fill-white" />
      </>,
      'Trello',
      'Board JSON from Menu › Print, export and share › Export as JSON',
      'JSON',
    ],
    [
      'fill-rose-400',
      <>
        <circle cx={9} cy={5.8} r={2.6} className="fill-white" />
        <circle cx={5.3} cy={11.8} r={2.6} className="fill-white" />
        <circle cx={12.7} cy={11.8} r={2.6} className="fill-white" />
      </>,
      'Asana',
      'Project CSV from its name menu › Export/Print › CSV',
      'CSV',
    ],
    [
      'fill-indigo-400',
      <path
        d="M9 2.6 15.4 9 9 15.4 2.6 9Zm0 4L6.6 9 9 11.4 11.4 9Z"
        fillRule="evenodd"
        className="fill-white"
      />,
      'Jira',
      'Issues CSV from Issue search › Export › Export CSV (all fields)',
      'CSV',
    ],
    [
      'fill-violet-500',
      <circle cx={9} cy={9} r={6} className="fill-white" />,
      'Linear',
      'Issues CSV from Settings › Import / Export › Export CSV',
      'CSV',
    ],
  ];
  const toolsY = dy + 128;
  return (
    <Scene w={W} h={H}>
      <Dialog x={dx} y={dy} w={400} h={288} title="Import" sceneW={W} sceneH={H}>
        <Label x={x} y={dy + 52} size={8.5} weight={700} tone="muted">
          INTO THIS TAB
        </Label>
        <rect
          x={x}
          y={dy + 60}
          width={w}
          height={ROW}
          rx={7}
          className="fill-white stroke-slate-200"
          strokeWidth={1}
        />
        {row(
          dy + 60,
          'fill-brand-50',
          <path
            d="M4.5 4.5h9v9h-9Zm0 3h9m-9 3h9M9 4.5v9"
            className="fill-none stroke-brand-600"
            strokeWidth={1.1}
          />,
          'CSV',
          'A .csv or .tsv, each row a new card on this board',
          'CSV',
          true,
        )}
        <Label x={x} y={dy + 112} size={8.5} weight={700} tone="muted">
          A BOARD FROM ANOTHER TOOL
        </Label>
        <rect
          x={x}
          y={toolsY}
          width={w}
          height={ROW * tools.length}
          rx={7}
          className="fill-white stroke-slate-200"
          strokeWidth={1}
        />
        {tools.map(([tile, mark, label, hint, file], i) =>
          row(toolsY + i * ROW, tile, mark, label, hint, file, i === tools.length - 1),
        )}
        <Label x={x} y={toolsY + ROW * tools.length + 14} size={9} tone="muted">
          A one-off copy into a new Board tab or plan, after a preview.
        </Label>
      </Dialog>
    </Scene>
  );
}

/** The Export Tab dialog: a card per format, text formats first, then the image formats. */
export function ExportMenu() {
  const W = 420;
  const H = 200;
  const dx = 20;
  const dy = 12;
  const cards: [string, string][] = [
    ['JSON', 'json'],
    ['Markdown', 'md'],
    ['PNG', 'png'],
    ['SVG', 'svg'],
    ['PDF', 'pdf'],
  ];
  return (
    <Scene w={W} h={H}>
      <Dialog x={dx} y={dy} w={380} h={176} title="Export Tab" sceneW={W} sceneH={H}>
        {cards.map(([title, badge], i) => (
          <FormatCard
            key={title}
            x={dx + 16 + (i % 3) * 118}
            y={dy + 50 + Math.floor(i / 3) * 40}
            w={112}
            title={title}
            badge={badge}
          />
        ))}
      </Dialog>
    </Scene>
  );
}

/** The Import to Tab dialog: the amber warning naming the tab about to be replaced, over the box
 *  the JSON export is pasted into. */
export function ImportWarning() {
  const W = 420;
  const H = 210;
  const dx = 20;
  const dy = 10;
  return (
    <Scene w={W} h={H}>
      <Dialog x={dx} y={dy} w={380} h={190} title="Import to Tab" sceneW={W} sceneH={H}>
        {/* The amber warning banner */}
        <rect
          x={dx + 16}
          y={dy + 46}
          width={348}
          height={44}
          rx={7}
          className="fill-amber-50 stroke-amber-400"
          strokeWidth={1.2}
        />
        <g transform={`translate(${dx + 30} ${dy + 61})`}>
          <path
            d="M0 -7 L7.5 6 H-7.5 Z"
            className="fill-none stroke-amber-500"
            strokeWidth={1.6}
            strokeLinejoin="round"
          />
          <path
            d="M0 -2 v3.5"
            className="stroke-amber-500"
            strokeWidth={1.6}
            strokeLinecap="round"
          />
        </g>
        <Label x={dx + 44} y={dy + 60} size={10} className="fill-slate-700">
          This replaces everything on
        </Label>
        <Label x={dx + 185} y={dy + 60} size={10} weight={700} className="fill-slate-800">
          Draft
        </Label>
        <Label x={dx + 44} y={dy + 76} size={10} className="fill-slate-700">
          with the imported content. Undo brings it back.
        </Label>
        {/* The box the export is pasted into */}
        <rect
          x={dx + 16}
          y={dy + 100}
          width={348}
          height={74}
          rx={7}
          className="fill-slate-50 stroke-slate-200"
          strokeWidth={1.2}
        />
        <Label x={dx + 28} y={dy + 118} size={10} className="fill-slate-400">
          {'{ "kind": "liveplanner.tab", … }'}
        </Label>
      </Dialog>
    </Scene>
  );
}

/** The Import dialog's preview of a board from another tool (docs/specs/026-plan/tracker-import.md "The preview"):
 *  the All Imports back bar, the board read from the file with its columns, and where it goes, a new Board tab
 *  chosen. */
export function TrackerImportPreview() {
  const W = 420;
  const H = 250;
  const dx = 20;
  const dy = 10;
  const chips: [string, number][] = [
    ['Backlog', 2],
    ['Doing', 1],
    ['In Review', 1],
    ['Done', 1],
  ];
  let cx = dx + 16;
  return (
    <Scene w={W} h={H}>
      <Dialog x={dx} y={dy} w={380} h={230} title="Import from Trello" sceneW={W} sceneH={H}>
        {/* The back bar: All Imports, the tool as its chip */}
        <rect
          x={dx + 16}
          y={dy + 41}
          width={348}
          height={20}
          rx={6}
          className="fill-white stroke-slate-200"
          strokeWidth={1}
        />
        <path
          d={`M${dx + 30} ${dy + 47} l-3.5 4 l3.5 4`}
          className="fill-none stroke-slate-500"
          strokeWidth={1.4}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Label x={dx + 40} y={dy + 51} size={9.5} weight={600} tone="strong">
          All Imports
        </Label>
        <rect x={dx + 322} y={dy + 45} width={36} height={12} rx={3} className="fill-slate-100" />
        <Label x={dx + 340} y={dy + 51} size={8.5} weight={600} anchor="middle" tone="body">
          Trello
        </Label>
        {/* The board read from the file */}
        <Label x={dx + 16} y={dy + 80} size={10} tone="muted">
          Trello board ·
        </Label>
        <Label x={dx + 84} y={dy + 80} size={10} weight={700} tone="strong">
          Website Relaunch
        </Label>
        <Label x={dx + 364} y={dy + 80} size={9} anchor="end" tone="muted">
          5 cards
        </Label>
        <Label x={dx + 16} y={dy + 100} size={9} weight={600} tone="strong">
          Columns
        </Label>
        {chips.map(([name, n]) => {
          const w = name.length * 5.4 + 22;
          const x = cx;
          cx += w + 6;
          return (
            <g key={name}>
              <rect
                x={x}
                y={dy + 107}
                width={w}
                height={18}
                rx={4}
                className="fill-slate-50 stroke-slate-200"
                strokeWidth={1}
              />
              <Label x={x + 7} y={dy + 116} size={9} tone="body">
                {name}
              </Label>
              <Label x={x + w - 6} y={dy + 116} size={9} anchor="end" tone="muted">
                {String(n)}
              </Label>
            </g>
          );
        })}
        {/* Where To: a new Board tab (chosen) or a new plan */}
        <Label x={dx + 16} y={dy + 142} size={9} weight={600} tone="strong">
          Where To
        </Label>
        <rect
          x={dx + 16}
          y={dy + 148}
          width={348}
          height={44}
          rx={6}
          className="fill-white stroke-slate-200"
          strokeWidth={1}
        />
        <rect x={dx + 17} y={dy + 149} width={346} height={21} rx={5} className="fill-brand-50" />
        <Label x={dx + 28} y={dy + 159.5} size={9.5} weight={600} tone="accent">
          New Board Tab in This Plan
        </Label>
        <path
          d={`M${dx + 346} ${dy + 159} l3 3 l6 -6`}
          className="fill-none stroke-brand-600"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Label x={dx + 28} y={dy + 181} size={9.5} tone="body">
          New Plan
        </Label>
        {/* The footer: what it makes, and Import */}
        <Label x={dx + 16} y={dy + 213} size={9} tone="muted">
          Makes a Board tab with 4 columns and 5 cards.
        </Label>
        <rect x={dx + 300} y={dy + 203} width={64} height={20} rx={5} className="fill-brand-600" />
        <Label x={dx + 332} y={dy + 213} size={9.5} weight={600} anchor="middle" tone="onAccent">
          Import
        </Label>
      </Dialog>
    </Scene>
  );
}
