'use client';

// The Mind Map menu section's contents (docs/specs/009-elements/mind-node.md "The Mind Map menu"): three groups,
// Outline, Branching and Spacing, each one of Plan mode's option lists (a bordered box, one full-width row per
// choice, its icon at the left). Everything acts on the selected node's whole MAP, through its root.
import {
  MIND_FLOWS,
  MIND_FLOW_LABEL,
  MIND_SPACINGS,
  MIND_SPACING_LABEL,
  type MindFlow,
  type MindSpacing,
} from '@livediagram/document';
import { OptionRows } from '@/components/plan/OptionRows';
import { MenuGroup } from './plan-menu-parts';
import { MIND_FLOW_ICON, MIND_OUTLINE_ICON, MIND_SPACING_ICON } from './mind-map-menu-glyphs';

type OutlineAction = 'outline' | 'tidy' | 'branch' | 'map';

export function MindMapMenuGroups({
  flow,
  spacing,
  onSetFlow,
  onSetSpacing,
  onTidy,
  onEditOutline,
  onSelectBranch,
  onSelectMap,
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
    <>
      <MenuGroup title="Outline">
        <OptionRows
          kind="action"
          label="Outline"
          className="mx-3 my-1.5"
          rows={outlineRows
            .filter((r) => actions[r.id])
            .map((r) => ({ ...r, icon: MIND_OUTLINE_ICON[r.id] }))}
          onPick={(id) => actions[id as OutlineAction]?.()}
        />
      </MenuGroup>
      <MenuGroup title="Branching">
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
      </MenuGroup>
      <MenuGroup title="Spacing">
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
      </MenuGroup>
    </>
  );
}
