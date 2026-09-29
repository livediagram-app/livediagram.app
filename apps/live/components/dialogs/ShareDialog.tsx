'use client';

import { useEffect, useRef, useState } from 'react';
import { Button, useCopiedFlash } from '@livediagram/ui';
import { DialogCloseButton } from '@/components/dialogs/DialogCloseButton';
import { Dialog } from '@/components/dialogs/Dialog';
import { DialogFooter } from '@/components/dialogs/DialogFooter';
import { CountBadge } from '@/components/primitives/CountBadge';
import { HelpArticleLink } from '@/components/primitives/HelpArticleLink';
import type { ShareLinkExpiry, ShareRole } from '@/lib/api-client';
import { useRelativeNow } from '@/lib/relative-time';
import { track } from '@/lib/telemetry';
import { useToast } from '@/hooks/ui/useToast';
import { ActiveSharePass } from './ActiveSharePass';
import { DialogHeader } from './DialogHeader';
import { ExpiredSharePass } from './ExpiredSharePass';
import { ShareComposer } from './ShareComposer';
import type { ShareDialogProps } from './ShareDialog.types';
import { ShareIdentity } from './ShareIdentity';
import { ShareOfflineGate } from './ShareOfflineGate';
import { SharePasswordSection } from './SharePasswordSection';
import { ShareStatus } from './ShareStatus';
import { SECTION_LABEL } from './share-dialog-parts';

// How long a just-issued pass wears its highlight ring before it fades.
const PASS_HIGHLIGHT_MS = 1400;

