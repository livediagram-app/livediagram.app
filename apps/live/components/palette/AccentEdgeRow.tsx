'use client';

import {
  ACCENT_EDGES,
  isAccentEdge,
  supportsAccentEdge,
  withAccentEdge,
  withAccentEdgeColor,
  type AccentEdge,
  type Element,
} from '@livediagram/document';
import { SizeButton } from '@/components/palette/palette-controls';
import { BorderGrid } from '@/components/palette/context-menu-rows';
import { ColourRow } from '@/components/palette/context-menu-input-rows';
import { BorderColourIcon } from '@/components/palette/context-menu-icons';
import { MenuActionButton } from '@/components/primitives/PortalMenu';
import { onMouseHover } from '@/components/primitives/hover-preview';
import type { ElementStyleOps } from '@/lib/element-style-ops';
import type { ColourPalette } from '@/components/palette/context-menu-input-rows';

const EDGE_LABEL: Record<AccentEdge | 'none', string> = {
  none: 'No Accent Edge',
  left: 'Left Accent Edge',
  top: 'Top Accent Edge',
  bottom: 'Bottom Accent Edge',
};

// A square outline with the chosen edge drawn thick; None is the plain outline.
function AccentEdgeIcon({ edge }: { edge: AccentEdge | null }) {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden fill="none">
      <rect x="3" y="3" width="12" height="12" rx="2.5" stroke="currentColor" strokeWidth="1.25" />
      {edge === 'left' ? (
        <rect x="3" y="3" width="3" height="12" rx="1" fill="currentColor" />
      ) : null}
      {edge === 'top' ? (
        <rect x="3" y="3" width="12" height="3" rx="1" fill="currentColor" />
      ) : null}
      {edge === 'bottom' ? (
        <rect x="3" y="12" width="12" height="3" rx="1" fill="currentColor" />
      ) : null}
    </svg>
  );
}

// The Border category's Accent Edge row (docs/specs/008-canvas/accent-edge.md): None / Left / Top / Bottom, and
// once an edge is set, its colour. Writes go through the menu's generic style ops, so hover previews and one-step
// commits behave like every other Border tile. Renders nothing for an element that cannot carry an edge.
export function AccentEdgeRow({
  target,
  ops,
  borderColour,
  colourOpen,
  onToggleColour,
  colourPalette,
}: {
  target: Element;
  ops: ElementStyleOps;
  // The colour the border is drawn in: what an edge with no colour of its own shows.
  borderColour: string;
  colourOpen: boolean;
  onToggleColour: () => void;
  colourPalette: ColourPalette;
}) {
  if (!supportsAccentEdge(target) || target.type !== 'shape') return null;
  const edge = isAccentEdge(target.accentEdge) ? target.accentEdge : null;
  const options: (AccentEdge | null)[] = [null, ...ACCENT_EDGES];
  return (
    <div className="px-2 pb-1">
      <BorderGrid label="Accent Edge" cols={4}>
        {options.map((v) => (
          <SizeButton
            key={v ?? 'none'}
            active={edge === v}
            label={EDGE_LABEL[v ?? 'none']}
            onClick={() => ops.commit((el) => withAccentEdge(el, v), 'AccentEdge')}
            onPointerEnter={onMouseHover(() => ops.preview((el) => withAccentEdge(el, v)))}
            onPointerLeave={onMouseHover(ops.end)}
          >
            <AccentEdgeIcon edge={v} />
          </SizeButton>
        ))}
      </BorderGrid>
      {edge ? (
        <>
          <ColourRow
            label="Edge Colour"
            icon={<BorderColourIcon />}
            value={target.accentEdgeColor ?? borderColour}
            open={colourOpen}
            onToggle={onToggleColour}
            onChange={(c) => ops.burst('accentEdgeColor', (el) => withAccentEdgeColor(el, c))}
            onPreview={(c) => ops.preview((el) => withAccentEdgeColor(el, c))}
            onCommit={(c) => ops.commit((el) => withAccentEdgeColor(el, c), 'AccentEdge')}
            onPreviewEnd={ops.end}
            {...colourPalette}
          />
          {target.accentEdgeColor ? (
            <div className="pt-1">
              <MenuActionButton
                label="Match Border"
                onClick={() => ops.commit((el) => withAccentEdgeColor(el, null), 'AccentEdge')}
              />
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
