'use client';

// A Plan card's settings in its element menu (docs/specs/026-plan/plan-board.md "The Plan card"): a Card flyout
// holding a collapsible Card Size row, closed until opened as every menu row is, with the same choice a board makes
// for its cards (CardSizeOptions). One element edit, through PlanContext; absent is Detailed.
import type { ComponentProps } from 'react';
import type { ShapeElement } from '@livediagram/document';
import { PlanIcon } from '@livediagram/ui';
import { MenuFlyoutSection } from '@/components/primitives/MenuFlyoutSection';
import { MenuAccordionSection } from '@/components/primitives/PortalMenu';
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
  return (
    <MenuFlyoutSection title="Card" icon={<PlanIcon size={16} />} {...flyoutProps}>
      <MenuAccordionSection
        title="Card Size"
        icon={<CardSizeArt size={ref.size ?? 'detailed'} />}
        {...sectionProps('plan-card-size')}
      >
        <InfoNote>
          How much of the card shows. Its card type’s Display sets what shows at each size.
        </InfoNote>
        <CardSizeOptions
          size={ref.size}
          onPick={(size) => {
            if ((ref.size ?? 'detailed') === size) return;
            const { size: _drop, ...rest } = ref;
            plan.updateCard(element.id, size === 'detailed' ? rest : { ...rest, size });
            trackSetup('PlanCardSize');
          }}
        />
      </MenuAccordionSection>
    </MenuFlyoutSection>
  );
}
