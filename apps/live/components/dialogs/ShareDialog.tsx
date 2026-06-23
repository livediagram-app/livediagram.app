'use client';

import { useRef, useState } from 'react';
import { CloseIcon } from '@/components/primitives/CloseIcon';
import { Portal } from '@/components/primitives/Portal';
import { useFocusTrap } from '@/hooks/ui/useFocusTrap';
import { initialsOf, randomName, type Participant } from '@/lib/identity';
import { buildEmbedSnippet } from '@/lib/embed';
import type { ShareLink, ShareLinkExpiry, ShareRole } from '@/lib/api-client';
import { formatTimeLeftCompact, useRelativeTimeTick } from '@/lib/relative-time';
import { track } from '@/lib/telemetry';
import { useEscape } from '@/hooks/ui/useEscape';
import { useToast } from '@/hooks/ui/useToast';
import { TrashIcon } from '@/components/panels/explorer-icons';
import { Tooltip } from '@/components/primitives/Tooltip';
import { HelpArticleLink } from '@/components/primitives/HelpArticleLink';

type ShareDialogProps = {
  participant: Participant;
  links: ShareLink[];
  // The diagram's current share password (spec/24), or null when unset.
  // Shown in the clear so the owner can always see + change it.
  sharePassword: string | null;
  shareUrlFor: (code: string) => string;
  // Whether the owner has confirmed their name (drives the share button
  // behaviour but no longer hides the identity card).
  nameConfirmed: boolean;
  // When non-null, the owner is signed in via Clerk and their display
  // name is dictated by their account — there's nothing to edit, so
  // the "Your name" row hides entirely (spec/07). Guests (null) get
  // the editable name + shuffle row.
  lockedName?: string | null;
  onSaveName: (name: string) => Promise<void> | void;
  onCreateLink: (role: ShareRole, expiry: ShareLinkExpiry) => Promise<void> | void;
  onRevokeLink: (code: string) => Promise<void> | void;
  // Re-arm an expiring link for another round of its creation-time
  // duration (spec/34). Only rendered on inactive (expired) rows.
  onExtendLink: (code: string) => Promise<void> | void;
  // Set (or clear, with null) the diagram's share password. Returns the
  // stored value so the field can reflect what now gates access.
  onSetPassword: (password: string | null) => Promise<string | null> | void;
  onClose: () => void;
};

// Human labels for the expiry choices (spec/34), shared by the create
// dropdown and the inactive rows' Extend button.
const EXPIRY_LABELS: Record<Exclude<ShareLinkExpiry, 'never'>, string> = {
  week: '1 week',
  month: '1 month',
  sixMonths: '6 months',
};

