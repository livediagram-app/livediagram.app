'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { initialsOf, randomName, type Participant } from '@/lib/identity';
import type { ShareLink, ShareRole } from '@/lib/api-client';
import { Tooltip } from './Tooltip';

type ShareDialogProps = {
  participant: Participant;
  links: ShareLink[];
  shareUrlFor: (code: string) => string;
  // Whether the owner has confirmed their name (drives the share button
  // behaviour but no longer hides the identity card).
  nameConfirmed: boolean;
  // When non-null, the owner is signed in via Clerk and their
  // display name is dictated by their account — the input
  // becomes read-only and the shuffle button hides. Mirrors the
  // welcome modal's lockedName treatment (spec/04).
  lockedName?: string | null;
  onSaveName: (name: string) => Promise<void> | void;
  onCreateLink: (role: ShareRole) => Promise<void> | void;
  onRevokeLink: (code: string) => Promise<void> | void;
  onClose: () => void;
};

// Share-diagram modal. Lists every active share link, lets the owner
// create new ones with a role (Edit / View-only), and revoke any link
// individually. The identity card is always visible so the owner can
// see / edit the name peers see on their cursor and comments.
export function ShareDialog({
  participant,
  links,
  shareUrlFor,
  nameConfirmed,
  lockedName,
  onSaveName,
  onCreateLink,
  onRevokeLink,
  onClose,
}: ShareDialogProps) {
  // When a Clerk display name is supplied, the input always reads
  // that value — even if the participant record was originally
  // created under a guest alias.
  const [name, setName] = useState(lockedName ?? participant.name);
  const nameLocked = !!lockedName;
  const [busy, setBusy] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [newRole, setNewRole] = useState<ShareRole>('edit');
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
  void nameConfirmed;

  const create = async () => {
    setBusy(true);
    try {
      if (effectiveName !== participant.name) await onSaveName(effectiveName);
      await onCreateLink(newRole);
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (code: string) => {
    setBusy(true);
    try {
      await onRevokeLink(code);
    } finally {
      setBusy(false);
    }
  };

  const copy = async (code: string) => {
    const url = shareUrlFor(code);
    try {
      await navigator.clipboard.writeText(url);
      setCopiedCode(code);
      window.setTimeout(() => setCopiedCode(null), 1500);
    } catch {
      // Browsers without clipboard permission silently no-op; the
      // user can still select the input.
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
        className="pointer-events-auto flex w-[32rem] max-w-[92%] animate-fly-up-in flex-col rounded-xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/10"
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-6 pt-6 pb-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Share this diagram</h2>
            <p className="mt-1 text-sm text-slate-600">
              Create one or more share links. Anyone with an editor link can join in real time; a
              view-only link lets people watch without changing anything.
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

        <div className="flex flex-col gap-5 px-6 py-5">
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
                readOnly={nameLocked}
                aria-readonly={nameLocked}
                className={
                  nameLocked
                    ? 'mt-0.5 w-full cursor-default bg-transparent text-sm text-slate-500 outline-none'
                    : 'mt-0.5 w-full bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400'
                }
              />
            </div>
            {nameLocked ? null : (
              <Tooltip title="Shuffle name" description="Pick a different random name.">
                <button
                  type="button"
                  onClick={() => setName(randomName())}
                  aria-label="Generate a different name"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                >
                  <RefreshIcon />
                </button>
              </Tooltip>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Active share links
            </p>
            {links.length === 0 ? (
              <p className="rounded-md border border-dashed border-slate-200 bg-slate-50/60 px-3 py-4 text-center text-xs text-slate-500">
                No share links yet. Pick a role below and click <strong>Create</strong>.
              </p>
            ) : (
              <ul className="flex flex-col gap-1">
                {links.map((link) => (
                  <li
                    key={link.code}
                    className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-2 py-1.5"
                  >
                    <span
                      className={
                        link.role === 'edit'
                          ? 'inline-flex items-center rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-brand-800'
                          : 'inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-700'
                      }
                    >
                      {link.role === 'edit' ? 'Edit' : 'View'}
                    </span>
                    <input
                      readOnly
                      value={shareUrlFor(link.code)}
                      onFocus={(e) => e.currentTarget.select()}
                      className="flex-1 min-w-0 rounded border border-transparent bg-transparent px-1 py-0.5 text-xs text-slate-700 outline-none focus:border-brand-400"
                    />
                    <button
                      type="button"
                      onClick={() => copy(link.code)}
                      className="rounded-md bg-brand-500 px-2 py-1 text-[11px] font-medium text-white shadow-sm transition hover:bg-brand-600"
                    >
                      {copiedCode === link.code ? 'Copied' : 'Copy'}
                    </button>
                    <button
                      type="button"
                      onClick={() => revoke(link.code)}
                      disabled={busy}
                      aria-label="Revoke link"
                      className="rounded-md p-1 text-slate-400 transition hover:bg-rose-50 hover:text-rose-700 disabled:opacity-50"
                    >
                      <TrashIcon />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex flex-col gap-2 border-t border-slate-100 pt-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Create new link
            </p>
            <div className="flex items-center gap-2">
              <div className="flex flex-1 items-stretch gap-1 rounded-md border border-slate-200 bg-slate-50 p-0.5">
                <RoleButton
                  active={newRole === 'edit'}
                  onClick={() => setNewRole('edit')}
                  label="Edit"
                  description="Full read / write access — visitors can change anything."
                />
                <RoleButton
                  active={newRole === 'view'}
                  onClick={() => setNewRole('view')}
                  label="View only"
                  description="Read-only — visitors can look but not edit."
                />
              </div>
              <button
                type="button"
                onClick={create}
                disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-md bg-brand-500 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-brand-600 disabled:opacity-50"
              >
                <LinkIcon />
                Create
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-6 py-3">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Done
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function RoleButton({
  active,
  label,
  description,
  onClick,
}: {
  active: boolean;
  label: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={description}
      onClick={onClick}
      aria-pressed={active}
      className={
        active
          ? 'flex-1 rounded-sm bg-white px-2 py-1 text-xs font-semibold text-slate-800 shadow-sm'
          : 'flex-1 rounded-sm px-2 py-1 text-xs font-medium text-slate-500 transition hover:bg-white/60 hover:text-slate-700'
      }
    >
      {label}
    </button>
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

function TrashIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M2.5 4h11" />
      <path d="M6 4V2.75A.75.75 0 0 1 6.75 2h2.5a.75.75 0 0 1 .75.75V4" />
      <path d="M4 4l.7 9.1a1 1 0 0 0 1 .9h4.6a1 1 0 0 0 1-.9L12 4" />
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
