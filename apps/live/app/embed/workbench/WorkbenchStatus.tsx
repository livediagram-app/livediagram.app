'use client';

// The workbench page's status screens and their copy (docs/specs/013-workspace/blueprints/
// workbench-embeds.md "Presentation and UX", WB33): bare like an embed's (no header, no Explorer), the
// copy in a `role="status"` region, `refused` and `unbound` headed by an `h1`.
import type { ReactNode } from 'react';
import { LoadErrorCard } from '@/components/chrome/LoadErrorCard';
import type { WorkbenchPhase } from './workbench-machine';

export type WorkbenchStatusPhase = Exclude<WorkbenchPhase, { phase: 'mounted' | 'ended' }>;

export const OPENING_COPY = 'Opening your diagram…';
export const REFUSED_HEADING = 'Open this diagram from your workbench';
export const REFUSED_BODY =
  'This link works once, for a minute. Open the diagram again from your workbench.';

function StatusShell({ children }: { children: ReactNode }) {
  return (
    <main className="relative flex h-dvh items-center justify-center bg-slate-50 p-6 dark:bg-slate-950">
      <div role="status" className="max-w-md text-center">
        {children}
      </div>
    </main>
  );
}

export function WorkbenchStatus({ phase }: { phase: WorkbenchStatusPhase }) {
  switch (phase.phase) {
    case 'refused':
      return (
        <StatusShell>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
            {REFUSED_HEADING}
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
            {REFUSED_BODY}
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
          <p className="text-sm text-slate-600 dark:text-slate-400">{OPENING_COPY}</p>
        </StatusShell>
      );
  }
}
