// The top corners of the editor for the User Interface › Share, Copy and Your Account article
// (docs/specs/018-help/help-app.md). The editor has no header bar: drawn from the live chrome, the logo's card
// and the menu button's at the top left (ToolbarExplorerButton) and, at the top right, the card holding Share
// and the account (EditorCornerActions). Labels are the real UI strings.

import { Label, Scene } from '@liveworkspace/help-site/art/primitives';
import { MenuCard } from './toolbar-layout';
import { CornerActionsCard, LogoCard } from './user-interface-chrome';

/** A callout under a card: a thin leader from the card's foot down to its words. */
function Callout({
  x,
  top,
  text,
  anchor = 'middle',
  labelX,
  row = 1,
}: {
  x: number;
  top: number;
  row?: 1 | 2;
  text: string;
  anchor?: 'start' | 'middle' | 'end';
  labelX?: number;
}) {
  const labelY = row === 1 ? 68 : 86;
  return (
    <g>
      <line
        x1={x}
        y1={top}
        x2={x}
        y2={labelY - 9}
        className="stroke-slate-300"
        strokeWidth={1}
        strokeDasharray="2 2"
      />
      <circle cx={x} cy={top} r={1.8} className="fill-slate-400" />
      <Label x={labelX ?? x} y={labelY} size={10} weight={600} tone="body" anchor={anchor}>
        {text}
      </Label>
    </g>
  );
}

/** The top of the editor as the owner of a shared space sees it: the logo and the menu button at the left,
 *  and at the right the card with a solid Share button and the account. */
export function CornerActionsParts() {
  const y = 14;
  return (
    <Scene w={420} h={100}>
      <LogoCard x={12} y={y} />
      <MenuCard x={44} y={y} menuOnly />
      <CornerActionsCard x={344} y={y} />
      <Callout x={26} top={y + 32} text="Logo" />
      <Callout x={61} top={y + 32} text="Menu" row={2} />
      <Callout x={365} top={y + 32} text="Share" />
      <Callout x={395} top={y + 32} text="Account" anchor="end" labelX={414} row={2} />
    </Scene>
  );
}
