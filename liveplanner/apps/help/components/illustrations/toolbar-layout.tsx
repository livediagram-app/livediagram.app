// Scenes for the Toolbar Layout article (docs/specs/007-editor/toolbar-layout.md): the strip across the top
// of the canvas as the category bar, and a category's flyout opening under it. `Strip` and `MenuCard`
// are exported so other scenes draw the editor's top row the same way.
// Composed only from the shared primitives, like every other help scene.
import type {} from 'react';
import { Label } from './primitives';

/** The top-left card, its top-left corner at (x, y): the menu button (☰) and, unless `menuOnly`
 *  (a phone), the open tab's name beside it. 62 wide (34 menu-only) and 32 tall. */
export function MenuCard({ x, y, menuOnly = false }: { x: number; y: number; menuOnly?: boolean }) {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={menuOnly ? 34 : 62}
        height={32}
        rx={9}
        className="fill-white stroke-slate-200"
        strokeWidth={1.5}
      />
      <path
        d={`M${x + 8} ${y + 10}h14M${x + 8} ${y + 16}h14M${x + 8} ${y + 22}h14`}
        className="stroke-slate-500"
        strokeWidth={1.6}
        strokeLinecap="round"
      />
      {!menuOnly && (
        <>
          <line x1={x + 29} y1={y + 9} x2={x + 29} y2={y + 23} className="stroke-slate-200" />
          <Label x={x + 34} y={y + 16} size={10} tone="strong">
            Tab 1
          </Label>
        </>
      )}
    </g>
  );
}
