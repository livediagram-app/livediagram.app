// A workbench page ends when the editor finds its document in the Trash (docs/specs/013-workspace/
// blueprints/workbench-embeds.md "The workbench page" step 6): the page tells the workbench, the editor
// shows the deleted card without Restore.
import { useEffect } from 'react';
import type { WorkbenchSession } from '@/components/providers/workbench-session-context';

export function useWorkbenchEnd(workbench: WorkbenchSession | null, trashed: boolean): void {
  const end = workbench?.end;
  useEffect(() => {
    if (trashed) end?.('trashed');
  }, [trashed, end]);
}
