import { useId } from 'react';
import { Callout, Stage, Window } from '@liveworkspace/help-site/art/parts';
import { CLUSTER_W, topRowStripX } from '../illustrations/editor-chrome';
import { EditorView } from '../illustrations/canvas-basics';

// The editor drawn into the window's body: 470 wide at this scale fills the 372 inside the frame.
const K = 372 / 470;
const EW = 470;
const EH = Math.round(178 / K);
const OX = 14;
const OY = 32;
const at = (x: number, y: number) => [OX + x * K, OY + y * K] as const;

// User Interface: the editor laid out (Panel Layout), with numbered callouts on its parts: 1 the logo and menu cards,
// 2 the palette strip, 3 the bottom-right cluster (Undo | Redo and the zoom) and 4 the bottom bar with its tabs and
// the quick controls at its end, round two slides.
export function UserInterfaceArt() {
  const clip = `ui-art-${useId().replace(/:/g, '')}`;
  const [c1x, c1y] = at(8, 6);
  const [c2x, c2y] = at(topRowStripX(EW) + 4, 6);
  const [c3x, c3y] = at(EW - 8 - CLUSTER_W - 6, EH - 26 - 20);
  const [c4x, c4y] = at(8, EH - 26);
  return (
    <Stage>
      <defs>
        <clipPath id={clip}>
          <rect x={14} y={10} width={372} height={200} rx={12} />
        </clipPath>
      </defs>
      <Window x={14} y={10} w={372} h={200} title="Launch Plan · livedocuments">
        <g clipPath={`url(#${clip})`}>
          <g transform={`translate(${OX} ${OY}) scale(${K})`}>
            <rect width={EW} height={EH} className="fill-slate-50" />
            <EditorView w={EW} h={EH} />
          </g>
        </g>
      </Window>
      <Callout cx={c1x} cy={c1y} n={1} />
      <Callout cx={c2x} cy={c2y} n={2} />
      <Callout cx={c3x} cy={c3y} n={3} />
      <Callout cx={c4x} cy={c4y} n={4} />
    </Stage>
  );
}
