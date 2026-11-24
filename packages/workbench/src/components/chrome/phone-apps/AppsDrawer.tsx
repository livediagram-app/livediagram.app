'use client';

// The phone's Apps drawer (liveworkspace/docs/specs/011-workbench/phone-apps-drawer.md "The Apps drawer"): the item and
// who can see it, a grid of what the corner card offered (only what this app and this person have), the app's own
// actions, and the account. In the shared PhoneDrawer, so its handle, scrim, Escape and focus are every drawer's.
import Link from 'next/link';
import { useId, type CSSProperties, type ReactNode } from 'react';
import { BrandMark, type BrandApp } from '@liveworkspace/brand';
import { inCallWords } from '@liveworkspace/index-client';
import {
  lucideChevronRight,
  lucideCopy,
  lucideFolder,
  lucideLink,
  lucidePresentation,
  lucideShare2,
  lucideVideo,
  lucideX,
} from '@liveworkspace/icons/lucide';
import { CountBadge, Glyph, PictureDisc, lucideGlyph } from '@liveworkspace/ui';
import { APP_ITEMS } from '@liveworkspace/sites';
import { useToast } from '../../../hooks/ui/useToast';
import { accountAvatarFill, accountInitials } from '../../../lib/account-avatar';
import { explorerHref, explorerItemHref } from '../../../lib/explorer-href';
import { useDeferredAuth } from '../../providers/deferred-auth';
import { useItemCallAction } from '../../item-call/useItemCallAction';
import { useItemCalls } from '../../item-call/item-call-store';
import { PhoneDrawer } from '../../primitives/PhoneDrawer';
import { useAuthHrefs } from '../auth-routes';
import { SignInIcon, useSavedLook } from '../AuthControls';
import { itemNameNow, usePhoneApps } from './phone-apps-store';
import { inboxBadgeWords, phoneAppsTiles, type PhoneAppsTileId } from './phone-apps-tiles';

const TILE_ICON = 24;
const ExplorerGlyph = lucideGlyph(lucideFolder, TILE_ICON);
const CallGlyph = lucideGlyph(lucideVideo, TILE_ICON);
const ShareGlyph = lucideGlyph(lucideShare2, TILE_ICON);
const PresentGlyph = lucideGlyph(lucidePresentation, TILE_ICON);
const LinkGlyph = lucideGlyph(lucideLink, TILE_ICON);
const CopyGlyph = lucideGlyph(lucideCopy, TILE_ICON);
const CloseGlyph = lucideGlyph(lucideX, 18);
const ChevronGlyph = lucideGlyph(lucideChevronRight, 18);

// An Inbox tray: lucide's set here has none.
function InboxGlyph() {
  return (
    <Glyph size={TILE_ICON} units={24}>
      <path d="M4 13l2.5-7h11L20 13v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z" />
      <path d="M4 13h5l1 2h4l1-2h5" />
    </Glyph>
  );
}

// A tile: its glyph over its name, 84 px tall, a third of the row.
const TILE =
  'relative flex h-[84px] min-w-0 cursor-pointer flex-col items-center justify-center gap-2 rounded-[14px] border border-slate-200 bg-slate-50 px-1 text-[13px] font-medium text-slate-900 transition hover:bg-slate-100 active:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-100 dark:hover:bg-slate-800 dark:active:bg-slate-700';
const TILE_GLYPH = 'text-brand-700 dark:text-brand-300';
// The unread count's red, the Apps button's dot's (phone-apps-drawer.md "The unread dot").
const UNREAD_RED = '#dc2626';

export type AppsDrawerProps = {
  app: BrandApp;
  // The open item, for Explorer's place.
  itemId: string | null;
  // The Inbox's unread count; undefined where the app has no Inbox (livehuddle) or before it is read.
  inboxCount: number | undefined;
  hasInbox: boolean;
  onClose: () => void;
};

