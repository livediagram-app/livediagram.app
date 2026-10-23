'use client';

// Share an item through links, each drawn as a pass: a level (Editor, Participant, Viewer), every tab or one, lasting
// forever or a while; one password guards every link at once. Top to bottom: a status line saying who can open the
// item right now, the composer that issues (and copies) a pass, the live passes with their count, the expired ones,
// and Password Protection; a guest's "Sharing as" name sits in the footer. It loads the item's links once when it
// opens and applies each change at once, taking it back if the index refuses. Everything app-specific (the links'
// address, the embed and live image, help articles, telemetry, the guest's name) comes from the host.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { IndexClient, Level, ShareLinkExpiry } from '@liveworkspace/index-client';
import { useShareLinks } from '../data/useShareLinks';
import { useNow } from '../time';
import { Button } from '../ui/Button';
import { CountBadge } from '../ui/CountBadge';
import { Dialog, DialogCloseButton, DialogFooter, DialogHeader } from '../ui/Dialog';
import type { ItemRef, ShareUrl } from '../types';
import { kindWords } from '../words';
import { ActivePass } from './share/ActivePass';
import { writeClipboard } from './share/CopyMenu';
import { ExpiredPass } from './share/ExpiredPass';
import type { ShareHandOver } from './share/handover';
import { HelpLink } from './share/HelpLink';
import { IdentityRow } from './share/IdentityRow';
import { SECTION_LABEL, type ShareTab } from './share/parts';
import { PasswordSection } from './share/PasswordSection';
import { ShareComposer } from './share/ShareComposer';
import { ShareStatus } from './share/ShareStatus';
import { ShareTourStage, ShowMeButton, useShareTour } from './share/ShareTour';
import {
  SHARE_EXPIRY_TELEMETRY,
  SHARE_LEVEL_TELEMETRY,
  type ShareHelpHref,
  type ShareIdentity,
  type ShareNotify,
  type ShareTelemetry,
} from './share/types';

export type { ShareTab } from './share/parts';
export type { ShareHandOver } from './share/handover';
export type {
  ShareHelpArticle,
  ShareHelpHref,
  ShareIdentity,
  ShareNotify,
  ShareTelemetry,
} from './share/types';
export { LEVEL_PASS, LIFETIMES } from './share/parts';

// How long a just-issued pass wears its ring.
const PASS_HIGHLIGHT_MS = 1400;
// How long a Copy button says "Copied".
const COPIED_MS = 1500;

export type ShareDialogProps = {
  client: IndexClient;
  // `teamId`: the item sits in a team's library, so every member can open it (the status line says so).
  item: ItemRef & { title: string; teamId?: string | null };
  // The item's tabs in order, so a link can open just one and a live image can draw one; omit for an app without
  // tabs. `loadTabs` reads them when the dialog opens instead (the Explorer, which holds no item's tabs).
  tabs?: ShareTab[];
  loadTabs?: () => Promise<ShareTab[]>;
  // A link's address, as the item's app builds it.
  shareUrl: ShareUrl;
  // The embed and live image, where the item's app serves them.
  handOver?: ShareHandOver;
  helpHref?: ShareHelpHref;
  onTelemetry?: ShareTelemetry;
  // A guest's name ("Sharing as"); omit for an account.
  identity?: ShareIdentity;
  onClose: () => void;
  // What happened, in words (the host's toasts); defaults to a note in the dialog.
  notify?: ShareNotify;
  // A refusal said in words; `notify` covers it when given.
  onError?: (text: string) => void;
};

const NO_TABS: ShareTab[] = [];
const NO_HAND_OVER: ShareHandOver = {};

