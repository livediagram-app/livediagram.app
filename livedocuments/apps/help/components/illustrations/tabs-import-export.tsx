// The Tabs category's Import and Export scenes (docs/specs/018-help/help-app.md), re-exported from
// ./tabs: the tab menu with Import under the pointer, the Export Tab dialog's formats and the Import to
// Tab dialog's warning. Composed only from the shared primitives so the house style holds.

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
  const my = 14;
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
        height={110}
        rx={8}
        className="fill-white stroke-slate-200"
        strokeWidth={1.5}
      />
      <MenuRowList
        x={mx}
        y={my + 6}
        w={192}
        rows={['Organise in Tab Folder', 'Add to Document', null, 'Import', 'Export', 'Clear']}
        highlight="Import"
      />
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

/** The Import to Tab dialog: the amber warning naming the tab about to be replaced, over the
 *  format cards. */
export function ImportWarning() {
  const W = 420;
  const H = 210;
  const dx = 20;
  const dy = 10;
  const cards: [string, string][] = [
    ['JSON', 'json'],
    ['Markdown', 'md'],
    ['Word', 'docx'],
    ['PowerPoint', 'pptx'],
  ];
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
        {cards.map(([title, badge], i) => (
          <FormatCard
            key={title}
            x={dx + 16 + (i % 2) * 178}
            y={dy + 100 + Math.floor(i / 2) * 40}
            w={170}
            title={title}
            badge={badge}
          />
        ))}
      </Dialog>
    </Scene>
  );
}
