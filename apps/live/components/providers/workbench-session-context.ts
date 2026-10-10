'use client';

// The workbench session the editor runs under (docs/specs/013-workspace/blueprints/workbench-embeds.md
// "The editor in a workbench"): provided by WorkbenchAuthBridge around the editor on /embed/workbench,
// null everywhere else. The editor reads it to take the workbench branch of every gate.
import { createContext, useContext } from 'react';
import type { WorkbenchEndReason, WorkbenchPerson, WorkbenchRole } from '@livediagram/api-schema';
import type { WorkbenchPort } from '@/lib/workbench/workbench-port';

export type WorkbenchSession = {
  // The live `lvw_` secret, in memory only; renewal swaps it.
  secret: string;
  documentId: string;
  // The tab the workbench asked for, or null for the document's first.
  tabId: string | null;
  origin: string;
  level: WorkbenchRole;
  expiresAt: number;
  person: WorkbenchPerson;
  // The workbench's name from `hello-ack`, for copy ("Reconnect in Acme Editor").
  workbenchName: string;
  port: WorkbenchPort;
  // Why the page stopped editing, or null while it edits.
  ended: Exclude<WorkbenchEndReason, 'refused'> | null;
  // The editor reports an end it learnt of (a trashed document, a refused session, a closed room).
  end: (reason: Exclude<WorkbenchEndReason, 'refused'>) => void;
};

export const WorkbenchSessionContext = createContext<WorkbenchSession | null>(null);

export function useWorkbenchSession(): WorkbenchSession | null {
  return useContext(WorkbenchSessionContext);
}