export function ShareDialog({
  client,
  item,
  tabs: givenTabs,
  loadTabs,
  shareUrl,
  handOver = NO_HAND_OVER,
  helpHref,
  onTelemetry,
  identity,
  onClose,
  notify: hostNotify,
  onError,
}: ShareDialogProps) {
  const [note, setNote] = useState<{ text: string; tone: 'success' | 'info' | 'error' } | null>(
    null,
  );
  const notify = useCallback<ShareNotify>(
    (text, tone) => {
      if (hostNotify) hostNotify(text, tone);
      else if (tone === 'error' && onError) onError(text);
      else setNote({ text, tone });
    },
    [hostNotify, onError],
  );
  const notifyError = useCallback((text: string) => notify(text, 'error'), [notify]);
  const share = useShareLinks(client, item.id, notifyError);
  const tabs = useLoadedTabs(givenTabs, loadTabs);
  const multiTab = tabs.length > 1;
  const word = kindWords(item.app).lowerOne;
  const tour = useShareTour(multiTab, word, onTelemetry);
  const [name, setName] = useState(identity?.name ?? '');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [freshCode, setFreshCode] = useState<string | null>(null);
  const [highlightCode, setHighlightCode] = useState<string | null>(null);
  const [imageTabId, setImageTabId] = useState<string | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const later = (fn: () => void, ms: number) => timers.current.push(setTimeout(fn, ms));

  // The shared clock ticks the countdowns, and moves a pass that lapses with the dialog open to Expired.
  const ticked = useNow();
  const now = ticked || Date.now();
  const { active, expired } = useMemo(() => {
    const newestFirst = [...share.links].sort((a, b) => b.createdAt - a.createdAt);
    return {
      active: newestFirst.filter((l) => l.expiresAt === null || l.expiresAt > now),
      expired: newestFirst.filter((l) => l.expiresAt !== null && l.expiresAt <= now),
    };
  }, [share.links, now]);

  // The guest's draft name is saved when a pass is issued and when the dialog closes, whichever comes first.
  const saveName = async () => {
    if (!identity) return;
    const next = name.trim() || identity.name;
    if (next !== identity.name) await identity.onSave(next);
  };
  const close = () => {
    void saveName();
    onClose();
  };

  const copyLink = async (code: string, url: string): Promise<boolean> => {
    if (!(await writeClipboard(url))) return false;
    setCopiedCode(code);
    later(() => setCopiedCode((c) => (c === code ? null : c)), COPIED_MS);
    onTelemetry?.('Copied', 'ShareLink');
    return true;
  };

  const issue = async (level: Level, expiry: ShareLinkExpiry, tabId: string | null) => {
    await saveName();
    const link = await share.create({ level, tabId, expiry });
    if (!link) return;
    onTelemetry?.('Shared', SHARE_LEVEL_TELEMETRY[level]);
    if (expiry !== 'never') onTelemetry?.('Shared', SHARE_EXPIRY_TELEMETRY[expiry]);
    if (tabId) onTelemetry?.('Shared', 'TabScoped');
    setFreshCode(link.code);
    setHighlightCode(link.code);
    later(() => setHighlightCode((c) => (c === link.code ? null : c)), PASS_HIGHLIGHT_MS);
    // The clipboard can refuse once the click's moment has passed behind the round trip; the pass is there to copy.
    if (await copyLink(link.code, shareUrl(link, item)))
      notify('Pass created and copied', 'success');
    else notify('Pass created. Copy it from its card.', 'info');
  };

  return (
    <Dialog
      onClose={close}
      ariaLabel={`Share ${item.title || 'Untitled'}`}
      // While Show Me runs, Escape is the tour's.
      closeOnEscape={!tour.active}
      size="xl"
    >
      <DialogHeader
        title={`Share “${item.title || 'Untitled'}”`}
        subtitle={
          <ShareStatus
            passes={active.length}
            password={share.passwordSet}
            team={Boolean(item.teamId)}
            word={word}
          />
        }
      >
        <ShowMeButton tour={tour} />
        <HelpLink href={helpHref?.('sharing')} label="Help with sharing" />
        <DialogCloseButton onClick={close} />
      </DialogHeader>
      <div className="flex flex-col gap-5 px-6 py-5">
        <ShareComposer
          tabs={tabs}
          busy={share.busy}
          helpHref={helpHref}
          onIssue={(level, expiry, tabId) => void issue(level, expiry, tabId)}
        />

        <section
          aria-labelledby="share-passes-heading"
          data-tour-id="share-passes"
          className="flex flex-col gap-2 border-t border-slate-100 pt-5 dark:border-slate-800"
        >
          <h3 id="share-passes-heading" className={`${SECTION_LABEL} flex items-center gap-1.5`}>
            Passes
            {active.length > 0 ? <CountBadge count={active.length} /> : null}
          </h3>
          {share.loading ? (
            <p className="text-sm text-slate-500">Loading passes…</p>
          ) : share.error ? (
            <p className="text-sm text-rose-700 dark:text-rose-300">Couldn’t load the passes.</p>
          ) : active.length === 0 ? (
            <p className="rounded-xl border-2 border-dashed border-slate-200 px-4 py-5 text-center text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
              {share.links.length === 0
                ? `No passes yet. ${item.teamId ? 'Only the team' : 'Only you'} can open this ${word}.`
                : 'Every pass has expired. Extend one below or issue a new one.'}
            </p>
          ) : (
            <ul className="-mx-0.5 -mb-2 -mt-0.5 flex flex-col">
              {active.map((link) => {
                const url = shareUrl(link, item);
                return (
                  <ActivePass
                    key={link.code}
                    link={link}
                    url={url}
                    now={now}
                    copied={copiedCode === link.code}
                    fresh={freshCode === link.code}
                    highlight={highlightCode === link.code}
                    busy={share.busy}
                    passwordSet={share.passwordSet}
                    tabs={tabs}
                    handOver={handOver}
                    imageTabId={imageTabId}
                    setImageTabId={setImageTabId}
                    word={word}
                    notify={notify}
                    onTelemetry={onTelemetry}
                    onCopy={() =>
                      void copyLink(link.code, url).then((ok) => {
                        // Without clipboard permission a write fails; the field stays selectable.
                        if (!ok)
                          notify('Couldn’t copy the link. Select it to copy it yourself.', 'error');
                      })
                    }
                    onRevoke={() =>
                      void share.revoke(link.code).then((ok) => {
                        if (ok) onTelemetry?.('Removed', 'ShareLink');
                      })
                    }
                    onRescope={
                      multiTab
                        ? (tabId) =>
                            void share.update(link.code, { tabId }).then((ok) => {
                              if (ok) onTelemetry?.('Shared', 'Rescoped');
                            })
                        : null
                    }
                  />
                );
              })}
            </ul>
          )}
        </section>

        {/* Only when something lapsed, so people who never use expiry never see it. */}
        {expired.length > 0 ? (
          <section aria-labelledby="share-expired-heading" className="flex flex-col gap-2">
            <h3 id="share-expired-heading" className={`${SECTION_LABEL} flex items-center gap-1.5`}>
              Expired
              <CountBadge count={expired.length} />
            </h3>
            <ul className="-mx-0.5 -mb-2 -mt-0.5 flex flex-col">
              {expired.map((link) => (
                <ExpiredPass
                  key={link.code}
                  link={link}
                  url={shareUrl(link, item)}
                  busy={share.busy}
                  onExtend={() =>
                    void share.extend(link.code).then((ok) => {
                      if (ok) onTelemetry?.('Shared', 'Extended');
                    })
                  }
                  onDelete={() => void share.revoke(link.code)}
                />
              ))}
            </ul>
          </section>
        ) : null}

        <PasswordSection
          passwordSet={share.passwordSet}
          busy={share.busy}
          helpHref={helpHref}
          onSet={async (p) => {
            const ok = await share.setPassword(p);
            if (ok) onTelemetry?.('Shared', p ? 'PasswordSet' : 'PasswordCleared');
            return ok;
          }}
        />
        {note ? (
          <p
            role={note.tone === 'error' ? 'alert' : 'status'}
            className={`text-sm ${
              note.tone === 'error'
                ? 'text-rose-700 dark:text-rose-300'
                : 'text-emerald-700 dark:text-emerald-300'
            }`}
          >
            {note.text}
          </p>
        ) : null}
      </div>
      <DialogFooter>
        {identity ? <IdentityRow identity={identity} name={name} onChange={setName} /> : null}
        <Button variant="secondary" size="sm" onClick={close}>
          Done
        </Button>
      </DialogFooter>
      <ShareTourStage tour={tour} />
    </Dialog>
  );
}

/** The item's tabs: the host's, or read once when the dialog opens. A failed read leaves none (every link opens
 *  every tab, as for an app without tabs). */
function useLoadedTabs(
  given: ShareTab[] | undefined,
  load: (() => Promise<ShareTab[]>) | undefined,
) {
  const [loaded, setLoaded] = useState<ShareTab[]>(NO_TABS);
  const loader = useRef(load);
  loader.current = load;
  const wantsLoad = !given && Boolean(load);
  useEffect(() => {
    if (!wantsLoad) return;
    let live = true;
    loader
      .current?.()
      .then((tabs) => live && setLoaded(tabs))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [wantsLoad]);
  return given ?? loaded;
}
