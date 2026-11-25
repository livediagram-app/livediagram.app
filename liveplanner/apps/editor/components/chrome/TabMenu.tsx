import {
  TabMenu as SharedTabMenu,
  type TabMenuBindingProps,
} from '@liveworkspace/workbench/components/chrome/TabMenu';
import { MenuActionRow } from '@liveworkspace/workbench/components/primitives/PortalMenu';
import { lucideWorkflow } from '@liveworkspace/icons/lucide';
import { lucideGlyph } from '@liveplanner/ui';
import { useSplitViewContext } from '@/components/split/SplitViewContext';

const ViewAsDiagramIcon = lucideGlyph(lucideWorkflow, 16);

// The tab menu (liveworkspace/docs/specs/022-interface-design/action-parity.md "The tab menu"): the workbench's one
// menu with this app's words, its Import… (one dialog, docs/specs/026-plan/plan-tabs.md "The Import dialog") and its
// own row, View As Diagram. A tab's cards stay in their plan, so there is no Add to Another Plan
// (docs/specs/006-project/tab-project-many-to-many.md "Add to Plan").
export function TabMenu({
  onViewAsDiagram,
  ...menu
}: TabMenuBindingProps & {
  // View As Diagram (docs/specs/026-plan/view-as-diagram.md "Where"): a Board tab's board drawn in livediagram.
  onViewAsDiagram?: (() => void) | undefined;
}) {
  const split = useSplitViewContext();
  return (
    <SharedTabMenu
      {...menu}
      words={{ item: 'tab', holder: 'plan' }}
      split={split}
      importLabel="Import…"
      fileRows={
        onViewAsDiagram ? (
          <MenuActionRow
            plain
            icon={<ViewAsDiagramIcon />}
            label="View As Diagram"
            onClick={onViewAsDiagram}
          />
        ) : null
      }
    />
  );
}
