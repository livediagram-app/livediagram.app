'use client';

import { useEffect, useState } from 'react';
import {
  BrowserRepairPanel,
  formatBrowserChecks,
  formatBrowserIdentity,
  readBrowserIdentity,
  runBrowserChecks,
  type BrowserChecks,
} from '@livediagram/ui';
import { track } from '@/lib/telemetry';

// The Repair page's live panel (docs/specs/007-editor/load-recovery.md "Repair page in the help
// centre"). The help centre shares the editor's origin, so this repairs the editor's storage even
// when the editor itself cannot start. The checks run once on open; the report carries them alone,
// as this page has no load of its own to describe.

async function buildReport(): Promise<string> {
  const checks = await runBrowserChecks();
  return [
    'livediagram diagnostics (help centre)',
    `Time: ${new Date().toISOString()}`,
    ...formatBrowserIdentity(readBrowserIdentity()),
    ...formatBrowserChecks(checks),
  ].join('\n');
}

export function BrowserRepairTool() {
  const [lines, setLines] = useState<string[] | null>(null);
  const [repaired, setRepaired] = useState<number | null>(null);

  useEffect(() => {
    let live = true;
    void runBrowserChecks().then((c: BrowserChecks) => {
      // The browser line leads the report; on the page it is noise, so it is left off.
      if (live)
        setLines([
          ...formatBrowserIdentity(readBrowserIdentity()),
          ...formatBrowserChecks(c).slice(1),
        ]);
    });
    return () => {
      live = false;
    };
  }, []);

  return (
    <div className="not-prose my-6 rounded-xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-900/60">
      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">This browser</p>
      <ul
        aria-live="polite"
        className="mt-2 mb-4 space-y-1 font-mono text-xs text-slate-600 dark:text-slate-300"
      >
        {lines ? lines.map((line) => <li key={line}>{line}</li>) : <li>Checking…</li>}
      </ul>
      {repaired === null ? (
        <BrowserRepairPanel
          buildReport={buildReport}
          onCopied={() => track('UI', 'Copied', 'Diagnostics.Help')}
          onRepairStart={() => track('UI', 'Cleared', 'BrowserRepair.Help')}
          onRepaired={setRepaired}
          confirmLabel="Repair This Browser"
        />
      ) : (
        <p role="status" className="text-sm text-slate-700 dark:text-slate-200">
          Done. Open your document again.{' '}
          <a
            href="/explorer/recent"
            className="font-medium text-brand-600 underline dark:text-brand-400"
          >
            Go to your documents
          </a>
        </p>
      )}
    </div>
  );
}
