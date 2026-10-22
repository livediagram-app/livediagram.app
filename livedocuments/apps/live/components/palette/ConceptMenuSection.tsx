'use client';

import {
  PYRAMID_VARIANTS,
  hubDrawsSpokes,
  pyramidVariantOf,
  withHubSpokes,
  withPyramidVariant,
  type ConceptShape,
  type PyramidVariant,
  type ShapeElement,
} from '@livedocuments/document';
import { Glyph } from '@livedocuments/ui';
import { MenuAccordionSection } from '@/components/primitives/PortalMenu';
import { DataMenuGlyph } from '@/components/palette/context-menu-data-rows';
import { BorderGrid, MenuToggleRow } from '@/components/palette/context-menu-rows';
import { SizeButton } from '@/components/palette/palette-controls';
import { onMouseHover } from '@/components/primitives/hover-preview';
import type { ElementStyleOps } from '@/lib/element-style-ops';

const VARIANT_LABEL: Record<PyramidVariant, string> = {
  pyramid: 'Pyramid',
  inverted: 'Inverted',
  funnel: 'Funnel',
};

function VariantIcon({ variant }: { variant: PyramidVariant }) {
  return (
    <Glyph size={18} units={18}>
      {variant === 'pyramid' ? <path d="M9 3 16 15H2Z" /> : null}
      {variant === 'inverted' ? <path d="M2 3h14L9 15Z" /> : null}
      {variant === 'funnel' ? <path d="M2 3h14l-4 6v6H6V9Z" /> : null}
    </Glyph>
  );
}

// Each kind's section title.
const CONCEPT_TITLE: Record<ConceptShape, string> = {
  'layer-stack': 'Layer Stack',
  pyramid: 'Pyramid',
  cycle: 'Cycle',
  hub: 'Hub and Spoke',
  onion: 'Onion',
  chevrons: 'Chevrons',
  'timeline-rail': 'Timeline',
};

// A concept graphic's own section (docs/specs/009-elements/concept-graphics.md): a pyramid's variant, a hub's spokes.
// Its Concept animation is a category of the menu's Animation row (ElementAnimationTiles). The rows have their own Rows section, like a web component's.
export function ConceptMenuSection({
  target,
  ops,
  sectionProps,
}: {
  target: ShapeElement & { shape: ConceptShape };
  ops: ElementStyleOps;
  sectionProps: (id: string) => { open: boolean; onToggle: () => void; flush: boolean };
}) {
  const variant = target.shape === 'pyramid' ? pyramidVariantOf(target) : null;
  const title = CONCEPT_TITLE[target.shape];
  // Only a pyramid and a hub have settings of their own; the others' section would be empty.
  if (!variant && target.shape !== 'hub') return null;
  return (
    <MenuAccordionSection title={title} icon={<DataMenuGlyph />} {...sectionProps('concept')}>
      {target.shape === 'hub' ? (
        <MenuToggleRow
          label="Spokes"
          checked={hubDrawsSpokes(target)}
          onToggle={() =>
            ops.commit((el) => withHubSpokes(el, !hubDrawsSpokes(target)), 'HubSpokes')
          }
        />
      ) : null}
      {variant ? (
        <div className="px-2 pb-1">
          <BorderGrid label="Shape" cols={3}>
            {PYRAMID_VARIANTS.map((v) => (
              <SizeButton
                key={v}
                active={variant === v}
                label={VARIANT_LABEL[v]}
                onClick={() => ops.commit((el) => withPyramidVariant(el, v), 'PyramidVariant')}
                onPointerEnter={onMouseHover(() => ops.preview((el) => withPyramidVariant(el, v)))}
                onPointerLeave={onMouseHover(ops.end)}
              >
                <VariantIcon variant={v} />
              </SizeButton>
            ))}
          </BorderGrid>
        </div>
      ) : null}
    </MenuAccordionSection>
  );
}
