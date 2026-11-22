'use client';

// Share an item through links, each drawn as a pass: a level (Editor, Participant, Viewer, as the item's app offers),
// every tab or one, lasting forever or a while; one password guards every link at once. Top to bottom: a status line saying who can open the
// item right now, the composer that issues (and copies) a pass, the live passes with their count, the expired ones,
// Password Protection and Sign In (who may open the passes); a guest's "Sharing as" name sits in the footer. An item in
// a team opens on its Team tab first, since the team already reaches it without a pass. It loads the item's links once when it
// opens and applies each change at once, taking it back if the index refuses. Everything app-specific (the links'
// address, the embed and live image, help articles, telemetry, the guest's name) comes from the host.

import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  APP_DEFAULT_LINK_LEVEL,
  APP_LINK_LEVELS,
  type IndexClient,
  type Level,
  type ShareLink,
  type ShareLinkExpiry,
} from '@liveworkspace/index-client';
import { ApprovalPanel } from '../approvals/ApprovalPanel';
import { useApprovalDoor } from '../approvals/door';
import { useShareLinks } from '../data/useShareLinks';
import { useNow } from '../time';
import { APP_ITEMS } from '@liveworkspace/sites';
import { Button, CountBadge } from '@liveworkspace/ui';
import { HeroDialogHeader } from '@liveworkspace/ui/dialog-hero';
import { shareHeroArt } from '@liveworkspace/ui/dialog-hero-art/share';
import { Dialog } from '../ui/Dialog';
import type { ItemRef, ShareUrl } from '../types';
import { kindWords } from '../words';
import { ActivePass } from './share/ActivePass';
import { writeClipboard } from './share/CopyMenu';
import { ExpiredPass } from './share/ExpiredPass';
import type { ShareHandOver } from './share/handover';
import { HelpLink } from './share/HelpLink';
import { IdentityRow } from './share/IdentityRow';
import { SECTION_LABEL, type ShareTab, type ShareView } from './share/parts';
import { PasswordSection } from './share/PasswordSection';
import { ShareComposer } from './share/ShareComposer';
import { ShareStatus } from './share/ShareStatus';
import { SignInSection } from './share/SignInSection';
import { TeamPanel } from './share/TeamPanel';
import { ShareTabs, sharePanelId, shareTabId } from './share/ShareTabs';
import { ShareTourStage, ShowMeButton, useShareTour } from './share/ShareTour';
import { useShareStartFocus } from './share/useShareStartFocus';
import {
  SHARE_EXPIRY_TELEMETRY,
  SHARE_LEVEL_TELEMETRY,
  type ShareHelpHref,
  type ShareIdentity,
  type ShareNotify,
  type ShareTelemetry,
} from './share/types';

export type { ShareTab, ShareView } from './share/parts';
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
  // The item's own address in its app, for the Team tab's link; left out, the item's path on this page's origin (an
  // editor, which runs on its app's site).
  itemUrl?: string;
  // The team's name, for the Team tab's words (the Explorer knows it); left out, the index's share answer names it
  // (an editor), and "the team" without either.
  teamName?: string | null;
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
  // Why Password Protection cannot be switched on (a rule of the host's, livediagram's listed Community post); null
  // or absent, it can.
  passwordLockedReason?: string | null;
  // Whether the item's links ask for a password, each time that is read or changed, so a host rule that hangs on it
  // (a canvas behind a password cannot be published) follows the dialog.
  onPasswordSetChange?: (set: boolean) => void;
  // Why Sign In cannot be switched on (a listed Community post, whose link is public); null or absent, it can.
  signInLockedReason?: string | null;
  // Whether a sign-in rule holds the item's links, each time it is read or changed (a post can't be public behind one).
  onSignInChange?: (on: boolean) => void;
  // A section of the host's own below Password Protection.
  appSection?: ReactNode;
  // A tab of the host's own beside Passes (livediagram's Community): its label, a badge after the label (words, such
  // as a Public pill; never a dot) and its panel. With it the dialog opens on two tabs, on `initialView`.
  appTab?: { label: string; badge?: ReactNode; panel: ReactNode } | null;
  // Where the dialog opens. `passes` (the default) opens a team item on its Team tab instead; the host's `app` and
  // Approval's own start always win.
  initialView?: ShareView;
  // Where the item is public, in the host's words, for the status line ("Public: …", pink); null or absent while it
  // is not (livediagram: a canvas listed in the Community).
  publicNote?: string | null;
};

