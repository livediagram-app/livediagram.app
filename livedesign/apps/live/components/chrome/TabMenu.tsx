import {
  TabMenu as SharedTabMenu,
  type TabMenuBindingProps,
} from '@liveworkspace/workbench/components/chrome/TabMenu';
import { AddTabToDesignDialog } from '@/components/dialogs/TabOrganiseDialogs';
import { useSplitViewContext } from '@/components/split/SplitViewContext';

// The tab menu (liveworkspace/docs/specs/022-interface-design/action-parity.md "The tab menu"): the workbench's one
// menu with this app's words and its Add to Design picker.
export function TabMenu({
  selfId,
  otherDesigns,
  onCopyTo,
  ...menu
}: TabMenuBindingProps & {
  // Viewer identity for the Add to Design dialog's thumbnail fetches.
  selfId: string;
  otherDesigns: { id: string; name: string; savedAt?: number }[];
  onCopyTo: (targetDesignId: string) => void;
}) {
  const split = useSplitViewContext();
  return (
    <SharedTabMenu
      {...menu}
      words={{ item: 'tab', holder: 'design' }}
      split={split}
      copyTo={{
        label: 'Add to Design',
        disabled: otherDesigns.length === 0,
        picker: (close) => (
          <AddTabToDesignDialog
            ownerId={selfId}
            otherDesigns={otherDesigns}
            onPick={onCopyTo}
            onClose={close}
          />
        ),
      }}
    />
  );
}
