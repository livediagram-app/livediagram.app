// Explorer illustrations for the imports and the Library pages (docs/specs/018-help/help-app.md):
// the page header's Import from group, the import checklists (draw.io, Microsoft Whiteboard), the
// Shape libraries page, the Image gallery and the Themes page. Labels are lifted from the live
// editor's own copy (ImportFromToolbar, ImportChecklist, ShapeLibrariesPane, GalleryPane,
// ThemesPane) so the figures match what a reader sees. Composed from the shared primitives.

import { Scene, Label, Button, Dialog, TextBar } from './primitives';

// --- Local parts -------------------------------------------------------------

/** A small checkbox, ticked or not. */
function Check({ x, y, on = true }: { x: number; y: number; on?: boolean }) {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={11}
        height={11}
        rx={2.5}
        className={on ? 'fill-brand-500 stroke-brand-600' : 'fill-white stroke-slate-300'}
        strokeWidth={1.2}
      />
      {on && (
        <path
          d={`M${x + 2.5} ${y + 5.8} l2.4 2.4 l4 -4.6`}
          fill="none"
          className="stroke-white help-art-as-drawn"
          strokeWidth={1.6}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </g>
  );
}

/** One outlined icon button of the Import from group, with a tiny glyph. */
function SourceButton({ x, y, glyph }: { x: number; y: number; glyph: 'board' | 'pen' | 'net' }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect width={22} height={22} rx={5} className="fill-white" />
      {glyph === 'board' && (
        <g>
          <rect x={4} y={5} width={14} height={11} rx={1.5} className="fill-brand-500" />
          <path
            d="M7 13 q2 -5 4 -1 t4 -3"
            fill="none"
            className="stroke-white help-art-as-drawn"
            strokeWidth={1.3}
            strokeLinecap="round"
          />
        </g>
      )}
      {glyph === 'pen' && (
        <path
          d="M6 16 l1 -4 l7 -7 l3 3 l-7 7 Z"
          className="fill-violet-400 stroke-violet-500"
          strokeWidth={1}
        />
      )}
      {glyph === 'net' && (
        <g className="fill-amber-400">
          <rect x={4} y={5} width={6} height={5} rx={1} />
          <rect x={12} y={12} width={6} height={5} rx={1} />
          <path d="M7 10 v4.5 h5" fill="none" className="stroke-amber-500" strokeWidth={1.3} />
        </g>
      )}
    </g>
  );
}

/** A picture motif (sun and hills) inside a box. */
function Picture({ x, y, w, h, hue }: { x: number; y: number; w: number; h: number; hue: string }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={6} className="fill-slate-50 stroke-slate-200" />
      <circle cx={x + w * 0.28} cy={y + h * 0.32} r={Math.min(w, h) * 0.1} className={hue} />
      <path
        d={`M${x + 6} ${y + h - 6} L${x + w * 0.38} ${y + h * 0.48} L${x + w * 0.58} ${y + h * 0.7} L${x + w * 0.74} ${y + h * 0.42} L${x + w - 6} ${y + h - 6} Z`}
        className={hue}
      />
    </g>
  );
}

// --- Scenes ------------------------------------------------------------------

/** The Explorer page header: the section title, then the Import from group (one icon button per
 *  source, in order Microsoft Whiteboard, Excalidraw, draw.io), Help, and Create. */
export function ImportFromHeader() {
  return (
    <Scene w={420} h={130} bg="plain">
      <rect
        x={14}
        y={18}
        width={392}
        height={94}
        rx={10}
        className="fill-white stroke-slate-200"
        strokeWidth={1.5}
      />
      <Label x={30} y={44} size={15} weight={700} tone="strong">
        Recent
      </Label>
      {/* Import from group */}
      <rect
        x={110}
        y={31}
        width={152}
        height={26}
        rx={7}
        className="fill-white stroke-slate-200"
        strokeWidth={1.5}
      />
      <Label x={120} y={45} size={10} weight={500} tone="muted">
        Import from
      </Label>
      <SourceButton x={184} y={33} glyph="board" />
      <SourceButton x={208} y={33} glyph="pen" />
      <rect x={232} y={33} width={22} height={22} rx={5} className="fill-slate-100" />
      <SourceButton x={232} y={33} glyph="net" />
      <Button x={270} y={31} w={52} label="Help" />
      <Button x={330} y={31} w={64} label="Create" variant="primary" />
      {/* Tooltip on the draw.io button, dark in both appearances */}
      <g className="help-art-as-drawn">
        <path d="M243 62 l-5 6 h10 Z" className="fill-slate-800" />
        <rect x={214} y={67} width={58} height={20} rx={5} className="fill-slate-800" />
        <Label x={243} y={78} anchor="middle" size={10} weight={600} className="fill-white">
          draw.io
        </Label>
      </g>
      <TextBar x={30} y={96} w={160} tone="faint" />
    </Scene>
  );
}