export function AppsDrawer({ app, itemId, inboxCount, hasInbox, onClose }: AppsDrawerProps) {
  const titleId = useId();
  const snapshot = usePhoneApps({ live: true });
  const call = useItemCallAction();
  const { source } = useItemCalls();
  const { authLoaded, isSignedIn } = useDeferredAuth();
  const toast = useToast();
  const items = APP_ITEMS[app];
  const name =
    itemNameNow(snapshot?.itemName)?.trim() || source?.title?.trim() || `Untitled ${items.noun}`;
  const tiles = phoneAppsTiles({
    hasInbox,
    snapshot,
    call: call ? { kind: call.kind } : null,
    signedIn: authLoaded && isSignedIn,
  });
  // A tile that acts closes the drawer first, so what it opens (a dialog, a toast) is not under the scrim.
  const act = (run: () => void) => () => {
    onClose();
    run();
  };
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success('Link copied');
    } catch {
      toast.error('Couldn’t copy the link');
    }
  };
  const tile = (id: PhoneAppsTileId): ReactNode => {
    switch (id) {
      case 'explorer':
        return (
          <a key={id} href={explorerItemHref(itemId)} data-apps-tile={id} className={TILE}>
            <span className={TILE_GLYPH}>
              <ExplorerGlyph aria-hidden />
            </span>
            Explorer
          </a>
        );
      case 'call':
        if (!call) return null;
        return (
          <button
            key={id}
            type="button"
            data-apps-tile={id}
            onClick={act(call.run)}
            disabled={call.kind === 'start' && call.starting}
            className={TILE}
          >
            <span
              className={
                call.kind === 'join' ? 'text-emerald-600 dark:text-emerald-400' : TILE_GLYPH
              }
            >
              <CallGlyph aria-hidden />
            </span>
            {call.kind === 'join' ? (
              <span className="flex flex-col items-center leading-tight">
                Join Call
                <span className="text-xs font-normal text-slate-600 dark:text-slate-300">
                  {inCallWords(call.live.people)}
                </span>
              </span>
            ) : call.starting ? (
              'Starting'
            ) : (
              'Call'
            )}
          </button>
        );
      case 'share':
        return snapshot ? (
          <button
            key={id}
            type="button"
            data-apps-tile={id}
            onClick={act(snapshot.onOpenShare)}
            className={TILE}
          >
            <span className={TILE_GLYPH}>
              <ShareGlyph aria-hidden />
            </span>
            Share
          </button>
        ) : null;
      case 'present':
        return snapshot?.present ? (
          <button
            key={id}
            type="button"
            data-apps-tile={id}
            onClick={act(snapshot.present.onPresent)}
            disabled={snapshot.present.starting}
            className={TILE}
          >
            <span className={TILE_GLYPH}>
              <PresentGlyph aria-hidden />
            </span>
            {snapshot.present.starting ? 'Starting' : 'Present'}
          </button>
        ) : null;
      case 'copy-link':
        return (
          <button
            key={id}
            type="button"
            data-apps-tile={id}
            onClick={act(() => void copyLink())}
            className={TILE}
          >
            <span className={TILE_GLYPH}>
              <LinkGlyph aria-hidden />
            </span>
            Copy Link
          </button>
        );
      case 'make-copy':
        return snapshot?.onMakeCopy ? (
          <button
            key={id}
            type="button"
            data-apps-tile={id}
            onClick={act(snapshot.onMakeCopy)}
            disabled={snapshot.copying}
            className={TILE}
          >
            <span className={TILE_GLYPH}>
              <CopyGlyph aria-hidden />
            </span>
            {snapshot.copying ? 'Copying' : 'Make a Copy'}
          </button>
        ) : null;
      case 'inbox':
        return (
          <a
            key={id}
            href={explorerHref('inbox')}
            data-apps-tile={id}
            aria-label={inboxCount ? `Inbox, ${inboxCount} unread` : 'Inbox'}
            className={TILE}
          >
            <span className={TILE_GLYPH}>
              <InboxGlyph />
            </span>
            Inbox
            {inboxCount ? (
              <CountBadge
                size="md"
                background={UNREAD_RED}
                color="#ffffff"
                className="absolute right-3 top-2.5"
              >
                <span aria-hidden>{inboxBadgeWords(inboxCount)}</span>
              </CountBadge>
            ) : null}
          </a>
        );
    }
  };
  const slots = [snapshot?.approval, snapshot?.leadAction, snapshot?.shareAction].filter(Boolean);
  return (
    <PhoneDrawer
      name="Apps"
      labelledBy={titleId}
      layer="modal"
      onClose={onClose}
      attrs={{ 'data-phone-apps': '' }}
    >
      <div className="flex min-h-0 flex-col gap-4 overflow-y-auto px-4 pb-4 pt-1">
        <div className="flex items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-slate-100 dark:bg-slate-800">
            <BrandMark app={app} className="size-7" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="truncate text-base font-semibold leading-[22px]">
              {name}
            </h2>
            <p className="truncate text-[13px] leading-[18px] text-slate-600 dark:text-slate-300">
              {app}
              {snapshot?.shareWords ? ` · ${snapshot.shareWords}` : ''}
            </p>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full bg-slate-100 text-slate-700 transition hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            <CloseGlyph aria-hidden />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2">{tiles.map(tile)}</div>

        {slots.length ? (
          // The app's own actions, as its corner card draws them, with their names (corner-actions.css).
          <div data-phone-apps-slots="" className="flex flex-wrap items-center gap-2">
            {slots}
          </div>
        ) : null}

        <AccountRow onOpenAccount={snapshot?.onOpenAccount} onClose={onClose} />
      </div>
    </PhoneDrawer>
  );
}

