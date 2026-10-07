'use client';

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Button } from '../Button';
import { CheckIcon, CopyIcon, RefreshIcon } from '../icons';
import { repairBrowserStorage } from './repair';

// The recovery actions (docs/specs/007-editor/load-recovery.md "The recovery card" and "Repair page in
// the help centre"): Copy Diagnostics and Repair This Browser, one component for the editor's
// load-error screen and the help centre's Repair page so the copy and the confirm read the same.
// The repair asks first, inline, listing what is kept: a person who has lost a load is the person
// most worried about losing their documents.

/** How long "Copied" shows before the button reads Copy Diagnostics again. */
const COPIED_FOR_MS = 2_000;

export type BrowserRepairPanelProps = {
  /** Builds the plain-text diagnostics report, on press. */
  buildReport: () => Promise<string>;
  /** Fired after the report is on the clipboard. */
  onCopied?: () => void;
  /** Fired BEFORE the repair clears anything, so its event still reaches the wire. */
  onRepairStart?: () => void;
  /** Runs after the repair: the editor reloads, the help page says it is done. */
  onRepaired: (cleared: number) => void;
  /** Label of the confirm's go button. */
  confirmLabel?: string;
  /** Extra content under the buttons, e.g. a link to the troubleshooting article. */
  children?: ReactNode;
};

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Clipboard refused (no permission, insecure context): fall back to a selected textarea.
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    let ok: boolean;
    try {
      ok = document.execCommand('copy');
    } catch {
      ok = false;
    }
    ta.remove();
    return ok;
  }
}

export function BrowserRepairPanel({
  buildReport,
  onCopied,
  onRepairStart,
  onRepaired,
  confirmLabel = 'Repair and Reload',
  children,
}: BrowserRepairPanelProps) {
  const [copy, setCopy] = useState<'idle' | 'copied' | 'failed'>('idle');
  const [report, setReport] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const confirmId = useId();
  const goRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (copy !== 'copied') return;
    const id = window.setTimeout(() => setCopy('idle'), COPIED_FOR_MS);
    return () => window.clearTimeout(id);
  }, [copy]);

  useEffect(() => {
    if (confirming) goRef.current?.focus();
  }, [confirming]);

  const onCopy = async () => {
    const text = await buildReport();
    if (await copyText(text)) {
      setCopy('copied');
      setReport(null);
      onCopied?.();
    } else {
      // Nothing could copy it: show the report so it can be selected by hand.
      setCopy('failed');
      setReport(text);
    }
  };

  const onRepair = () => {
    onRepairStart?.();
    const { cleared } = repairBrowserStorage();
    onRepaired(cleared.length);
  };

  return (
    <div className="flex w-full flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="secondary" size="sm" onClick={() => void onCopy()}>
          {copy === 'copied' ? <CheckIcon size={14} /> : <CopyIcon size={14} />}
          {copy === 'copied' ? 'Copied' : 'Copy Diagnostics'}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          aria-expanded={confirming}
          aria-controls={confirmId}
          onClick={() => setConfirming((c) => !c)}
        >
          <RefreshIcon size={14} />
          Repair This Browser
        </Button>
      </div>

      {report !== null ? (
        <label className="flex flex-col gap-1 text-xs text-slate-600 dark:text-slate-300">
          Copying was blocked. Select the report below and copy it by hand.
          <textarea
            readOnly
            value={report}
            rows={8}
            className="w-full rounded-md border border-slate-300 bg-white p-2 font-mono text-[11px] text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            onFocus={(e) => e.currentTarget.select()}
          />
        </label>
      ) : null}

      {confirming ? (
        <div
          id={confirmId}
          role="region"
          aria-label="Repair this browser"
          className="rounded-lg border border-slate-200 bg-white p-3 text-left text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
        >
          <p className="font-medium text-slate-900 dark:text-slate-50">
            This clears livediagram&rsquo;s saved settings and caches in this browser.
          </p>
          <p className="mt-1 text-slate-600 dark:text-slate-300">
            Your documents, your guest identity, Offline Mode documents and your sign-in are kept.
            Settings such as panel layout and dismissed tips go back to their defaults.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button ref={goRef} variant="primary" size="sm" onClick={onRepair}>
              {confirmLabel}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : null}

      {children}
    </div>
  );
}
