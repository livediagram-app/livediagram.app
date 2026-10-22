'use client';

// The workbench session the page runs under (docs/specs/013-workspace/blueprints/workbench-embeds.md
// "The editor in a workbench", "The workspace frame"): provided by WorkbenchAuthBridge on /embed/workbench, null
// everywhere else. A project-scope session names its project; a workspace session names none at the frame's
// level, and the frame provides a session naming the open project around the editor it shows. The editor reads
// it to take the workbench branch of every gate; the Explorer reads its scope to take the workbench surface.
import { createContext, useContext } from 'react';
import type {
  WorkbenchEndReason,
  WorkbenchPerson,
  WorkbenchRole,
  WorkbenchScope,
} from '@liveplanner/api-schema';
import type { WorkbenchPort } from '@/lib/workbench/workbench-port';

// Where the editor in a workspace frame is, for `liveplanner:place`.
export type ProjectPlace = {
  projectId: string;
  projectName: string;
  tabId: string;
  tabName: string;
  role: WorkbenchRole;
};

// What a workspace frame lends the editor it shows.
export type WorkspaceFrameHooks = {
  // Back to where the project was opened from (WB59).
  back: () => void;
  // Where Back goes, for its accessible name.
  backTitle: string;
  // The editor says where it is; the frame tells the workbench.
  reportProjectPlace: (place: ProjectPlace) => void;
};

export type WorkbenchSession = {
  scope: WorkbenchScope;
  // The live `lvw_` secret, in memory only; renewal swaps it.
  secret: string;
  // The project the editor shows; null at a workspace frame's own level.
  projectId: string | null;
  // The tab the workbench asked for, or null for the project's first.
  tabId: string | null;
  // A workspace frame opening a project shared with the person opens it by its link (WB53).
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
  // The editor reports an end it learnt of (a trashed project, a refused session, a closed room).
  end: (reason: Exclude<WorkbenchEndReason, 'refused'>) => void;
  // The workspace frame's hooks for the editor it shows; null in the project scope.
  frame: WorkspaceFrameHooks | null;
};

// A session naming the project the editor shows: every project-scope session, and a workspace frame's around
// its open project.
export type WorkbenchProjectSession = WorkbenchSession & { projectId: string };

export const WorkbenchSessionContext = createContext<WorkbenchSession | null>(null);

export function useWorkbenchSession(): WorkbenchSession | null {
  return useContext(WorkbenchSessionContext);
}

const namesProject = (s: WorkbenchSession | null): s is WorkbenchProjectSession =>
  s !== null && s.projectId !== null;

// The session as the editor reads it: null outside a workbench, and at a workspace frame's own level.
export function useWorkbenchProjectSession(): WorkbenchProjectSession | null {
  const session = useWorkbenchSession();
  return namesProject(session) ? session : null;
}
