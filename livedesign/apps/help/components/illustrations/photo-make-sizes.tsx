// The Make Sizes illustrations for the Make Sizes article (docs/specs/018-help/help-app.md; drawing
// docs/specs/031-photo/photo-pages.md "Making sizes"). Real labels from MakeSizesDialog.tsx and PhotoExportPanel.tsx:
// the format tiles (a checkbox each, the photo's preview in the format's shape, its name and pixel size), Select All
// and Clear over the grid, Cancel and "Make 3 Sizes" in the footer; then the toast's Export All Sizes and the Export
// dialog's Photo card with its All Sizes format.

import { Button, Dialog, Label, Scene, TextBar } from '@liveworkspace/help-site/art/primitives';

type Tile = { name: string; size: string; w: number; h: number; on: boolean };

const TILES: Tile[] = [
  { name: 'Instagram Post', size: '1080 x 1350', w: 26, h: 32, on: true },
  { name: 'Instagram Story', size: '1080 x 1920', w: 20, h: 36, on: true },
  { name: 'LinkedIn Post', size: '1200 x 627', w: 38, h: 20, on: false },
  { name: 'X Post', size: '1600 x 900', w: 38, h: 22, on: true },
];

function FormatTile({ x, y, tile }: { x: number; y: number; tile: Tile }) {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={162}
        height={58}
        rx={9}
        className={tile.on ? 'fill-brand-50 stroke-brand-500' : 'fill-white stroke-slate-200'}
        strokeWidth={tile.on ? 2 : 1.5}
      />
      <rect
        x={x + 12 + (38 - tile.w) / 2}
        y={y + 11 + (36 - tile.h) / 2}
        width={tile.w}
        height={tile.h}
        rx={2.5}
        className="fill-brand-200 stroke-brand-400"
        strokeWidth={1}
      />
      <Label x={x + 62} y={y + 24} size={11} weight={600} tone="strong">
        {tile.name}
      </Label>
      <Label x={x + 62} y={y + 40} size={10} tone="muted">
        {tile.size}
      </Label>
      {tile.on && (
        <g>
          <circle cx={x + 148} cy={y + 44} r={7} className="fill-brand-500" />
          <path
            d={`M${x + 144.6} ${y + 44.2}l2.4 2.4 3.8-4.2`}
            className="fill-none stroke-white"
            strokeWidth={1.6}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
      )}
    </g>
  );
}

/** The Make Sizes dialog: the formats as tiles, three ticked, and the footer's Make 3 Sizes. */
export function MakeSizesDialogScene() {
  return (
    <Scene w={420} h={290} bg="plain">
      <Dialog
        x={16}
        y={8}
        w={388}
        h={274}
        title="Make Sizes"
        sceneW={420}
        sceneH={290}
        scrim={false}
      >
        <Label x={32} y={56} size={10} tone="body">
          Now 3000 x 2000 px. Each size becomes a new photo page.
        </Label>
        <Label x={296} y={76} size={10} weight={600} tone="accent">
          Select All
        </Label>
        <Label x={360} y={76} size={10} weight={600} tone="muted">
          Clear
        </Label>
        {TILES.map((t, i) => (
          <FormatTile
            key={t.name}
            x={32 + (i % 2) * 176}
            y={88 + Math.floor(i / 2) * 68}
            tile={t}
          />
        ))}
        <TextBar x={32} y={228} w={120} tone="faint" />
        <Button x={236} y={244} w={64} h={26} label="Cancel" />
        <Button x={308} y={244} w={84} h={26} label="Make 3 Sizes" variant="primary" />
      </Dialog>
    </Scene>
  );
}

/** What follows: the toast's Export All Sizes, and the Photo card's All Sizes format that downloads the same .zip. */
export function ExportAllSizesScene() {
  return (
    <Scene w={420} h={190} bg="plain">
      <rect x={16} y={14} width={250} height={36} rx={10} className="fill-slate-800" />
      <g className="help-art-as-drawn">
        <Label x={30} y={33} size={11} weight={600} className="fill-white">
          Made 3 sizes.
        </Label>
        <Label x={156} y={33} size={11} weight={700} className="fill-brand-300">
          Export All Sizes
        </Label>
      </g>
      <Dialog x={16} y={64} w={388} h={118} title="Export" sceneW={420} sceneH={190} scrim={false}>
        <Label x={32} y={112} size={10} weight={700} tone="muted">
          FORMAT
        </Label>
        {['PNG', 'JPEG', 'WebP', 'PSD', 'Layers as Files', 'All Sizes'].map((f, i) => {
          const on = f === 'All Sizes';
          const w = f === 'Layers as Files' ? 88 : f === 'All Sizes' ? 62 : 42;
          const xs = [32, 78, 124, 170, 216, 310];
          return (
            <g key={f}>
              <rect
                x={xs[i]}
                y={122}
                width={w}
                height={22}
                rx={7}
                className={on ? 'fill-brand-50 stroke-brand-500' : 'fill-white stroke-slate-300'}
                strokeWidth={on ? 2 : 1.4}
              />
              <Label
                x={(xs[i] ?? 0) + w / 2}
                y={134}
                anchor="middle"
                size={10}
                weight={on ? 700 : 500}
                tone={on ? 'accent' : 'body'}
              >
                {f}
              </Label>
            </g>
          );
        })}
        <Label x={32} y={162} size={10} tone="muted">
          A .zip of every photo page, named by its size.
        </Label>
      </Dialog>
    </Scene>
  );
}