const NO_TABS: ShareTab[] = [];
const NO_HAND_OVER: ShareHandOver = {};

export function ShareDialog({
  client,
  item,
  itemUrl,
  teamName = null,
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
  passwordLockedReason = null,
  onPasswordSetChange,
  signInLockedReason = null,
  onSignInChange,
  appSection,
  appTab = null,
  initialView = 'passes',
  publicNote = null,
}: ShareDialogProps) {
  // Approval (approvals.md): for an Editor where the editor offers approvals; the badge opens the dialog on it.
  const approvals = useApprovalDoor();
  const approvalTab = Boolean(approvals?.door.canRequest);
  // Team (one-explorer-contracts.md "Sharing and access"): first, for an item in a team's space.
  const teamTab = Boolean(item.teamId);
  const views = useMemo<ShareView[]>(
    () => [
      ...(teamTab ? (['team'] as const) : []),
      'passes',
      ...(appTab ? (['app'] as const) : []),
      ...(approvalTab ? (['approval'] as const) : []),
    ],
    [teamTab, appTab, approvalTab],
  );
  const [view, setView] = useState<ShareView>(() =>
    approvals?.takeStartTab() && approvalTab
      ? 'approval'
      : initialView !== 'passes' && views.includes(initialView)
        ? initialView
        : teamTab
          ? 'team'
          : 'passes',
  );
  const tabbed = views.length > 1;
  const titleId = useId();
  useShareStartFocus(titleId, tabbed);
  const showApp = Boolean(appTab) && view === 'app';
  const showApproval = approvalTab && view === 'approval';
  const showTeam = teamTab && view === 'team';
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
  const passwordSetChanged = useRef(onPasswordSetChange);
  passwordSetChanged.current = onPasswordSetChange;
  useEffect(() => {
    passwordSetChanged.current?.(share.passwordSet);
  }, [share.passwordSet]);
  const signInChanged = useRef(onSignInChange);
  signInChanged.current = onSignInChange;
  const signInOn = share.signIn.requireAccount;
  useEffect(() => {
    signInChanged.current?.(signInOn);
  }, [signInOn]);
  const tabs = useLoadedTabs(givenTabs, loadTabs);
  const multiTab = tabs.length > 1;
  const word = kindWords(item.app).lowerOne;
  // The levels the item's app offers a new pass (livehuddle: Editor and Participant, Participant to start). A pass
  // holding another (made before) keeps working and reads Legacy; a public link (a Community post's) is always `view`.
  const levels = APP_LINK_LEVELS[item.app];
  const legacy = (link: ShareLink) => !link.public && !levels.includes(link.level);
  const shareTour = useShareTour(multiTab, word, onTelemetry);
  // Show Me walks the passes, so it starts on their tab.
  const tour = {
    ...shareTour,
    start: () => {
      setView('passes');
      shareTour.start();
    },
  };
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

  const status = {
    passes: active.length,
    password: share.passwordSet,
    signIn: share.signIn,
    team: Boolean(item.teamId),
    word,
    publicNote,
  };

  return (
    <Dialog
      onClose={close}
      ariaLabel={`Share ${item.title || 'Untitled'}`}
      // While Show Me runs, Escape is the tour's.
      closeOnEscape={!tour.active}
      size="lg"
      // A drawer on a phone, risen from the bottom edge with a grab handle, as working dialogs are there.
      phoneSheet
      // Centred at a steady height from sm up (dialogs never pin to the top), so the role picker unfolding or a pass
      // coming or going scrolls the body between the fixed header and footer and never moves the panel.
      className="max-h-[calc(100%-2rem)] sm:h-[min(48rem,calc(100%-2rem))]"
    >
      {/* The dialog hero header (dialog-hero-header.md): sharing drawn as a connection, the status its one line. */}
      <HeroDialogHeader
        art={shareHeroArt}
        titleId={titleId}
        title={`Share This ${kindWords(item.app).one}`}
        subtitle={<ShareStatus {...status} />}
        actions={
          <>
            <ShowMeButton tour={tour} />
            <HelpLink href={helpHref?.('sharing')} label="Help with sharing" variant="labelled" />
          </>
        }
        onClose={close}
      />
      {tabbed ? (
        <ShareTabs
          views={views}
          view={view}
          onView={setView}
          appLabel={appTab?.label ?? ''}
          appBadge={appTab?.badge}
        />
      ) : null}

      {showTeam ? (
        <div
          id={sharePanelId('team')}
          role="tabpanel"
          aria-labelledby={shareTabId('team')}
          className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-6 py-5"
        >
          <TeamPanel
            url={itemUrl ?? ownAddress(item)}
            teamName={teamName ?? share.teamName}
            word={word}
            notify={notify}
            onPasses={() => {
              setView('passes');
              // Focus follows to the Passes tab, so it never falls to the page when the panel goes.
              requestAnimationFrame(() => document.getElementById(shareTabId('passes'))?.focus());
            }}
          />
        </div>
      ) : showApproval ? (
        <div
          id={sharePanelId('approval')}
          role="tabpanel"
          aria-labelledby={shareTabId('approval')}
          className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-6 py-5"
        >
          <ApprovalPanel helpHref={helpHref?.('requestApproval')} />
        </div>
      ) : appTab && showApp ? (
        <div
          id={sharePanelId('app')}
          role="tabpanel"
          aria-labelledby={shareTabId('app')}
          className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-6 py-5"
        >
          {appTab.panel}
        </div>
      ) : (
        <div
          id={tabbed ? sharePanelId('passes') : undefined}
          role={tabbed ? 'tabpanel' : undefined}
          aria-labelledby={tabbed ? shareTabId('passes') : undefined}
          className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-6 py-5"
        >
          <ShareComposer
            tabs={tabs}
            busy={share.busy}
            helpHref={helpHref}
            levels={levels}
            defaultLevel={APP_DEFAULT_LINK_LEVEL[item.app]}
            app={item.app}
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
              <p className="text-sm text-slate-500 dark:text-slate-400">Loading passes…</p>
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
                      legacy={legacy(link)}
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
                            notify(
                              'Couldn’t copy the link. Select it to copy it yourself.',
                              'error',
                            );
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
              <h3
                id="share-expired-heading"
                className={`${SECTION_LABEL} flex items-center gap-1.5`}
              >
                Expired
                <CountBadge count={expired.length} />
              </h3>
              <ul className="-mx-0.5 -mb-2 -mt-0.5 flex flex-col">
                {expired.map((link) => (
                  <ExpiredPass
                    key={link.code}
                    link={link}
                    legacy={legacy(link)}
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
            lockedReason={passwordLockedReason}
            onSet={async (p) => {
              const ok = await share.setPassword(p);
              if (ok) onTelemetry?.('Shared', p ? 'PasswordSet' : 'PasswordCleared');
              return ok;
            }}
          />
          <SignInSection
            signIn={share.signIn}
            suggestedDomain={share.suggestedDomain}
            busy={share.busy}
            helpHref={helpHref}
            lockedReason={signInLockedReason}
            onSet={(rule) => share.setSignIn(rule)}
          />
          {appSection}
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
      )}
      <div className="flex shrink-0 items-center justify-end gap-2 border-t border-slate-100 px-6 py-4 dark:border-slate-800">
        {identity ? <IdentityRow identity={identity} name={name} onChange={setName} /> : null}
        <Button variant="secondary" size="xs" onClick={close}>
          Done
        </Button>
      </div>
      <ShareTourStage tour={tour} helpHref={helpHref?.('sharing')} />
    </Dialog>
  );
}

/** The item's own address on this page's origin: where an editor, on its app's site, opens it. */
function ownAddress(item: ItemRef): string {
  const path = `${APP_ITEMS[item.app].itemPath}${encodeURIComponent(item.id)}`;
  return typeof window === 'undefined' ? path : `${window.location.origin}${path}`;
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
