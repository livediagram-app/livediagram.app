// Illustrations for the blocks an article's writing holds beyond its paragraphs (docs/specs/018-help/help-app.md,
// docs/specs/007-editor/article-pages.md "Tables", "Table of contents" and "Headers and footers"): a table block
// with its header row and the page toolbar's Table menu (article/page-toolbar-table.tsx), and an article page with
// its header, a contents block and its footer (article/ArticleBandsSection.tsx, lib/article/article-toc-view.ts).
// Composed from the shared primitives.

import type { ReactNode } from 'react';
import { Label, Menu, Scene, TextBar } from '@liveworkspace/help-site/art/primitives';

/** A sheet of paper on the canvas, with its soft drop shadow. */
function Sheet({
  x,
  y,
  w,
  h,
  children,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  children?: ReactNode;
}) {
  return (
    <g>
      <rect x={x + 2} y={y + 3} width={w} height={h} rx={2} className="fill-slate-200" />
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={2}
        className="fill-white stroke-slate-200"
        strokeWidth={1.2}
      />
      {children}
    </g>
  );
}

const TABLE_ROWS = [
  ['Region', 'Q1', 'Q2'],
  ['North', '120', '148'],
  ['South', '96', '131'],
  ['West', '84', '102'],
];

/** A table block in the writing, its header row tinted, the caret in a cell and the Table menu open beside it. */
export function ArticleTableScene() {
  const x = 60;
  const y = 92;
  const cols = [96, 58, 58];
  const rowH = 20;
  const w = cols.reduce((a, b) => a + b, 0);
  return (
    <Scene w={420} h={236}>
      <Sheet x={36} y={14} w={252} h={212}>
        <Label x={60} y={40} size={15} weight={800} tone="strong">
          Quarterly results
        </Label>
        <TextBar x={60} y={56} w={200} />
        <TextBar x={60} y={68} w={172} />
        {/* The header row, on a soft tint of the accent. */}
        <rect x={x} y={y} width={w} height={rowH} className="fill-brand-50" />
        {TABLE_ROWS.map((row, r) => {
          let cx = x;
          return row.map((cell, c) => {
            const at = cx;
            cx += cols[c]!;
            return (
              <Label
                key={`${r}-${c}`}
                x={at + 8}
                y={y + r * rowH + rowH / 2 + 1}
                size={10.5}
                weight={r === 0 ? 700 : 400}
                tone={r === 0 ? 'strong' : 'body'}
              >
                {cell}
              </Label>
            );
          });
        })}
        {/* Hairline rules round and between every cell. */}
        <g className="stroke-slate-300" strokeWidth={0.8} fill="none">
          <rect x={x} y={y} width={w} height={rowH * TABLE_ROWS.length} />
          {TABLE_ROWS.slice(1).map((_, i) => (
            <line key={`r${i}`} x1={x} y1={y + (i + 1) * rowH} x2={x + w} y2={y + (i + 1) * rowH} />
          ))}
          <line x1={x + cols[0]!} y1={y} x2={x + cols[0]!} y2={y + rowH * TABLE_ROWS.length} />
          <line
            x1={x + cols[0]! + cols[1]!}
            y1={y}
            x2={x + cols[0]! + cols[1]!}
            y2={y + rowH * TABLE_ROWS.length}
          />
        </g>
        {/* The caret, after the last figure typed in a cell. */}
        <rect
          x={x + cols[0]! + cols[1]! + 30}
          y={y + 3 * rowH + 4}
          width={1.4}
          height={12}
          className="fill-brand-600"
        />
        <TextBar x={60} y={188} w={196} />
        <TextBar x={60} y={200} w={120} />
      </Sheet>
      {/* The page toolbar's Table menu, shown while the caret is in a table. */}
      <Label x={300} y={22} size={10} weight={700} tone="muted">
        Table
      </Label>
      <Menu
        x={292}
        y={32}
        w={124}
        rowH={21}
        active={1}
        items={[
          'Insert Row Above',
          'Insert Row Below',
          'Insert Column Left',
          'Insert Column Right',
          'Delete Row',
          'Delete Column',
          'Header Row',
          'Delete Table',
        ]}
      />
    </Scene>
  );
}

const CONTENTS = [
  { text: 'Summary', page: '2', depth: 0 },
  { text: 'Results', page: '3', depth: 0 },
  { text: 'By region', page: '3', depth: 1 },
  { text: 'By product', page: '4', depth: 1 },
  { text: 'Next steps', page: '5', depth: 0 },
];

/** An article page with its header along the top, a contents block in the writing and its footer at the foot. */
export function ArticleContentsBandsScene() {
  const x = 96;
  const w = 228;
  return (
    <Scene w={420} h={250}>
      <Sheet x={x} y={12} w={w} h={228}>
        {/* The header: Left, Centre and Right, in the top margin. */}
        <Label x={x + 18} y={34} size={9} tone="muted">
          Acme Ltd
        </Label>
        <Label x={x + w - 18} y={34} size={9} tone="muted" anchor="end">
          Annual Report
        </Label>
        <line
          x1={x + 18}
          y1={44}
          x2={x + w - 18}
          y2={44}
          className="stroke-slate-200"
          strokeWidth={0.8}
        />
        {/* The contents block. */}
        <Label x={x + 24} y={66} size={13} weight={800} tone="strong">
          Contents
        </Label>
        {CONTENTS.map((entry, i) => {
          const ey = 88 + i * 18;
          const ex = x + 24 + entry.depth * 14;
          return (
            <g key={entry.text}>
              <Label x={ex} y={ey} size={10.5} tone={entry.depth ? 'body' : 'strong'}>
                {entry.text}
              </Label>
              <line
                x1={ex + entry.text.length * 5.6 + 6}
                y1={ey + 3}
                x2={x + w - 40}
                y2={ey + 3}
                className="stroke-slate-300"
                strokeWidth={1}
                strokeDasharray="1 2.5"
              />
              <Label x={x + w - 24} y={ey} size={10.5} tone="body" anchor="end">
                {entry.page}
              </Label>
            </g>
          );
        })}
        <TextBar x={x + 24} y={188} w={180} />
        <TextBar x={x + 24} y={200} w={150} />
        {/* The footer: the page number and the page count, in its centre. */}
        <Label x={x + w / 2} y={226} size={9} tone="muted" anchor="middle">
          Page 2 of 5
        </Label>
      </Sheet>
      {/* Callouts naming the three parts, outside the page. */}
      <g className="stroke-brand-400" strokeWidth={1} fill="none">
        <path d={`M${x - 6} 34 H${x - 26}`} />
        <path d={`M${x - 6} 66 H${x - 26}`} />
        <path d={`M${x - 6} 226 H${x - 26}`} />
      </g>
      <Label x={x - 30} y={34} size={10} weight={600} tone="accent" anchor="end">
        Header
      </Label>
      <Label x={x - 30} y={66} size={10} weight={600} tone="accent" anchor="end">
        Contents
      </Label>
      <Label x={x - 30} y={226} size={10} weight={600} tone="accent" anchor="end">
        Footer
      </Label>
    </Scene>
  );
}
