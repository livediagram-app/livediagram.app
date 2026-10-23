// The editor's verbs on whole designs: open one, start a new one, copy the open one, delete the open one. Designs are
// items of the central index (liveworkspace/docs/one-explorer-contracts.md), so copy and delete go there; the index
// asks this app's api to copy the content. Everything else a design's row offers (move, rename, favourite, the
// Trash) is the shared Explorer's.
//
// Navigation is deliberately a hard `window.location.assign` rather
// than client routing: the editor's hydration path owns identity +
// load, and the current design is already autosaved, so a reload is
// the simplest correct handoff (docs/specs/007-editor/new-design-route.md).

import { indexClient } from '@/lib/index-client';
import { track } from '@/lib/telemetry';
import type { useConfirm } from '@/hooks/ui/useConfirm';
import { trashOpenDesign } from '@/lib/design-delete-undo';
import { useToast } from '@/hooks/ui/useToast';
import { getSessionSharePassword } from '@/lib/api-client';
import { DESIGN_FAILURE } from '@/lib/write-failure-copy';

type DesignActionsDeps = {
  designId: string | null;
  designName: string;
  confirm: ReturnType<typeof useConfirm>;
  copying: boolean;
  setCopying: (copying: boolean) => void;
  // The link this session came in on: a visitor's copy reads the design through it.
  sessionShareCode: string | null;
};

export function useDesignActions(deps: DesignActionsDeps) {
  const { designId, designName, copying, setCopying, sessionShareCode } = deps;
  const toast = useToast();

  const openDesign = (id: string, shareCode?: string) => {
    const query = shareCode ? `?s=${encodeURIComponent(shareCode)}` : '';
    window.location.assign(`${window.location.origin}/design/${encodeURIComponent(id)}${query}`);
  };

  // New, from the editor: the /new flow (docs/specs/007-editor/new-design-route.md). The open design is saved.
  const newDesign = () => {
    if (typeof window === 'undefined') return;
    window.location.assign(`${window.location.origin}/new`);
  };

  // A copy of the open design into the person's own: the index makes it and has this app copy the content, then the
  // editor opens it.
  const makeCopy = async () => {
    if (!designId || copying) return;
    setCopying(true);
    try {
      const share = sessionShareCode
        ? { code: sessionShareCode, password: getSessionSharePassword() }
        : null;
      const { item } = await indexClient.copyItem(designId, {}, share);
      track('Document', 'Duplicated', 'Copy');
      window.location.assign(`${window.location.origin}/design/${encodeURIComponent(item.id)}`);
    } catch {
      // Let the person try again.
      setCopying(false);
      toast.error(DESIGN_FAILURE.duplicate(designName));
    }
  };

  // The command palette's Delete Design, as every delete (docs/specs/013-workspace/trash.md "Deleting"): nothing is
  // asked, the design stops saving and goes to the Trash, and the Explorer offers the Undo. Another design's id (none
  // today) goes the same way without leaving.
  const deleteDesign = async (id: string) => {
    const ok =
      id === designId
        ? await trashOpenDesign(id, designName)
        : await indexClient.deleteItem(id).then(
            () => (track('Document', 'Deleted'), true),
            () => false,
          );
    if (!ok) toast.error(DESIGN_FAILURE.delete(id === designId ? designName : undefined));
  };

  return { newDesign, openDesign, makeCopy, deleteDesign };
}
