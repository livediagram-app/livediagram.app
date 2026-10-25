'use client';

import {
  BOUNDARY_STYLES,
  boundaryStyleOf,
  withBoundaryMeta,
  withBoundaryStyle,
  type BoundaryStyle,
  type ShapeElement,
} from '@livediagram/document';
import { Glyph } from '@livediagram/ui';
import { MenuAccordionSection } from '@/components/primitives/PortalMenu';
import { DataMenuGlyph } from '@/components/palette/context-menu-data-rows';
import { BorderGrid, MenuToggleRow } from '@/components/palette/context-menu-rows';
import { SizeButton } from '@/components/palette/palette-controls';
import { onMouseHover } from '@liveworkspace/workbench/components/primitives/hover-preview';
import type { ElementStyleOps } from '@/lib/element-style-ops';

const STYLE_LABEL: Record<BoundaryStyle, string> = {
  tab: 'Tab Style',
  inset: 'Inset Style',
  c4: 'C4 Style',
};

// Where each style puts the title: a tab on the top edge, inside the top-left corner, at the bottom-left.
function StyleIcon({ style }: { style: BoundaryStyle }) {
  return (
    <Glyph size={18} units={18}>
      <rect x="2.5" y="4.5" width="13" height="11" rx="1.5" strokeDasharray="2.5 2" />
      {style === 'tab' ? (
        <rect x="4" y="2.5" width="6" height="4" rx="1" fill="currentColor" />
      ) : null}
      {style === 'inset' ? <path d="M4.5 7.5h5" /> : null}
      {style === 'c4' ? <path d="M4.5 13h5" /> : null}
    </Glyph>
  );
}

// A boundary's section (docs/specs/009-elements/boundary.md "The menu"): its meta line, and its three styles.
export function BoundaryMenuSection({
  target,
  ops,
  sectionProps,
}: {
  target: ShapeElement;
  ops: ElementStyleOps;
  sectionProps: (id: string) => { open: boolean; onToggle: () => void; flush: boolean };
}) {
  const current = boundaryStyleOf(target);
  return (
    <MenuAccordionSection title="Boundary" icon={<DataMenuGlyph />} {...sectionProps('boundary')}>
      <MenuToggleRow
        label="Meta Line"
        checked={!!target.pageSubtitle}
        onToggle={() =>
          ops.commit((el) => withBoundaryMeta(el, !target.pageSubtitle), 'BoundaryMeta')
        }
      />
      <div className="px-2 pb-1">
        <BorderGrid label="Style" cols={3}>
          {BOUNDARY_STYLES.map((v) => (
            <SizeButton
              key={v}
              active={current === v}
              label={STYLE_LABEL[v]}
              onClick={() => ops.commit((el) => withBoundaryStyle(el, v), 'BoundaryStyle')}
              onPointerEnter={onMouseHover(() => ops.preview((el) => withBoundaryStyle(el, v)))}
              onPointerLeave={onMouseHover(ops.end)}
            >
              <StyleIcon style={v} />
            </SizeButton>
          ))}
        </BorderGrid>
      </div>
    </MenuAccordionSection>
  );
}
