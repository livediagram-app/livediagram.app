'use client';

// The workbench page's status screens and their copy (docs/specs/013-workspace/blueprints/
// workbench-embeds.md "Presentation and UX", WB33, WB65): bare like an embed's (no header, no Explorer), the
// copy in a `role="status"` region, `refused` and `unbound` headed by an `h1`. A workspace frame speaks of the
// workspace, a document frame of the diagram.
import type { ReactNode } from 'react';
import type { WorkbenchScope } from '@liveplanner/api-schema';
import { LoadErrorCard } from '@/components/chrome/LoadErrorCard';
import type { WorkbenchPhase } from './workbench-machine';

type WorkbenchStatusPhase = Exclude<WorkbenchPhase, { phase: 'mounted' | 'ended' }>;

const COPY: Record<
  WorkbenchScope,
  { opening: string; refusedHeading: string; refusedBody: string }
> = {
  document: {
    opening: 'Opening your diagram…',
    refusedHeading: 'Open this diagram from your workbench',
    refusedBody: 'This link works once, for a minute. Open the diagram again from your workbench.',
  },
  workspace: {
    opening: 'Opening your workspace…',
    refusedHeading: 'Open your workspace from your workbench',
    refusedBody: 'This link works once, for a minute. Open it again from your workbench.',
  },
};

function StatusShell({ children }: { children: ReactNode }) {
  return (
    <main className="relative flex h-dvh items-center justify-center bg-slate-50 p-6 dark:bg-slate-950">
      <div role="status" className="max-w-md text-center">
        {children}
      </div>
    </main>
  );
}

export function WorkbenchStatus({
  phase,
  scope = 'document',
}: {
  phase: WorkbenchStatusPhase;
  scope?: WorkbenchScope;
}) {
  const copy = COPY[scope];
  switch (phase.phase) {
    case 'refused':
      return (
        <StatusShell>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
            {copy.refusedHeading}
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
            {copy.refusedBody}
          </p>
        </StatusShell>
      );
    case 'unbound':
      return (
        <StatusShell>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
            This view opens only inside <code className="font-mono">{phase.origin}</code>.
          </h1>
        </StatusShell>
      );
    case 'failed':
      return (
        <main className="relative h-dvh bg-slate-50 dark:bg-slate-950">
          <LoadErrorCard embed ownerId={null} />
        </main>
      );
    default:
      return (
        <StatusShell>
          <p className="text-sm text-slate-600 dark:text-slate-400">{copy.opening}</p>
        </StatusShell>
      );
  }
}
