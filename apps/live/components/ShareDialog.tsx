'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { initialsOf, randomName, type Participant } from '@/lib/identity';

type ShareDialogProps = {
  participant: Participant;
  // The diagram's current sharing state. Drives whether we show the
  // share URL + Stop sharing button, or the initial "Share this
  // diagram" CTA.
  shareable: boolean;
  shareUrl: string | null;
  // Whether the participant has confirmed their name. If not, the
  // dialog blocks until they do — share invitations need a name to
  // attribute changes / comments / presence to.
  nameConfirmed: boolean;
  onConfirm: (name: string) => Promise<void> | void;
  onUnshare: () => Promise<void> | void;
  onClose: () => void;
};

// Modal dialog opened from the Share button in the editor header. Two
// phases:
//   1. The diagram is private. The user picks (or accepts) a name and
//      clicks "Share Diagram", which generates a share code and
//      unblocks the URL section.
//   2. The diagram is already shared. We show the URL with a Copy
//      button and a "Stop sharing" action that revokes the code.
//
// The dialog is portal-rendered to escape any transformed canvas
// ancestor. Closes on outside click and Escape.
export function ShareDialog({
  participant,
  shareable,
  shareUrl,
  nameConfirmed,
  onConfirm,
  onUnshare,
  onClose,
}: ShareDialogProps) {
  const [name, setName] = useState(participant.name);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const onClick = (e: MouseEvent) => {
      if (!ref.current) return;
      if (e.target instanceof Node && !ref.current.contains(e.target)) onClose();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClick);
    };
  }, [onClose]);

  if (typeof document === 'undefined') return null;

  const trimmedName = name.trim();
  const effectiveName = trimmedName || participant.name;
  // The avatar + name card is always visible so the user can see (and
  // edit) the identity peers will see while they collaborate. The
  // nameConfirmed flag still drives the share button gating below —
  // it just doesn't hide the card any more.
  void nameConfirmed;
  const needsName = !shareable;

  const share = async () => {
    setBusy(true);
    try {
      await onConfirm(effectiveName);
    } finally {
      setBusy(false);
    }
  };

  const unshare = async () => {
    setBusy(true);
    try {
      await onUnshare();
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Some browsers refuse clipboard without a recent gesture; the
      // user can still select the input. Falling through is fine.
    }
  };

  return createPortal(
    <div
      onPointerDown={(e) => e.stopPropagation()}
      className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center"
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        className="pointer-events-auto flex w-[28rem] max-w-[92%] animate-fly-up-in flex-col rounded-xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/10"
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-6 pt-6 pb-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              {shareable ? 'Share this diagram' : 'Share this diagram'}
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              {shareable
                ? 'Anyone with this link can view and edit this diagram in real time.'
                : 'Share a link so collaborators can join in real time.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-2 -mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          >
            <CloseIcon />
          </button>
        </div>

        <div className="flex flex-col gap-4 px-6 py-5">
          {needsName ? (
            <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50/50 p-3">
              <div
                role="img"
                aria-label={`Your avatar colour: ${participant.color}`}
                style={{ backgroundColor: participant.color }}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white"
              >
                {initialsOf(effectiveName)}
              </div>
              <div className="flex-1">
                <label
                  htmlFor="share-name"
                  className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500"
                >
                  Your name
                </label>
                <input
                  id="share-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={participant.name}
                  className="mt-0.5 w-full bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400"
                />
              </div>
              <button
                type="button"
                onClick={() => setName(randomName())}
                aria-label="Generate a different name"
                title="Generate a different name"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              >
                <RefreshIcon />
              </button>
            </div>
          ) : null}

          {shareable && shareUrl ? (
            <div className="flex flex-col gap-2">
              <label
                htmlFor="share-url"
                className="text-[10px] font-semibold uppercase tracking-wider text-slate-500"
              >
                Share link
              </label>
              <div className="flex items-stretch gap-1.5">
                <input
                  id="share-url"
                  readOnly
                  value={shareUrl}
                  onFocus={(e) => e.currentTarget.select()}
                  className="flex-1 rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-800 outline-none focus:border-brand-400"
                />
                <button
                  type="button"
                  onClick={copy}
                  className="inline-flex items-center gap-1 rounded-md bg-brand-500 px-3 py-1.5 text-xs font-medium text-white shadow-sm transition hover:bg-brand-600"
                >
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
            </div>
          ) : null}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-6 py-3">
          {shareable ? (
            <button
              type="button"
              onClick={unshare}
              disabled={busy}
              className="mr-auto inline-flex items-center rounded-md border border-rose-200 bg-white px-3 py-1.5 text-xs font-medium text-rose-700 transition hover:bg-rose-50 disabled:opacity-50"
            >
              Stop sharing
            </button>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Done
          </button>
          {!shareable ? (
            <button
              type="button"
              onClick={share}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-md bg-brand-500 px-4 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-brand-600 disabled:opacity-50"
            >
              <LinkIcon />
              Share Diagram
            </button>
          ) : null}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function CloseIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      aria-hidden
    >
      <path d="M3.5 3.5l7 7M3.5 10.5l7-7" />
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M2.5 8a5.5 5.5 0 0 1 9.4-3.9L13.5 5.5" />
      <path d="M13.5 2.5v3h-3" />
      <path d="M13.5 8a5.5 5.5 0 0 1-9.4 3.9L2.5 10.5" />
      <path d="M2.5 13.5v-3h3" />
    </svg>
  );
}

function LinkIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M7 4.5l1.5-1.5a3.25 3.25 0 0 1 4.6 4.6L11 9.5" />
      <path d="M9 11.5l-1.5 1.5a3.25 3.25 0 0 1-4.6-4.6L5 7" />
      <line x1="6" y1="10" x2="10" y2="6" />
    </svg>
  );
}