// Share-diagram modal, built on the pass metaphor (docs/specs/007-editor/live-app.md "Share dialog"):
// every share link is a ticket that admits whoever holds it. Top to bottom: a
// status line saying who can open the diagram right now, the composer that
// issues (and copies) a pass, the live passes, the expired ones
// (docs/specs/013-workspace/share-link-expiry.md), the password switch
// (docs/specs/013-workspace/share-password.md), and a footer carrying the
// guest's "Sharing as" name.
export function ShareDialog({
  participant,
  links,
  sharePassword,
  shareUrlFor,
  tabs,
  lockedName,
  onSaveName,
  onCreateLink,
  onRevokeLink,
  onRescopeLink,
  onExtendLink,
  onSetPassword,
  offline,
  onSyncToCloud,
  onClose,
}: ShareDialogProps) {
  // When a Clerk display name is supplied, the name is the account's and the
  // guest identity row hides (docs/specs/007-editor/live-app.md).
  const [name, setName] = useState(lockedName ?? participant.name);
  const nameLocked = !!lockedName;
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const { copied: copiedCode, flash } = useCopiedFlash<string>(1500);
  // The pass issued in this dialog session, which opens into the list on arrival.
  const [freshCode, setFreshCode] = useState<string | null>(null);
  // ...and, for a beat after it lands, the one wearing the highlight ring
  // (a timer, then the ring's own 250ms fade: docs/specs/004-interface-design/motion.md).
  const [highlightCode, setHighlightCode] = useState<string | null>(null);
  const highlightTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(highlightTimer.current), []);
  const multiTab = tabs.length > 1;
  // Which tab the Live image renders (docs/specs/013-workspace/live-image-share.md). null = the first tab,
  // which the server serves from its cached snapshot, so the URL omits
  // `?tab=`. Diagram-wide: the same choice applies to every pass's image.
  const [liveImageTabId, setLiveImageTabId] = useState<string | null>(null);
  const firstTabId = tabs[0]?.id;
  const liveImageTabParam = liveImageTabId ?? undefined;

  // Periodic re-render so the countdown chips stay honest and a pass that
  // lapses while the dialog is open migrates to Expired without a refetch.
  const now = useRelativeNow();
  // Newest first, so a pass just issued lands at the top where the eye is.
  const newestFirst = [...links].sort((a, b) => b.createdAt - a.createdAt);
  const activeLinks = newestFirst.filter((l) => l.expiresAt === null || l.expiresAt > now);
  const inactiveLinks = newestFirst.filter((l) => l.expiresAt !== null && l.expiresAt <= now);

  // The guest's draft name is saved when a pass is issued (the pass carries
  // it) and when the dialog closes, whichever comes first.
  const saveName = async () => {
    const next = name.trim() || participant.name;
    if (!nameLocked && next !== participant.name) await onSaveName(next);
  };

  const close = () => {
    void saveName();
    onClose();
  };

  const withBusy = async (run: () => Promise<void> | void) => {
    setBusy(true);
    try {
      await run();
    } finally {
      setBusy(false);
    }
  };

  const writeClipboard = async (code: string) => {
    await navigator.clipboard.writeText(shareUrlFor(code));
    flash(code);
    track('UI', 'Copied', 'ShareLink');
  };

  // Issue a pass and copy it straight away: the owner opened this dialog to
  // hand something over, so the created link should already be in hand.
  const issue = (role: ShareRole, expiry: ShareLinkExpiry, tabId: string | null) =>
    withBusy(async () => {
      await saveName();
      const link = await onCreateLink(role, expiry, tabId);
      if (!link) return;
      setFreshCode(link.code);
      setHighlightCode(link.code);
      window.clearTimeout(highlightTimer.current);
      highlightTimer.current = window.setTimeout(() => setHighlightCode(null), PASS_HIGHLIGHT_MS);
      try {
        await writeClipboard(link.code);
        toast.success('Pass created and copied');
      } catch {
        // The clipboard can refuse once the click's activation has lapsed
        // behind the network round trip; the pass is there to copy by hand.
        toast.info('Pass created. Copy it from its card.');
      }
    });

  const copy = async (code: string) => {
    try {
      await writeClipboard(code);
    } catch {
      // Browsers without clipboard permission can't write; say so, so the
      // dead button isn't a mystery (the link field stays selectable).
      toast.error('Could not copy the link. Select it to copy manually.');
    }
  };

  // Origin for the embed / live-image snippets. Guarded so a build-time
  // prerender (the dialog isn't shown then) doesn't touch window.
  const origin = typeof window === 'undefined' ? '' : window.location.origin;

  // Offline diagrams (docs/specs/006-document/offline-mode.md) have nothing to share yet, so swap the whole
  // dialog for the sync gate until the owner moves it to the cloud.
  if (offline && onSyncToCloud) {
    return <ShareOfflineGate onSyncToCloud={onSyncToCloud} onClose={onClose} />;
  }

  return (
    <Dialog
      open
      onClose={close}
      ariaLabel="Share this diagram"
      size="lg"
      className="max-h-[calc(100%-2rem)]"
    >
      <DialogHeader
        title="Share this diagram"
        subtitle={<ShareStatus passes={activeLinks.length} password={sharePassword !== null} />}
      >
        <HelpArticleLink article="sharing" size="md" />
        <DialogCloseButton onClick={close} />
      </DialogHeader>

      <div className="flex flex-col gap-5 overflow-y-auto px-6 py-5">
        <ShareComposer tabs={tabs} busy={busy} onIssue={issue} />

        <section
          className="flex flex-col gap-2 border-t border-slate-100 pt-5 dark:border-slate-800"
          aria-labelledby="share-passes-heading"
        >
          <p id="share-passes-heading" className={`${SECTION_LABEL} flex items-center gap-1.5`}>
            Passes
            {activeLinks.length > 0 ? <CountBadge count={activeLinks.length} /> : null}
          </p>
          {activeLinks.length === 0 ? (
            <p className="rounded-xl border-2 border-dashed border-slate-200 px-4 py-5 text-center text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
              {links.length === 0
                ? 'No passes yet. Only you can open this diagram.'
                : 'Every pass has expired. Extend one below or issue a new one.'}
            </p>
          ) : (
            <ul className="-mx-0.5 -mt-0.5 -mb-2 flex flex-col">
              {activeLinks.map((link) => (
                <ActiveSharePass
                  key={link.code}
                  link={link}
                  now={now}
                  origin={origin}
                  copied={copiedCode === link.code}
                  fresh={freshCode === link.code}
                  highlight={highlightCode === link.code}
                  busy={busy}
                  sharePassword={sharePassword}
                  tabs={tabs}
                  liveImageTabId={liveImageTabId}
                  firstTabId={firstTabId}
                  liveImageTabParam={liveImageTabParam}
                  setLiveImageTabId={setLiveImageTabId}
                  shareUrlFor={shareUrlFor}
                  onCopy={copy}
                  onRevoke={(code) => withBusy(() => onRevokeLink(code))}
                  onRescope={
                    multiTab ? (code, tabId) => withBusy(() => onRescopeLink(code, tabId)) : null
                  }
                />
              ))}
            </ul>
          )}
        </section>

        {/* Expired passes (docs/specs/013-workspace/share-link-expiry.md): only when there's
            something in it, so owners who never use expiry never see it. */}
        {inactiveLinks.length > 0 ? (
          <section className="flex flex-col gap-2" aria-labelledby="share-expired-heading">
            <p id="share-expired-heading" className={`${SECTION_LABEL} flex items-center gap-1.5`}>
              Expired
              <CountBadge count={inactiveLinks.length} />
            </p>
            <ul className="-mx-0.5 -mt-0.5 -mb-2 flex flex-col">
              {inactiveLinks.map((link) => (
                <ExpiredSharePass
                  key={link.code}
                  link={link}
                  busy={busy}
                  shareUrlFor={shareUrlFor}
                  onExtend={(code) => withBusy(() => onExtendLink(code))}
                  onDelete={(code) => withBusy(() => onRevokeLink(code))}
                />
              ))}
            </ul>
          </section>
        ) : null}

        <SharePasswordSection
          sharePassword={sharePassword}
          onSetPassword={onSetPassword}
          busy={busy}
          setBusy={setBusy}
        />
      </div>

      <DialogFooter>
        {nameLocked ? null : (
          <ShareIdentity participant={participant} name={name} onChange={setName} />
        )}
        <Button variant="secondary" size="xs" onClick={close}>
          Done
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