/** An import checklist dialog: the title, the legend, Select all, one ticked row per file, and
 *  Back beside the counted Import button. */
function ImportChecklistScene({
  title,
  legend,
  rows,
  importLabel,
  leftOut,
}: {
  title: string;
  legend: string;
  rows: { name: string; detail: string; on?: boolean }[];
  importLabel: string;
  leftOut?: string;
}) {
  const w = 420;
  const h = 250;
  const dx = 40;
  const dy = 12;
  const dw = 340;
  return (
    <Scene w={w} h={h} bg="none">
      <Dialog x={dx} y={dy} w={dw} h={226} title={title} sceneW={w} sceneH={h}>
        <Label x={dx + 16} y={dy + 52} size={11} weight={700} tone="strong">
          {legend}
        </Label>
        <Check x={dx + 18} y={dy + 64} on={rows.every((r) => r.on !== false)} />
        <Label x={dx + 36} y={dy + 70} size={10}>
          Select all
        </Label>
        <rect
          x={dx + 14}
          y={dy + 82}
          width={dw - 28}
          height={rows.length * 30}
          rx={7}
          className="fill-white stroke-slate-200"
          strokeWidth={1.2}
        />
        {rows.map((r, i) => {
          const ry = dy + 82 + i * 30;
          return (
            <g key={r.name}>
              {i > 0 && (
                <line
                  x1={dx + 14}
                  y1={ry}
                  x2={dx + dw - 14}
                  y2={ry}
                  className="stroke-slate-100"
                  strokeWidth={1}
                />
              )}
              <Check x={dx + 24} y={ry + 6} on={r.on !== false} />
              <Label x={dx + 42} y={ry + 11} size={11} tone="strong">
                {r.name}
              </Label>
              <Label x={dx + 42} y={ry + 23} size={10} tone="muted">
                {r.detail}
              </Label>
            </g>
          );
        })}
        {leftOut && (
          <Label
            x={dx + 16}
            y={dy + 82 + rows.length * 30 + 12}
            size={10}
            className="fill-rose-500"
          >
            {leftOut}
          </Label>
        )}
        <Button x={dx + dw - 190} y={dy + 190} w={56} label="Back" />
        <Button x={dx + dw - 126} y={dy + 190} w={110} label={importLabel} variant="primary" />
      </Dialog>
    </Scene>
  );
}

/** The draw.io import's list: diagrams with their date and pages, a library with its shapes. */
export function DrawioImportList() {
  return (
    <ImportChecklistScene
      title="Import from draw.io"
      legend="Files to import"
      rows={[
        { name: 'Network', detail: 'Edited 12 Mar 2026 · 3 pages' },
        { name: 'Onboarding flow', detail: 'Edited 2 Feb 2026 · 1 page', on: false },
        { name: 'Team icons', detail: 'Shape library · 14 shapes' },
      ]}
      importLabel="Import 2 files"
      leftOut="1 file will be left out; the report says why."
    />
  );
}

/** The Microsoft Whiteboard import's list: boards, newest first, with their date and item count. */
export function WhiteboardImportList() {
  return (
    <ImportChecklistScene
      title="Import from Microsoft Whiteboard"
      legend="Boards to import"
      rows={[
        { name: 'Sprint planning', detail: 'Edited 21 Aug 2026 · 214 items' },
        { name: 'Retro ideas', detail: 'Edited 3 Jun 2026 · 58 items' },
        { name: 'Whiteboard, 14 Aug 2020', detail: 'Edited 14 Aug 2020 · 12 items' },
      ]}
      importLabel="Import 3 boards"
    />
  );
}

