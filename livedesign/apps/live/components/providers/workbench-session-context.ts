'use client';

// The workbench session the page runs under (docs/specs/013-workspace/blueprints/workbench-embeds.md
// "The editor in a workbench", "The workspace frame"): provided by WorkbenchAuthBridge on /embed/workbench, null
// everywhere else. A design-scope session names its design; a workspace session names none at the frame's
// level, and the frame provides a session naming the open design around the editor it shows. The editor reads
// it to take the workbench branch of every gate; the Explorer reads its scope to take the workbench surface.
import { createContext, useContext } from 'react';
import type {
  WorkbenchEndReason,
  WorkbenchPerson,
  WorkbenchRole,
  WorkbenchScope,
} from '@livedesign/api-schema';
import type { WorkbenchPort } from '@/lib/workbench/workbench-port';

// Where the editor in a workspace frame is, for `livedesign:place`.
export type DesignPlace = {
  designId: string;
  designName: string;
  tabId: string;
  tabName: string;
  role: WorkbenchRole;
};

// What a workspace frame lends the editor it shows.
export type WorkspaceFrameHooks = {
  // Back to where the design was opened from (WB59).
  back: () => void;
  // Where Back goes, for its accessible name.
  backTitle: string;
  // The editor says where it is; the frame tells the workbench.
  reportDesignPlace: (place: DesignPlace) => void;
};

export type WorkbenchSession = {
  scope: WorkbenchScope;
  // The live `lvw_` secret, in memory only; renewal swaps it.
  secret: string;
  // The design the editor shows; null at a workspace frame's own level.
  designId: string | null;
  // The tab the workbench asked for, or null for the design's first.
  tabId: string | null;
  // A workspace frame opening a design shared with the person opens it by its link (WB53).
  shareCode: string | null;
  origin: string;
  level: WorkbenchRole;
  expiresAt: number;
  person: WorkbenchPerson;
  // The workbench's name from `hello-ack`, for copy ("Reconnect in Acme Editor").
  workbenchName: string;
  port: WorkbenchPort;
  // Why the page stopped editing, or null while it edits.
  ended: Exclude<WorkbenchEndReason, 'refused'> | null;
  // The editor reports an end it learnt of (a trashed design, a refused session, a closed room).
  end: (reason: Exclude<WorkbenchEndReason, 'refused'>) => void;
  // The workspace frame's hooks for the editor it shows; null in the design scope.
  frame: WorkspaceFrameHooks | null;
};

// A session naming the design the editor shows: every design-scope session, and a workspace frame's around
// its open design.
export type WorkbenchDesignSession = WorkbenchSession & { designId: string };

export const WorkbenchSessionContext = createContext<WorkbenchSession | null>(null);

export function useWorkbenchSession(): WorkbenchSession | null {
  return useContext(WorkbenchSessionContext);
}

const namesDesign = (s: WorkbenchSession | null): s is WorkbenchDesignSession =>
  s !== null && s.designId !== null;

// The session as the editor reads it: null outside a workbench, and at a workspace frame's own level.
export function useWorkbenchDesignSession(): WorkbenchDesignSession | null {
  const session = useWorkbenchSession();
  return namesDesign(session) ? session : null;
}
