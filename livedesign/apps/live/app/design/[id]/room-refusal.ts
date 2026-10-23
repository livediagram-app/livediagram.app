import { apiLoadDesign, apiLoadShared } from '@/lib/api-client';
import { isDesignTrashedError } from '@/lib/design-trashed';

// Why the realtime room turned a join away (docs/specs/013-workspace/trash.md). A design trashed between the
// editor's load and its join refuses the upgrade, which the browser reports only as an abnormal close; REST
// names the reason. The editor repeats its own load, through the share link for a visitor or as the owner
// otherwise, and only a trashed answer counts: a network blip or a password gate leaves the editor as it is.
export async function joinRefusedBecauseTrashed(args: {
  designId: string;
  selfId: string;
  shareCode: string | null;
}): Promise<boolean> {
  try {
    if (args.shareCode) await apiLoadShared(args.shareCode, args.selfId, args.designId);
    else await apiLoadDesign(args.selfId, args.designId);
    return false;
  } catch (err) {
    return isDesignTrashedError(err);
  }
}
