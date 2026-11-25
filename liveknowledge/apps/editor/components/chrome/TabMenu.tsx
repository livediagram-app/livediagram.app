import {
  TabMenu as SharedTabMenu,
  type TabMenuBindingProps,
  type TabMenuCopyToProps,
} from '@liveworkspace/workbench/components/chrome/TabMenu';
import { AddTabToDocumentDialog } from '@/components/dialogs/TabOrganiseDialogs';
import { useSplitViewContext } from '@/components/split/SplitViewContext';

// The canvas menu for the current page (liveworkspace/docs/specs/022-interface-design/action-parity.md "The tab
// menu"): the workbench's one menu with this app's words ("page", "knowledgebase") and its Add to Knowledgebase
// picker. A page has no lock and no tab folder (the page tree is how pages are organised), so neither is offered.
export function TabMenu({
  selfId,
  otherDocuments,
  onCopyTo,
  ...menu
}: Omit<
  TabMenuBindingProps,
  | 'onToggleLock'
  | 'folders'
  | 'currentFolder'
  | 'onMoveToFolder'
  | 'onRemoveFromFolder'
  | 'onSetFolderColour'
> &
  TabMenuCopyToProps) {
  const split = useSplitViewContext();
  return (
    <SharedTabMenu
      {...menu}
      words={{ item: 'page', holder: 'knowledgebase' }}
      split={split}
      // A connected page's name follows its file.
      renameConnected={false}
      copyTo={{
        label: 'Add to Knowledgebase',
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
