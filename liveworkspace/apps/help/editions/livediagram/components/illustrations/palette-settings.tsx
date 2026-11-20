// Palette behaviour scenes for the Palette Settings articles (Quick-add on Hover): the quick-add "+" menu opened by
// hovering. The Settings dialog panes those articles also show live in settings-dialog.tsx. The + buttons and the
// card of options (Duplicate, Arrow, Pencil, Text: components/canvas/quick-connect-options.tsx) are ./editor-canvas's.

import { Scene, Shape, SelectionBox } from '@liveworkspace/help-site/art/primitives';
import { PlusButton, PlusHandles, QuickAddCard } from './editor-canvas';

/** Quick-add on hover: the selected element's right-hand "+" with the pointer resting on it and its menu already open
 *  beside it, no click needed: a column of options, as on either side edge. */
export function QuickAddHoverMenu() {
  const [x, y, w, h] = [64, 80, 112, 60];
  const cy = y + h / 2;
  const rx = x + w + 13;
  return (
    <Scene w={420} h={210}>
      <Shape x={x} y={y} w={w} h={h} accent label="Idea" />
      <SelectionBox x={x} y={y} w={w} h={h} />
      <PlusHandles x={x} y={y} w={w} h={h} />
      <PlusButton x={rx} y={cy} hot />
      <QuickAddCard x={rx + 12} y={cy - 44} />
      {/* The pointer resting on the "+": a hover, not a click. */}
      <g transform={`translate(${rx + 2} ${cy + 2})`}>
        <path
          d="M0 0 L0 15 L4.2 11 L6.6 16.2 L9.2 15 L6.8 9.8 L12 9.4 Z"
          className="fill-white stroke-slate-700"
          strokeWidth={1}
        />
      </g>
    </Scene>
  );
}
