'use client';

// The Mind Map menu category (docs/specs/009-elements/mind-node.md "The Mind Map menu"): a flyout row holding three
// categories, Outline, Branching and Spacing, each a closed accordion around one of Plan mode's option lists (a
// bordered box, one full-width row per choice, its icon at the left). Everything acts on the selected node's whole
// MAP, through its root.
import type { ComponentProps } from 'react';
import {
  MIND_FLOWS,
  MIND_FLOW_LABEL,
  MIND_SPACINGS,
  MIND_SPACING_LABEL,
  type MindFlow,
  type MindSpacing,
} from '@livediagram/document';
import { lucideGlyph } from '@livediagram/ui';
import {
  lucideBetweenHorizontalStart,
  lucideListTree,
  lucideNetwork,
} from '@livediagram/icons/lucide';
import { OptionRows } from '@/components/plan/OptionRows';
import { MenuAccordionSection } from '@/components/primitives/PortalMenu';
import { MenuFlyoutSection } from '@/components/primitives/MenuFlyoutSection';
import { MENU_ICON_PX } from './context-menu-icons';
import { DataMenuGlyph } from './context-menu-rows';
import { MIND_FLOW_ICON, MIND_OUTLINE_ICON, MIND_SPACING_ICON } from './mind-map-menu-glyphs';

const OutlineGlyph = lucideGlyph(lucideListTree, MENU_ICON_PX);
const BranchingGlyph = lucideGlyph(lucideNetwork, MENU_ICON_PX);
const SpacingGlyph = lucideGlyph(lucideBetweenHorizontalStart, MENU_ICON_PX);

type OutlineAction = 'outline' | 'tidy' | 'branch' | 'map';
type SectionProps = { open: boolean; onToggle: () => void; flush?: boolean };

export function MindMapMenuSections({
  flow,
  spacing,
  onSetFlow,
  onSetSpacing,
  onTidy,
  onEditOutline,
  onSelectBranch,
  onSelectMap,
  sectionProps,
  flyoutProps,
}: {
  flow: MindFlow;
  spacing: MindSpacing;
  onSetFlow: (flow: MindFlow) => void;
  onSetSpacing: (spacing: MindSpacing) => void;
  onTidy: () => void;
  // Absent while the outline cannot be edited (a locked tab, edits blocked).
  onEditOutline?: () => void;
  onSelectBranch: () => void;
  onSelectMap: () => void;
  sectionProps: (id: string) => SectionProps;
  // The Mind Map category's own row: open state and placement, as the host gives every flyout.
  flyoutProps: Omit<ComponentProps<typeof MenuFlyoutSection>, 'title' | 'icon' | 'children'>;
}) {
  const actions: Record<OutlineAction, (() => void) | undefined> = {
    outline: onEditOutline,
    tidy: onTidy,
    branch: onSelectBranch,
    map: onSelectMap,
  };
  const outlineRows: { id: OutlineAction; label: string }[] = [
    { id: 'outline', label: 'Edit Outline' },
    { id: 'tidy', label: 'Tidy Map' },
    { id: 'branch', label: 'Select Branch' },
    { id: 'map', label: 'Select Whole Map' },
  ];
  return (
    <MenuFlyoutSection title="Mind Map" icon={<DataMenuGlyph />} {...flyoutProps}>
      <MenuAccordionSection
        title="Outline"
        icon={<OutlineGlyph />}
        {...sectionProps('mind-outline')}
      >
        <OptionRows
          kind="action"
          label="Outline"
          className="mx-3 my-1.5"
          rows={outlineRows
            .filter((r) => actions[r.id])
            .map((r) => ({ ...r, icon: MIND_OUTLINE_ICON[r.id] }))}
          onPick={(id) => actions[id as OutlineAction]?.()}
        />
      </MenuAccordionSection>
      <MenuAccordionSection
        title="Branching"
        icon={<BranchingGlyph />}
        {...sectionProps('mind-branching')}
      >
        <OptionRows
          kind="single"
          label="Branching"
          className="mx-3 my-1.5"
          selected={flow}
          rows={MIND_FLOWS.map((f) => ({
            id: f,
            label: MIND_FLOW_LABEL[f],
            icon: MIND_FLOW_ICON[f],
          }))}
          onPick={(id) => onSetFlow(id as MindFlow)}
        />
      </MenuAccordionSection>
      <MenuAccordionSection
        title="Spacing"
        icon={<SpacingGlyph />}
        {...sectionProps('mind-spacing')}
      >
        <OptionRows
          kind="single"
          label="Spacing"
          className="mx-3 my-1.5"
          selected={spacing}
          rows={MIND_SPACINGS.map((s) => ({
            id: s,
            label: MIND_SPACING_LABEL[s],
            icon: MIND_SPACING_ICON[s],
          }))}
          onPick={(id) => onSetSpacing(id as MindSpacing)}
        />
      </MenuAccordionSection>
    </MenuFlyoutSection>
  );
}