/** The Shape libraries page: one card per library with its shape count, the first shapes'
 *  thumbnails, and Rename, Delete and Show shapes. */
export function ShapeLibraryCards() {
  const libraries = [
    {
      name: 'Team icons',
      count: '14 shapes',
      kinds: ['rect', 'circle', 'diamond', 'rect', 'circle'],
    },
    { name: 'UML preset', count: '6 shapes', kinds: ['rect', 'rect', 'diamond'] },
  ];
  return (
    <Scene w={420} h={220} bg="plain">
      <Label x={24} y={22} size={14} weight={700} tone="strong">
        Shape libraries
      </Label>
      {libraries.map((lib, i) => {
        const cy = 40 + i * 88;
        return (
          <g key={lib.name}>
            <rect
              x={20}
              y={cy}
              width={380}
              height={78}
              rx={10}
              className="fill-white stroke-slate-200"
              strokeWidth={1.5}
            />
            <Label x={34} y={cy + 16} size={11} weight={700} tone="strong">
              {lib.name}
            </Label>
            <Label x={386} y={cy + 16} size={10} tone="muted" anchor="end">
              {lib.count}
            </Label>
            {lib.kinds.map((k, j) => {
              const tx = 34 + j * 46;
              return (
                <g key={j}>
                  <rect
                    x={tx}
                    y={cy + 26}
                    width={40}
                    height={22}
                    rx={4}
                    className="fill-white stroke-slate-200"
                  />
                  {k === 'circle' ? (
                    <ellipse
                      cx={tx + 20}
                      cy={cy + 37}
                      rx={8}
                      ry={6}
                      className="fill-brand-100 stroke-brand-400"
                    />
                  ) : k === 'diamond' ? (
                    <path
                      d={`M${tx + 20} ${cy + 30} l9 7 l-9 7 l-9 -7 Z`}
                      className="fill-brand-100 stroke-brand-400"
                    />
                  ) : (
                    <rect
                      x={tx + 10}
                      y={cy + 31}
                      width={20}
                      height={12}
                      rx={2}
                      className="fill-brand-100 stroke-brand-400"
                    />
                  )}
                </g>
              );
            })}
            <Button x={34} y={cy + 54} w={58} h={18} label="Rename" />
            <Button x={98} y={cy + 54} w={52} h={18} label="Delete" />
            <Button x={156} y={cy + 54} w={86} h={18} label="Show shapes" />
          </g>
        );
      })}
    </Scene>
  );
}

/** The Image gallery: the upload drop zone, then cards with the image, its name and size, a trash
 *  button, and a Used in N documents or Not used badge. */
export function GalleryCards() {
  const cards = [
    {
      name: 'logo.png',
      size: '640 × 320 · 48 KB',
      used: 'Used in 2 documents',
      hue: 'fill-brand-200',
    },
    {
      name: 'team-photo.jpg',
      size: '1600 × 900 · 1.1 MB',
      used: 'Used in 1 document',
      hue: 'fill-emerald-200',
    },
    { name: 'old-sketch.png', size: '800 × 600 · 210 KB', used: 'Not used', hue: 'fill-amber-200' },
  ];
  return (
    <Scene w={420} h={232} bg="plain">
      <rect
        x={20}
        y={14}
        width={380}
        height={40}
        rx={8}
        className="fill-white stroke-slate-300"
        strokeWidth={1.5}
        strokeDasharray="5 4"
      />
      <Label x={210} y={35} anchor="middle" size={11} tone="muted">
        Drop, paste, or click to upload an image
      </Label>
      {cards.map((c, i) => {
        const cx = 20 + i * 128;
        const cw = 124;
        const unused = c.used === 'Not used';
        return (
          <g key={c.name}>
            <rect
              x={cx}
              y={66}
              width={cw}
              height={152}
              rx={8}
              className="fill-white stroke-slate-200"
              strokeWidth={1.5}
            />
            <Picture x={cx + 8} y={74} w={cw - 16} h={70} hue={c.hue} />
            <Label x={cx + 8} y={156} size={10} weight={600} tone="strong">
              {c.name}
            </Label>
            <Label x={cx + 8} y={170} size={10} tone="muted">
              {c.size}
            </Label>
            {/* Trash button */}
            <g transform={`translate(${cx + cw - 20} ${150})`}>
              <path
                d="M1 3 h10 M3 3 v8 h6 v-8 M4.5 1 h3"
                fill="none"
                className="stroke-rose-500"
                strokeWidth={1.3}
                strokeLinecap="round"
              />
            </g>
            <rect
              x={cx + 7}
              y={182}
              width={unused ? 56 : cw - 14}
              height={18}
              rx={9}
              className={unused ? 'fill-slate-100' : 'fill-brand-50'}
            />
            <Label
              x={cx + 15}
              y={192}
              size={10}
              weight={600}
              className={unused ? 'fill-slate-500' : 'fill-brand-600'}
            >
              {c.used}
            </Label>
          </g>
        );
      })}
    </Scene>
  );
}

