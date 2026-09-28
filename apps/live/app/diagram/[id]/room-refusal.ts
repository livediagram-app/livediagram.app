import { apiLoadDiagram, apiLoadShared } from '@/lib/api-client';
import { isDiagramTrashedError } from '@/lib/diagram-trashed';

// Why the realtime room turned a join away (docs/specs/013-workspace/trash.md). A diagram trashed between the
// editor's load and its join refuses the upgrade, which the browser reports only as an abnormal close; REST
// names the reason. The editor repeats its own load, through the share link for a visitor or as the owner
// otherwise, and only a trashed answer counts: a network blip or a password gate leaves the editor as it is.
export async function joinRefusedBecauseTrashed(args: {
  diagramId: string;
  selfId: string;
  shareCode: string | null;
}): Promise<boolean> {
  try {
    if (args.shareCode) await apiLoadShared(args.shareCode, args.selfId);
    else await apiLoadDiagram(args.selfId, args.diagramId);
    return false;
  } catch (err) {
    return isDiagramTrashedError(err);
  }
}
