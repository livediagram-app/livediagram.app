// Palette illustrations (liveworkspace/docs/specs/017-help/help-centre.md): images and the image picker.
// Composed only from the shared primitives so the house style holds.

import { Scene, SelectionBox, Cursor, Dialog, Tabs } from '@liveworkspace/help-site/art/primitives';

/** An image element placed on the canvas: a framed picture with a sky / hill
 *  motif, selected. */
export function ImageElement() {
  return (
    <Scene w={420} h={220}>
      <g>
        <rect
          x={120}
          y={44}
          width={180}
          height={132}
          rx={8}
          className="fill-slate-100 stroke-brand-300"
          strokeWidth={2}
        />
        {/* picture content clipped feel */}
        <rect x={120} y={44} width={180} height={88} className="fill-brand-100" />
        <circle cx={260} cy={78} r={14} className="fill-amber-300" />
        <path d="M120 132 L172 88 L210 120 L246 96 L300 132 Z" className="fill-emerald-300" />
        <rect x={120} y={132} width={180} height={44} className="fill-slate-200" />
      </g>
      <SelectionBox x={120} y={44} w={180} h={132} />
      <Cursor x={250} y={150} colour="brand" />
    </Scene>
  );
}

/** The image picker open on its Gallery tab (beside Upload and Search): a
 *  grid of reusable thumbnails. */
export function ImagePicker() {
  return (
    <Scene w={420} h={246} bg="plain">
      <Dialog x={70} y={20} w={280} h={206} title="Image" sceneW={420} sceneH={246} scrim={false}>
        <Tabs x={86} y={66} items={['Upload', 'Gallery', 'Search']} active={1} tabW={84} h={22} />
        {[0, 1, 2, 3, 4, 5].map((i) => {
          const col = i % 3;
          const row = Math.floor(i / 3);
          const sx = 90 + col * 84;
          const sy = 98 + row * 62;
          const hues = [
            'fill-brand-200',
            'fill-emerald-200',
            'fill-amber-200',
            'fill-rose-200',
            'fill-violet-200',
            'fill-teal-200',
          ];
          return (
            <g key={i}>
              <rect
                x={sx}
                y={sy}
                width={72}
                height={50}
                rx={6}
                className="fill-slate-100 stroke-slate-200"
                strokeWidth={1.5}
              />
              <rect x={sx} y={sy} width={72} height={32} rx={6} className={hues[i]} />
              <circle cx={sx + 18} cy={sy + 16} r={6} className="fill-white/70" />
            </g>
          );
        })}
      </Dialog>
    </Scene>
  );
}
