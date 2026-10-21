'use client';

import { BrowserRepairPanel } from '@livediagram/ui';
import { HelpArticleLink } from '@/components/primitives/HelpArticleLink';
import { buildLoadDiagnostics } from '@/lib/load-diagnostics';
import { track } from '@/lib/telemetry';

// The recovery card under the load-error screen's Retry button (docs/specs/007-editor/load-recovery.md
// "The recovery card"): copy a diagnostics report for support, repair this browser and reload, or
// read the troubleshooting steps. The actions are the shared BrowserRepairPanel, the same one the help
// centre's Repair page renders.
export function LoadRecoveryCard({ ownerId }: { ownerId: string | null }) {
  return (
    <div className="mt-6 w-full border-t border-slate-200 pt-5 text-left dark:border-slate-800">
      <p className="text-sm font-medium text-slate-800 dark:text-slate-100">Still not loading?</p>
      <p className="mt-1 mb-3 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
        Copy the diagnostics to send to support, or repair this browser. A repair keeps your
        documents and identity.
      </p>
      <BrowserRepairPanel
        buildReport={() => buildLoadDiagnostics(ownerId)}
        onCopied={() => track('UI', 'Copied', 'Diagnostics')}
        onRepairStart={() => track('UI', 'Cleared', 'BrowserRepair')}
        onRepaired={() => window.location.reload()}
      >
        <HelpArticleLink
          article="documentNotLoading"
          variant="text"
          label="Troubleshooting steps"
        />
      </BrowserRepairPanel>
    </div>
  );
}
