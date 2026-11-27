import {
  TabMenu as SharedTabMenu,
  type TabMenuBindingProps,
  type TabMenuCopyToProps,
} from '@liveworkspace/workbench/components/chrome/TabMenu';
import { MenuActionRow } from '@liveworkspace/workbench/components/primitives/PortalMenu';
import { AddTabToDocumentDialog } from '@/components/dialogs/TabOrganiseDialogs';
import { MakePlanCardsIcon } from '@/components/plan-cards/MakePlanCardsButton';
import { useSplitViewContext } from '@/components/split/SplitViewContext';

// The tab menu (liveworkspace/docs/specs/022-interface-design/action-parity.md "The tab menu"): the workbench's one
// menu with this app's words, its Add to Another Canvas picker and its own row, Make Plan Cards.
export function TabMenu({
  selfId,
  otherDocuments,
  onCopyTo,
  onMakePlanCards,
  ...menu
}: TabMenuBindingProps &
  TabMenuCopyToProps & {
    // Make Plan Cards (docs/specs/013-workspace/make-plan-cards.md "Where"): the tab's shapes as plan cards, where
    // offered.
    onMakePlanCards?: (() => void) | undefined;
  }) {
  const split = useSplitViewContext();
  return (
    <SharedTabMenu
      {...menu}
      words={{ item: 'tab', holder: 'canvas' }}
      split={split}
      copyTo={{
        label: 'Add to Another Canvas',
        disabled: otherDocuments.length === 0,
        picker: (close) => (
          <AddTabToDocumentDialog
            ownerId={selfId}
            otherDocuments={otherDocuments}
            onPick={onCopyTo}
            onClose={close}
          />
        ),
      }}
      fileRows={
        onMakePlanCards ? (
          <MenuActionRow
            plain
            icon={<MakePlanCardsIcon />}
            label="Make Plan Cards"
            onClick={onMakePlanCards}
          />
        ) : null
      }
    />
  );
}
