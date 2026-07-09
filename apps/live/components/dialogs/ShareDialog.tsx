'use client';

import { useState } from 'react';
import { Button, TextInput } from '@livediagram/ui';
import { DialogCloseButton } from '@/components/dialogs/DialogCloseButton';
import { Dialog } from '@/components/dialogs/Dialog';
import { initialsOf, randomName } from '@/lib/identity';
import type { ShareLinkExpiry, ShareRole } from '@/lib/api-client';
import { useRelativeTimeTick } from '@/lib/relative-time';
import { track } from '@/lib/telemetry';
import { useToast } from '@/hooks/ui/useToast';
import { TrashIcon } from '@/components/panels/explorer-icons';
import { Tooltip } from '@/components/primitives/Tooltip';
import { EXPIRY_LABELS, LinkIcon, RefreshIcon, RoleButton } from './share-dialog-parts';
import { ActiveShareLinkRow } from './ShareLinkRow';
import type { ShareDialogProps } from './ShareDialog.types';
import { SharePasswordSection } from './SharePasswordSection';
import { ShareOfflineGate } from './ShareOfflineGate';
import { HelpArticleLink } from '@/components/primitives/HelpArticleLink';

// Human labels for the expiry choices (spec/34), shared by the create
// dropdown and the inactive rows' Extend button.

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
  tabs,
  nameConfirmed,
  lockedName,
  onSaveName,
  onCreateLink,
  onRevokeLink,
  onExtendLink,
  onSetPassword,
  offline,
  onSyncToCloud,
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
  // Which tab the Live image renders (spec/54). null = the first tab,
  // which the server serves from its cached snapshot, so the URL omits
  // `?tab=`. Diagram-wide: the same choice applies to every share link's
  // image. Any other tab id is threaded straight into the image URL.
  const [liveImageTabId, setLiveImageTabId] = useState<string | null>(null);
  const firstTabId = tabs[0]?.id;
  const liveImageTabParam = liveImageTabId ?? undefined;

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

  const sectionLabel =
    'text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400';
  // Origin for the embed / live-image snippets. Guarded so a build-time
  // prerender (the dialog isn't shown then) doesn't touch window.
  const origin = typeof window === 'undefined' ? '' : window.location.origin;

  // Offline diagrams (spec/76) have nothing to share yet, so swap the whole
  // dialog for the sync gate until the owner moves it to the cloud.
  if (offline && onSyncToCloud) {
    return <ShareOfflineGate onSyncToCloud={onSyncToCloud} onClose={onClose} />;
  }

  return (
    <Dialog
      open
      onClose={onClose}
      ariaLabel="Share this diagram"
      size="lg"
      className="max-h-[calc(100%-2rem)]"
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
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <HelpArticleLink
            article="sharing"
            title="Sharing"
            description="Roles, real-time collaboration, and how share links work."
          />
          <DialogCloseButton onClick={onClose} />
        </div>
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
              <TextInput
                id="share-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={participant.name}
                aria-label="Your name"
                className="min-w-0 flex-1"
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
            <Button onClick={create} disabled={busy} size="xs" className="shadow-sm">
              <LinkIcon />
              Create
            </Button>
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
                <ActiveShareLinkRow
                  key={link.code}
                  link={link}
                  now={now}
                  origin={origin}
                  copiedCode={copiedCode}
                  busy={busy}
                  sharePassword={sharePassword}
                  tabs={tabs}
                  liveImageTabId={liveImageTabId}
                  firstTabId={firstTabId}
                  liveImageTabParam={liveImageTabParam}
                  setLiveImageTabId={setLiveImageTabId}
                  shareUrlFor={shareUrlFor}
                  onCopy={copy}
                  onRevoke={revoke}
                />
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
                    <Button
                      variant="secondary"
                      size="xs"
                      onClick={() => extend(link.code)}
                      disabled={busy}
                      className="whitespace-nowrap"
                    >
                      Extend {link.expiry === 'never' ? '' : EXPIRY_LABELS[link.expiry]}
                    </Button>
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

        <SharePasswordSection
          sharePassword={sharePassword}
          onSetPassword={onSetPassword}
          busy={busy}
          setBusy={setBusy}
          sectionLabel={sectionLabel}
        />
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-6 py-4 dark:border-slate-800">
        <Button variant="secondary" size="xs" onClick={onClose}>
          Done
        </Button>
      </div>
    </Dialog>
  );
}
