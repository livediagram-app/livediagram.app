'use client';

import {
  CHIP_LOOKS,
  chipLookOf,
  detachChip,
  renumberSteps,
  withChipLook,
  type ChipLook,
  type ShapeElement,
} from '@liveplanner/document';
import { Glyph } from '@liveplanner/ui';
import { MenuAccordionSection, MenuActionButton } from '@/components/primitives/PortalMenu';
import { DataMenuGlyph } from '@/components/palette/context-menu-data-rows';
import { BorderGrid } from '@/components/palette/context-menu-rows';
import { SizeButton } from '@/components/palette/palette-controls';
import { onMouseHover } from '@/components/primitives/hover-preview';
import type { ElementStyleOps } from '@/lib/element-style-ops';

const LOOK_LABEL: Record<ChipLook, string> = {
  solid: 'Solid Look',
  ink: 'Ink Look',
  outline: 'Outline Look',
  tinted: 'Tinted Look',
  quiet: 'Quiet Look',
};

// A pill in each look, drawn in currentColor so the tile reads in either theme.
function LookIcon({ look }: { look: ChipLook }) {
  const filled = look === 'solid' || look === 'ink';
  return (
    <Glyph size={18} units={18}>
      <rect
        x="2.5"
        y="5.5"
        width="13"
        height="7"
        rx="3.5"
        fill={filled ? 'currentColor' : look === 'outline' ? 'none' : 'currentColor'}
        fillOpacity={look === 'tinted' ? 0.3 : look === 'quiet' ? 0.12 : 1}
        strokeOpacity={look === 'quiet' ? 0.4 : 1}
      />
    </Glyph>
  );
}

// A badge's or step number's own section (docs/specs/009-elements/badge.md "The menu",
// docs/specs/009-elements/step-number.md): its look, Detach while it is attached, and on a step Renumber Steps,
// which reaches every step on the tab.
export function ChipMenuSection({
  target,
  ops,
  sectionProps,
}: {
  target: ShapeElement;
  ops: ElementStyleOps;
  sectionProps: (id: string) => { open: boolean; onToggle: () => void; flush: boolean };
}) {
  const isStep = target.shape === 'step';
  const look = chipLookOf(target);
  return (
    <MenuAccordionSection
      title={isStep ? 'Step Number' : 'Badge'}
      icon={<DataMenuGlyph />}
      {...sectionProps('chip')}
    >
      <div className="px-2 pb-1">
        <BorderGrid label="Look" cols={5}>
          {CHIP_LOOKS.map((v) => (
            <SizeButton
              key={v}
              active={look === v}
              label={LOOK_LABEL[v]}
              onClick={() => ops.commit((el) => withChipLook(el, v), 'ChipLook')}
              onPointerEnter={onMouseHover(() => ops.preview((el) => withChipLook(el, v)))}
              onPointerLeave={onMouseHover(ops.end)}
            >
              <LookIcon look={v} />
            </SizeButton>
          ))}
        </BorderGrid>
      </div>
      <div className="flex flex-col gap-1 px-2 pb-1.5 pt-1">
        {target.attachedTo ? (
          <MenuActionButton
            label="Detach"
            onClick={() => ops.commit((el) => detachChip(el), 'ChipDetach')}
          />
        ) : null}
        {isStep ? (
          <MenuActionButton
            label="Renumber Steps"
            onClick={() => ops.commitTab(renumberSteps, 'RenumberSteps')}
          />
        ) : null}
      </div>
    </MenuAccordionSection>
  );
}
