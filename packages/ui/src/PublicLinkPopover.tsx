'use client';

// A public link's popover: Public Link on or off, the link while it is on, and Copy Link, beside its anchor (a drawer
// on a phone). A walkthrough's Share uses it, in the editor and in the Explorer's library.

import { useEffect, useId, useState } from 'react';
import { Button } from './Button';
import { CheckIcon, CopyIcon } from './icons/actions';
import { ResponsivePopover } from './ResponsivePopover';
import { SwitchRow } from './Switch';
import { TextInput } from './TextInput';

export function PublicLinkPopover({
  open,
  anchor,
  url,
  title,
  description,
  onShare,
  onClose,
}: {
  open: boolean;
  anchor: HTMLElement | null;
  // The link while it is on, else null.
  url: string | null;
  title: string;
  description: string;
  // Turns it on or off; false when that failed.
  onShare: (on: boolean) => Promise<boolean>;
  onClose: () => void;
}) {
  const titleId = useId();
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);
  const toggle = (on: boolean) => {
    setBusy(true);
    setProblem(null);
    void onShare(on).then((done) => {
      setBusy(false);
      if (!done) setProblem("The link couldn't be changed. Try again.");
    });
  };
  return (
    <ResponsivePopover
      open={open}
      onClose={onClose}
      anchor={anchor}
      titleId={titleId}
      width={360}
      placement="side"
      bare
    >
      <section data-public-link="" className="flex flex-col gap-4 p-5">
        <header>
          <h2 id={titleId} className="text-[16px] font-semibold text-slate-900 dark:text-slate-50">
            {title}
          </h2>
          <p className="mt-1 text-[12px] text-slate-500 dark:text-slate-400">{description}</p>
        </header>
        <SwitchRow checked={url !== null} onChange={toggle} disabled={busy}>
          <span className="text-[13px] font-medium text-slate-800 dark:text-slate-100">
            Public Link
          </span>
        </SwitchRow>
        {url ? (
          <div className="flex items-center gap-2">
            <TextInput
              aria-label="Public link"
              readOnly
              value={url}
              onFocus={(e) => e.currentTarget.select()}
              className="min-w-0 flex-1 text-[12px]"
            />
            <Button
              variant="secondary"
              size="sm"
              onClick={() =>
                void navigator.clipboard?.writeText(url).then(
                  () => setCopied(true),
                  () => setProblem("The link couldn't be copied. Select it and copy it instead."),
                )
              }
            >
              <span className="inline-flex items-center gap-1.5">
                {copied ? <CheckIcon size={13} /> : <CopyIcon size={13} />}
                {copied ? 'Copied' : 'Copy Link'}
              </span>
            </Button>
          </div>
        ) : null}
        {problem ? (
          <p role="alert" className="text-[12px] text-rose-600 dark:text-rose-300">
            {problem}
          </p>
        ) : null}
      </section>
    </ResponsivePopover>
  );
}
