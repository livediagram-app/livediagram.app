// The editor's verbs on whole plans: open one, start a new one, copy the open one, delete the open one. Plans are
// items of the central index (liveworkspace/docs/one-explorer-contracts.md), so copy and delete go there; the index
// asks this app's api to copy the content. Everything else a plan's row offers (move, rename, favourite, tags, the
// Trash) is the shared Explorer's.
//
// Navigation is deliberately a hard `window.location.assign` rather
// than client routing: the editor's hydration path owns identity +
// load, and the current project is already autosaved, so a reload is
// the simplest correct handoff (docs/specs/007-editor/new-project-route.md).

import { indexClient } from '@/lib/index-client';
import { track } from '@/lib/telemetry';
import type { useConfirm } from '@/hooks/ui/useConfirm';
import { useToast } from '@/hooks/ui/useToast';
import { getSessionSharePassword } from '@/lib/api-client';
import { PROJECT_FAILURE } from '@/lib/write-failure-copy';

type ProjectActionsDeps = {
  projectId: string | null;
  projectName: string;
  confirm: ReturnType<typeof useConfirm>;
  copying: boolean;
  setCopying: (copying: boolean) => void;
  // The link this session came in on: a visitor's copy reads the plan through it.
  sessionShareCode: string | null;
};

export function useProjectActions(deps: ProjectActionsDeps) {
  const { projectId, projectName, confirm, copying, setCopying, sessionShareCode } = deps;
  const toast = useToast();

  const openProject = (id: string, shareCode?: string) => {
    const query = shareCode ? `?s=${encodeURIComponent(shareCode)}` : '';
    window.location.assign(`${window.location.origin}/project/${encodeURIComponent(id)}${query}`);
  };

  // New, from the editor: the /new flow (docs/specs/007-editor/new-project-route.md). The open plan is saved.
  const newProject = () => {
    if (typeof window === 'undefined') return;
    window.location.assign(`${window.location.origin}/new`);
  };

  // A copy of the open plan into the person's own: the index makes it and has this app copy the content, then the
  // editor opens it.
  const makeCopy = async () => {
    if (!projectId || copying) return;
    setCopying(true);
    try {
      const share = sessionShareCode
        ? { code: sessionShareCode, password: getSessionSharePassword() }
        : null;
      const { item } = await indexClient.copyItem(projectId, {}, share);
      track('Project', 'Duplicated', 'Copy');
      window.location.assign(`${window.location.origin}/project/${encodeURIComponent(item.id)}`);
    } catch {
      // Let the person try again.
      setCopying(false);
      toast.error(PROJECT_FAILURE.duplicate(projectName));
    }
  };

  // The command palette's Delete Plan: the open plan to the Trash, then the Explorer, where the Trash restores it.
  const deleteProject = async (id: string) => {
    const ok = await confirm({
      title: 'Delete this plan?',
      message: 'It goes to the Trash, where you can restore it.',
      confirmLabel: 'Delete',
    });
    if (!ok) return;
    try {
      await indexClient.deleteItem(id);
      track('Project', 'Deleted');
      if (id === projectId) window.location.assign(`${window.location.origin}/explorer/trash`);
    } catch {
      toast.error(PROJECT_FAILURE.delete(id === projectId ? projectName : undefined));
    }
  };

  return { newProject, openProject, makeCopy, deleteProject };
}
