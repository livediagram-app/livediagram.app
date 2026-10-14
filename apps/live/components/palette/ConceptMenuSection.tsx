'use client';

import {
  DEFAULT_ANIMATION_SPEED,
  PYRAMID_VARIANTS,
  conceptAnimOf,
  conceptAnimRepeats,
  conceptAnimsFor,
  hubDrawsSpokes,
  pyramidVariantOf,
  withConceptAnim,
  withHubSpokes,
  withPyramidVariant,
  type ConceptAnim,
  type ConceptShape,
  type PyramidVariant,
  type ShapeElement,
} from '@livediagram/document';
import { Glyph } from '@livediagram/ui';
import { MenuAccordionSection } from '@/components/primitives/PortalMenu';
import { DataMenuGlyph } from '@/components/palette/context-menu-data-rows';
import { BorderGrid, MenuToggleRow } from '@/components/palette/context-menu-rows';
import { SizeButton } from '@/components/palette/palette-controls';
import {
  SpeedAndRepeatRows,
  TileLabel,
  useSpeedRowGate,
  withNone,
} from '@/components/palette/context-menu-tiles';
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

const ANIM_LABEL: Record<ConceptAnim | 'none', string> = {
  none: 'None',
  build: 'Build',
  pulse: 'Pulse',
  flow: 'Flow',
};

function AnimIcon({ anim }: { anim: ConceptAnim | null }) {
  return (
    <Glyph size={16} units={18}>
      {anim === null ? <path d="M4 14 14 4" /> : null}
      {anim === 'build' ? <path d="M3 15h12M5 11h8M7 7h4" /> : null}
      {anim === 'pulse' ? <path d="M2 9h4l2-4 2 8 2-4h4" /> : null}
      {anim === 'flow' ? <path d="M14 6a6 6 0 1 0 1 5M14 2v4h-4" /> : null}
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
};

// A concept graphic's own section (docs/specs/009-elements/concept-graphics.md): a pyramid's variant, and the
// Concept animation with its speed and repeat. The rows have their own Rows section, like a web component's.
export function ConceptMenuSection({
  target,
  ops,
  sectionProps,
}: {
  target: ShapeElement & { shape: ConceptShape };
  ops: ElementStyleOps;
  sectionProps: (id: string) => { open: boolean; onToggle: () => void; flush: boolean };
}) {
  const anim = conceptAnimOf(target);
  const { showSpeed, handleSet } = useSpeedRowGate<ConceptAnim>(anim, (v) =>
    ops.commit((el) => withConceptAnim(el, { anim: v }), 'ConceptAnim'),
  );
  const variant = target.shape === 'pyramid' ? pyramidVariantOf(target) : null;
  const title = CONCEPT_TITLE[target.shape];
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
      <div className="px-2 pb-1">
        <BorderGrid label="Animation" cols={4}>
          {withNone(conceptAnimsFor(target.shape)).map((v) => (
            <SizeButton
              key={v ?? 'none'}
              active={anim === v}
              label={`${ANIM_LABEL[v ?? 'none']} Animation`}
              onClick={() => handleSet(v)}
              onPointerEnter={onMouseHover(() =>
                ops.preview((el) => withConceptAnim(el, { anim: v })),
              )}
              onPointerLeave={onMouseHover(ops.end)}
            >
              <TileLabel glyph={<AnimIcon anim={v} />} label={ANIM_LABEL[v ?? 'none']} />
            </SizeButton>
          ))}
        </BorderGrid>
      </div>
      {showSpeed ? (
        <SpeedAndRepeatRows
          speed={target.conceptAnimSpeed ?? DEFAULT_ANIMATION_SPEED}
          repeat={conceptAnimRepeats(target)}
          onSetSpeed={(speed) => ops.commit((el) => withConceptAnim(el, { speed }), 'ConceptAnim')}
          onSetRepeat={(repeat) =>
            ops.commit((el) => withConceptAnim(el, { repeat }), 'ConceptAnim')
          }
        />
      ) : null}
    </MenuAccordionSection>
  );
}
