import {
  TabMenu as SharedTabMenu,
  type TabMenuBindingProps,
  type TabMenuCopyToProps,
} from '@liveworkspace/workbench/components/chrome/TabMenu';
import { AddTabToDocumentDialog } from '@/components/dialogs/TabOrganiseDialogs';
import { useSplitViewContext } from '@/components/split/SplitViewContext';

// The tab menu (liveworkspace/docs/specs/022-interface-design/action-parity.md "The tab menu"): the workbench's one
// menu with this app's words and its Add to Document picker.
export function TabMenu({
  selfId,
  otherDocuments,
  onCopyTo,
  ...menu
}: TabMenuBindingProps & TabMenuCopyToProps) {
  const split = useSplitViewContext();
  return (
    <SharedTabMenu
      {...menu}
      words={{ item: 'tab', holder: 'document' }}
      split={split}
      copyTo={{
        label: 'Add to Document',
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
    />
  );
}