/** The Themes page: a card per saved theme (swatch, name, Edit, Duplicate and Delete buttons) and
 *  the dashed New theme card. */
export function SavedThemeCards() {
  const themes = [
    { name: 'Ocean', swatches: ['fill-brand-500', 'fill-brand-300', 'fill-brand-100'] },
    { name: 'Forest', swatches: ['fill-emerald-500', 'fill-emerald-400', 'fill-teal-400'] },
    { name: 'Sunset', swatches: ['fill-rose-500', 'fill-amber-500', 'fill-amber-400'] },
  ];
  return (
    <Scene w={420} h={176} bg="plain">
      <Label x={24} y={22} size={14} weight={700} tone="strong">
        Themes
      </Label>
      {themes.map((t, i) => {
        const tx = 20 + i * 96;
        return (
          <g key={t.name}>
            <rect
              x={tx}
              y={38}
              width={88}
              height={122}
              rx={10}
              className="fill-white stroke-slate-200"
              strokeWidth={1.5}
            />
            <g className="help-art-as-drawn">
              {t.swatches.map((s, j) => (
                <rect
                  key={j}
                  x={tx + 10 + j * 23}
                  y={48}
                  width={22}
                  height={40}
                  rx={j === 0 ? 4 : 0}
                  className={s}
                />
              ))}
            </g>
            <Label x={tx + 10} y={104} size={11} weight={600} tone="strong">
              {t.name}
            </Label>
            {/* Edit, Duplicate, Delete */}
            {[0, 1, 2].map((j) => (
              <g key={j}>
                <rect
                  x={tx + 10 + j * 24}
                  y={120}
                  width={20}
                  height={20}
                  rx={5}
                  className="fill-white stroke-slate-200"
                  strokeWidth={1.2}
                />
                {j === 0 && (
                  <path
                    d={`M${tx + 15} ${135} l1 -3.5 l6 -6 l2.5 2.5 l-6 6 Z`}
                    fill="none"
                    className="stroke-slate-500"
                    strokeWidth={1.1}
                  />
                )}
                {j === 1 && (
                  <g fill="none" className="stroke-slate-500" strokeWidth={1.1}>
                    <rect x={tx + 39} y={126} width={7} height={8} rx={1} />
                    <path d={`M${tx + 42} ${126} v-2 h7 v8 h-3`} />
                  </g>
                )}
                {j === 2 && (
                  <path
                    d={`M${tx + 63} ${126} h10 M${tx + 65} ${126} v8 h6 v-8 M${tx + 66.5} ${124} h3`}
                    fill="none"
                    className="stroke-rose-500"
                    strokeWidth={1.1}
                    strokeLinecap="round"
                  />
                )}
              </g>
            ))}
          </g>
        );
      })}
      <rect
        x={308}
        y={38}
        width={92}
        height={122}
        rx={10}
        className="fill-none stroke-slate-300"
        strokeWidth={1.5}
        strokeDasharray="5 4"
      />
      <path
        d="M354 86 v14 M347 93 h14"
        className="stroke-slate-400"
        strokeWidth={1.8}
        strokeLinecap="round"
      />
      <Label x={354} y={114} anchor="middle" size={10} weight={500} tone="muted">
        New theme
      </Label>
    </Scene>
  );
}