const ROW =
  'flex h-14 w-full cursor-pointer items-center gap-3 rounded-xl px-2 text-left transition hover:bg-slate-100 dark:hover:bg-slate-800';

// The account, after a hairline: Account (Settings on its Account category, where Sign Out lives) or Sign In.
function AccountRow({
  onOpenAccount,
  onClose,
}: {
  onOpenAccount: (() => void) | undefined;
  onClose: () => void;
}) {
  const { authLoaded, isSignedIn, user } = useDeferredAuth();
  const { signInHref } = useAuthHrefs();
  const savedLook = useSavedLook();
  if (!authLoaded) return null;
  const words = (title: string, line: string) => (
    <span className="flex min-w-0 flex-1 flex-col">
      <span className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
        {title}
      </span>
      <span className="truncate text-[13px] text-slate-600 dark:text-slate-300">{line}</span>
    </span>
  );
  const chevron = (
    <span className="text-slate-500 dark:text-slate-400">
      <ChevronGlyph aria-hidden />
    </span>
  );
  const body = isSignedIn ? (
    <>
      <PictureDisc
        pictureUrl={user?.picture}
        name={user?.fullName ?? user?.username ?? ''}
        size={36}
        aria-hidden
        style={{ '--avatar': accountAvatarFill(user, savedLook) } as CSSProperties}
        className="bg-(--avatar) text-[13px] font-semibold text-white"
      >
        {accountInitials(user)}
      </PictureDisc>
      {words('Account', 'Settings, theme and sign out')}
      {chevron}
    </>
  ) : (
    <>
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
        <SignInIcon size={16} />
      </span>
      {words('Sign In', 'Keep your work on every device')}
      {chevron}
    </>
  );
  return (
    <>
      <div role="separator" className="h-px bg-slate-200 dark:bg-slate-700" />
      {!isSignedIn ? (
        <Link href={signInHref} data-apps-account="" className={ROW}>
          {body}
        </Link>
      ) : onOpenAccount ? (
        <button
          type="button"
          data-apps-account=""
          onClick={() => {
            onClose();
            onOpenAccount();
          }}
          className={ROW}
        >
          {body}
        </button>
      ) : (
        <Link href="/explorer?settings=account" data-apps-account="" className={ROW}>
          {body}
        </Link>
      )}
    </>
  );
}