// Share-diagram modal. Layout per spec/07 ("Share dialog"): the
// guest-only name row first (so a guest sets the identity their links
// will carry), then the create row (the dialog's primary action), the
// active link cards, the inactive (expired) links when any exist
// (spec/34), and finally the share password (spec/24) as the quiet
// options band. Backdrop + dark-mode treatment match Settings /
// Shortcuts / Export.
export function ShareDialog({
  participant,
  links,
  sharePassword,
  shareUrlFor,
  nameConfirmed,
  lockedName,
  onSaveName,
  onCreateLink,
  onRevokeLink,
  onExtendLink,
  onSetPassword,
  onClose,
}: ShareDialogProps) {
  // When a Clerk display name is supplied, the input always reads
  // that value — even if the participant record was originally
  // created under a guest alias.
  const [name, setName] = useState(lockedName ?? participant.name);
  const toast = useToast();
  const nameLocked = !!lockedName;
  const [busy, setBusy] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [newRole, setNewRole] = useState<ShareRole>('edit');
  // Lifetime for the next link (spec/34). Never = the pre-expiry
  // default: the link works until revoked.
  const [newExpiry, setNewExpiry] = useState<ShareLinkExpiry>('never');
  // Password field (spec/24). Kept in the clear (type="text") so the
  // owner can always read it. Seeded from the saved value; `pwSaved`
  // flips the button to "Saved" for a beat after a successful write.
  const [pw, setPw] = useState(sharePassword ?? '');
  const [pwSaved, setPwSaved] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  useFocusTrap(dialogRef);
  useEscape(onClose);

  const trimmedName = name.trim();
  const effectiveName = trimmedName || participant.name;
  void nameConfirmed;

  // Periodic re-render so the countdown chips stay honest and a link
  // that lapses while the dialog is open migrates to Inactive without
  // a refetch (same tick the Explorer's "Updated" column uses).
  useRelativeTimeTick();
  const now = Date.now();
  const activeLinks = links.filter((l) => l.expiresAt === null || l.expiresAt > now);
  const inactiveLinks = links.filter((l) => l.expiresAt !== null && l.expiresAt <= now);

  const create = async () => {
    setBusy(true);
    try {
      if (effectiveName !== participant.name) await onSaveName(effectiveName);
      await onCreateLink(newRole, newExpiry);
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

  const extend = async (code: string) => {
    setBusy(true);
    try {
      await onExtendLink(code);
    } finally {
      setBusy(false);
    }
  };

  const savePassword = async () => {
    setBusy(true);
    try {
      const next = pw.trim() ? pw : null;
      const stored = await onSetPassword(next);
      // onSetPassword returns the server-normalised value (or void in
      // tests); reflect it so a whitespace-only entry visibly clears.
      setPw(typeof stored === 'string' ? stored : (next ?? ''));
      setPwSaved(true);
      window.setTimeout(() => setPwSaved(false), 1500);
    } finally {
      setBusy(false);
    }
  };

  const removePassword = async () => {
    setBusy(true);
    try {
      await onSetPassword(null);
      setPw('');
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
      track('UI', 'Copied', 'ShareLink');
    } catch {
      // Browsers without clipboard permission can't write; tell the
      // user so the dead button isn't a mystery (the link field stays
      // selectable for a manual copy).
      toast.error('Could not copy the link. Select it to copy manually.');
    }
  };

  // Copy an <iframe> snippet for the read-only embed view (spec/33).
  // Per link, so the snippet inherits that link's code (and its
  // password gate, if one is set). The copied-state slot is shared
  // with the URL copy via a distinct key so the two buttons don't
  // flash each other's "Copied".
  const copyEmbed = async (code: string) => {
    const snippet = buildEmbedSnippet(window.location.origin, code);
    try {
      await navigator.clipboard.writeText(snippet);
      setCopiedCode(`embed:${code}`);
      window.setTimeout(() => setCopiedCode(null), 1500);
      track('UI', 'Copied', 'EmbedCode');
    } catch {
      // Same failure surface as the URL copy above.
      toast.error('Could not copy the embed code. Select it to copy manually.');
    }
  };

  const sectionLabel =
    'text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400';

  return (
    <Portal>
      {/* Dimmed, blurred, click-to-close backdrop — the same overlay
          treatment Settings / Shortcuts / Export use, so the editor's
          modals read as one family. Pointer events stop here so the
          canvas underneath never sees them. */}
      <div
        onPointerDown={(e) => e.stopPropagation()}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm dark:bg-slate-950/60"
      >
        <div
          ref={dialogRef}
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          aria-label="Share this diagram"
          className="flex max-h-[calc(100%-2rem)] w-[34rem] max-w-[calc(100%-2rem)] animate-fly-up-in flex-col rounded-xl border border-slate-200 bg-white shadow-xl outline-none dark:border-slate-700 dark:bg-slate-900"
        >
          <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-6 pb-4 pt-5 dark:border-slate-800">
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                Share this diagram
              </h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                Anyone with an editor link joins in real time; a view-only link lets people watch
                without changing anything.
              </p>
              <div className="mt-1.5">
                <HelpArticleLink
                  article="sharing"
                  variant="text"
                  title="Sharing"
                  description="Roles, real-time collaboration, and how share links work."
                />
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="-mr-2 -mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            >
              <CloseIcon />
            </button>
          </div>

          <div className="flex flex-col gap-5 overflow-y-auto px-6 py-5">
            {/* Guests only, and first: the name peers will see on the
                links minted below. Signed-in users' display names come
                from their Clerk account, so there's nothing to edit and
                the row hides entirely (spec/07). */}
            {nameLocked ? null : (
              <div className="flex flex-col gap-1.5">
                <p className={sectionLabel}>Your name</p>
                <div className="flex items-center gap-2.5">
                  <div
                    role="img"
                    aria-label={`Your avatar colour: ${participant.color}`}
                    style={{ backgroundColor: participant.color }}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
                  >
                    {initialsOf(effectiveName)}
                  </div>
                  <input
                    id="share-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={participant.name}
                    aria-label="Your name"
                    className="min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-800 outline-none placeholder:text-slate-400 transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                  <Tooltip title="Shuffle name" description="Pick a different random name.">
                    <button
                      type="button"
                      onClick={() => setName(randomName())}
                      aria-label="Generate a different name"
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                    >
                      <RefreshIcon />
                    </button>
                  </Tooltip>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  What collaborators see on your cursor and comments.
                </p>
              </div>
            )}

            {/* Primary action: mint a link. The empty state below
                points back up here. */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-1.5">
                <p className={sectionLabel}>New link</p>
                <HelpArticleLink
                  article="shareLinkExpiry"
                  title="Link expiry"
                  description="How link lifetime works and where expired links go."
                />
              </div>
              <div className="flex items-center gap-2">
                <div className="flex flex-1 items-stretch gap-1 rounded-md border border-slate-200 bg-slate-50 p-0.5 dark:border-slate-700 dark:bg-slate-800">
                  <RoleButton
                    active={newRole === 'edit'}
                    onClick={() => setNewRole('edit')}
                    label="Edit"
                    description="Full read / write access: visitors can change anything."
                  />
                  <RoleButton
                    active={newRole === 'view'}
                    onClick={() => setNewRole('view')}
                    label="View only"
                    description="Read-only: visitors can look but not edit."
                  />
                </div>
                <Tooltip
                  title="Link lifetime"
                  description="The link stops working after this long and moves to Inactive, where you can extend or delete it. Never keeps it working until you revoke it."
                >
                  <select
                    value={newExpiry}
                    onChange={(e) => setNewExpiry(e.target.value as ShareLinkExpiry)}
                    aria-label="Link lifetime"
                    className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700 outline-none transition focus:border-brand-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                  >
                    <option value="never">Never expires</option>
                    <option value="week">Expires in 1 week</option>
                    <option value="month">Expires in 1 month</option>
                    <option value="sixMonths">Expires in 6 months</option>
                  </select>
                </Tooltip>
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

            <div className="flex flex-col gap-2">
              <p className={sectionLabel}>
                Active links{activeLinks.length > 0 ? ` (${activeLinks.length})` : ''}
              </p>
              {activeLinks.length === 0 ? (
                <p className="rounded-md border border-dashed border-slate-200 bg-slate-50/60 px-3 py-4 text-center text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-800/40 dark:text-slate-400">
                  {links.length === 0 ? (
                    <>
                      No share links yet. Pick a role above and click <strong>Create</strong>.
                    </>
                  ) : (
                    'No active share links. Extend an expired link below or create a new one.'
                  )}
                </p>
              ) : (
                <ul className="flex flex-col gap-1.5">
                  {activeLinks.map((link) => (
                    <li
                      key={link.code}
                      className="flex flex-col gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-2 dark:border-slate-700 dark:bg-slate-800/60"
                    >
                      {/* Line 1: what the link is + where it points. The
                          URL gets the row's spare width so it stays
                          readable as badges accumulate. */}
                      <div className="flex items-center gap-2">
                        <span
                          className={
                            link.role === 'edit'
                              ? 'inline-flex shrink-0 items-center rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-brand-800 dark:bg-brand-500/20 dark:text-brand-200'
                              : 'inline-flex shrink-0 items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-700 dark:bg-slate-700 dark:text-slate-200'
                          }
                        >
                          {link.role === 'edit' ? 'Edit' : 'View'}
                        </span>
                        {link.expiresAt !== null ? (
                          <Tooltip
                            title="Expiring link"
                            description={`Created with a ${
                              link.expiry === 'never' ? '' : EXPIRY_LABELS[link.expiry]
                            } lifetime. When it runs out the link stops working and moves to Inactive.`}
                          >
                            <span className="inline-flex shrink-0 items-center rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 ring-1 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/30">
                              {formatTimeLeftCompact(link.expiresAt - now)}
                            </span>
                          </Tooltip>
                        ) : null}
                        <input
                          readOnly
                          value={shareUrlFor(link.code)}
                          onFocus={(e) => e.currentTarget.select()}
                          className="min-w-0 flex-1 rounded border border-transparent bg-transparent px-1 py-0.5 text-xs text-slate-700 outline-none focus:border-brand-400 dark:text-slate-300"
                        />
                      </div>
                      {/* Line 2: actions. Copy is the everyday one and
                          keeps the filled style; Embed (spec/33) stays a
                          labelled button so it's discoverable; revoke
                          sits apart at the far edge. */}
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => copy(link.code)}
                          className="rounded-md bg-brand-500 px-2.5 py-1 text-[11px] font-medium text-white shadow-sm transition hover:bg-brand-600"
                        >
                          {copiedCode === link.code ? 'Copied' : 'Copy link'}
                        </button>
                        <Tooltip
                          title="Embed code"
                          description="Copies an <iframe> snippet you can paste into wikis, Notion, and docs."
                        >
                          <button
                            type="button"
                            onClick={() => copyEmbed(link.code)}
                            className="rounded-md border border-slate-200 px-2.5 py-1 text-[11px] font-medium text-slate-600 transition hover:border-brand-300 hover:text-brand-700 dark:border-slate-600 dark:text-slate-300 dark:hover:border-brand-400 dark:hover:text-brand-300"
                          >
                            {copiedCode === `embed:${link.code}` ? 'Copied' : 'Embed'}
                          </button>
                        </Tooltip>
                        <span className="flex-1" />
                        <Tooltip
                          title="Revoke link"
                          description="The URL stops working immediately for everyone holding it."
                        >
                          <button
                            type="button"
                            onClick={() => revoke(link.code)}
                            disabled={busy}
                            aria-label="Revoke link"
                            className="rounded-md p-1 text-slate-400 transition hover:bg-rose-50 hover:text-rose-700 disabled:opacity-50 dark:hover:bg-rose-500/10 dark:hover:text-rose-400"
                          >
                            <TrashIcon />
                          </button>
                        </Tooltip>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Inactive (expired) links — spec/34. Only rendered when
                there's something in it, so the dialog stays unchanged
                for owners who never use expiry. */}
            {inactiveLinks.length > 0 ? (
              <div className="flex flex-col gap-2">
                <p className={sectionLabel}>Inactive links ({inactiveLinks.length})</p>
                <ul className="flex flex-col gap-1">
                  {inactiveLinks.map((link) => (
                    <li
                      key={link.code}
                      className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50/60 px-2.5 py-1.5 dark:border-slate-700 dark:bg-slate-800/40"
                    >
                      <span className="inline-flex shrink-0 items-center rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-rose-700 ring-1 ring-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-500/30">
                        Expired
                      </span>
                      <input
                        readOnly
                        value={shareUrlFor(link.code)}
                        onFocus={(e) => e.currentTarget.select()}
                        className="min-w-0 flex-1 rounded border border-transparent bg-transparent px-1 py-0.5 text-xs text-slate-400 line-through outline-none dark:text-slate-400"
                      />
                      <Tooltip
                        title={`Extend ${link.expiry === 'never' ? '' : EXPIRY_LABELS[link.expiry]}`}
                        description="Reactivates this link for another round of the lifetime chosen when it was created, counted from now."
                      >
                        <button
                          type="button"
                          onClick={() => extend(link.code)}
                          disabled={busy}
                          className="whitespace-nowrap rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-600 transition hover:border-brand-300 hover:text-brand-700 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-brand-400 dark:hover:text-brand-300"
                        >
                          Extend {link.expiry === 'never' ? '' : EXPIRY_LABELS[link.expiry]}
                        </button>
                      </Tooltip>
                      <button
                        type="button"
                        onClick={() => revoke(link.code)}
                        disabled={busy}
                        aria-label="Delete expired link"
                        className="rounded-md p-1 text-slate-400 transition hover:bg-rose-50 hover:text-rose-700 disabled:opacity-50 dark:hover:bg-rose-500/10 dark:hover:text-rose-400"
                      >
                        <TrashIcon />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {/* Options band: the share password (spec/24). Applies to
                every link, and is touched far less often than the link
                actions above, so it sits last. */}
            <div className="flex flex-col gap-4 border-t border-slate-100 pt-4 dark:border-slate-800">
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-1.5">
                  <p className={sectionLabel}>Password</p>
                  <HelpArticleLink
                    article="sharePasswords"
                    title="Share passwords"
                    description="How the optional password gate protects every link."
                  />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={pw}
                    onChange={(e) => setPw(e.target.value)}
                    placeholder="No password"
                    aria-label="Share password"
                    autoComplete="off"
                    spellCheck={false}
                    className="min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-2 py-1.5 font-mono text-sm text-slate-800 outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                  <button
                    type="button"
                    onClick={savePassword}
                    disabled={busy || pw === (sharePassword ?? '')}
                    className="inline-flex items-center rounded-md bg-brand-500 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-brand-600 disabled:opacity-50"
                  >
                    {pwSaved ? 'Saved' : 'Save'}
                  </button>
                  {sharePassword ? (
                    <button
                      type="button"
                      onClick={removePassword}
                      disabled={busy}
                      className="inline-flex items-center rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-rose-50 hover:text-rose-700 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-rose-500/10 dark:hover:text-rose-400"
                    >
                      Remove
                    </button>
                  ) : null}
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Optional, applies to every link: anyone opening one must enter it first (embed
                  viewers are prompted inside the frame). Shown in the clear so you can always read
                  it.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-6 py-4 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-800"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </Portal>
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
    <Tooltip title={label} description={description} block>
      <button
        type="button"
        onClick={onClick}
        aria-pressed={active}
        className={
          active
            ? 'w-full rounded-sm bg-white px-2 py-1 text-xs font-semibold text-slate-800 shadow-sm dark:bg-slate-700 dark:text-slate-100'
            : 'w-full rounded-sm px-2 py-1 text-xs font-medium text-slate-500 transition hover:bg-white/60 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-700/60 dark:hover:text-slate-200'
        }
      >
        {label}
      </button>
    </Tooltip>
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
