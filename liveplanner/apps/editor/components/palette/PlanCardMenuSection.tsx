'use client';

// A Plan card's settings in its element menu (docs/specs/026-plan/plan-board.md "The Plan card"): a Card flyout
// holding a collapsible Card Size row, closed until opened as every menu row is, with the same choice a board makes
// for its cards (CardSizeOptions). One element edit, through PlanContext; absent is Detailed.
import type { ComponentProps } from 'react';
import { readCardSize } from '@liveplanner/items';
import type { ShapeElement } from '@liveplanner/project';
import { PlanIcon } from '@liveplanner/ui';
import { MenuFlyoutSection } from '@liveworkspace/workbench/components/primitives/MenuFlyoutSection';
import { MenuAccordionSection } from '@liveworkspace/workbench/components/primitives/PortalMenu';
import { CardSizeArt } from '@/components/plan/plan-tile-art';
import { usePlan } from '@/components/plan/PlanContext';
import { trackSetup } from '@/components/plan/track-board-setup';
import { CardSizeOptions, InfoNote } from './plan-menu-parts';

type FlyoutProps = Omit<ComponentProps<typeof MenuFlyoutSection>, 'title' | 'icon' | 'children'>;
type SectionProps = { open: boolean; onToggle: () => void; flush?: boolean };

export function PlanCardMenuSection({
  element,
  flyoutProps,
  sectionProps,
}: {
  element: ShapeElement;
  flyoutProps: FlyoutProps;
  // Each row's open state, from the menu scaffold: closed by default, and kept as the menu retargets.
  sectionProps: (id: string) => SectionProps;
}) {
  const plan = usePlan();
  const ref = element.planCard;
  if (!plan || !plan.canEdit || !ref) return null;
  // An older card's retired Compact size reads as Detailed.
  const current = readCardSize(ref.size);
  return (
    <MenuFlyoutSection title="Card" icon={<PlanIcon size={16} />} {...flyoutProps}>
      <MenuAccordionSection
        title="Card Size"
        icon={<CardSizeArt size={current} />}
        {...sectionProps('plan-card-size')}
      >
        <InfoNote>
          How much of the card shows. Its card type’s Display sets what shows at each size.
        </InfoNote>
        <CardSizeOptions
          size={current}
          onPick={(size) => {
            if (current === size) return;
            const { size: _drop, ...rest } = ref;
            plan.updateCard(element.id, size === 'detailed' ? rest : { ...rest, size });
            trackSetup('PlanCardSize');
          }}
        />
      </MenuAccordionSection>
    </MenuFlyoutSection>
  );
}
