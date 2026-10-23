'use client';

// Share an item through links (liveplanner's ShareDialog, over the index): each link is a pass at a level
// (Viewer, Participant, Editor), for every tab or one, lasting forever or a while; a password guards every
// link at once. It loads the item's links once when it opens and applies each change at once, taking it
// back if the index refuses.

import { useState, type ReactNode } from 'react';
import {
  SHARE_LINK_EXPIRIES,
  SHARE_PASSWORD_MAX,
  type IndexClient,
  type Level,
  type ShareLink,
  type ShareLinkExpiry,
} from '@liveworkspace/index-client';
import { useShareLinks } from '../data/useShareLinks';
import { timeLeftCompact } from '../time';
import { Button } from '../ui/Button';
import { Dialog, DialogCloseButton, DialogFooter, DialogHeader } from '../ui/Dialog';
import {
  CopyIcon,
  EyeIcon,
  LinkIcon,
  LockIcon,
  PencilLineIcon,
  TrashIcon,
  VoteIcon,
} from '../ui/icons';
import type { ItemRef, ShareUrl } from '../types';
import { kindWords } from '../words';

export const LEVEL_PASS: Record<
  Level,
  { title: string; blurb: string; Icon: () => ReactNode; chip: string }
> = {
  edit: {
    title: 'Editor',
    blurb: 'Works with you in real time.',
    Icon: () => <PencilLineIcon />,
    chip: 'bg-brand-50 text-brand-700 ring-brand-200 dark:bg-brand-500/10 dark:text-brand-300 dark:ring-brand-500/30',
  },
  participate: {
    title: 'Participant',
    blurb: 'Comments, votes and works items. Can’t reshape it.',
    Icon: () => <VoteIcon />,
    chip: 'bg-teal-50 text-teal-800 ring-teal-200 dark:bg-teal-500/10 dark:text-teal-300 dark:ring-teal-500/30',
  },
  view: {
    title: 'Viewer',
    blurb: 'Watches along. Can’t comment or change a thing.',
    Icon: () => <EyeIcon />,
    chip: 'bg-violet-50 text-violet-700 ring-violet-200 dark:bg-violet-500/10 dark:text-violet-300 dark:ring-violet-500/30',
  },
};

const LEVEL_ORDER: Level[] = ['view', 'participate', 'edit'];

export const LIFETIMES: Record<ShareLinkExpiry, string> = {
  never: 'Forever',
  week: '1 week',
  month: '1 month',
  sixMonths: '6 months',
};

export type ShareTab = { id: string; name: string };

export type ShareDialogProps = {
  client: IndexClient;
  item: ItemRef & { title: string };
  // The item's tabs, so a link can open just one; omit for an app without tabs.
  tabs?: ShareTab[];
  // A link's address, as the item's app builds it.
  shareUrl: ShareUrl;
  onClose: () => void;
  // A refusal said in words (the Explorer's toast); defaults to an inline note.
  onError?: (text: string) => void;
};

const SELECT =
  'rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200';

export function ShareDialog({
  client,
  item,
  tabs = [],
  shareUrl,
  onClose,
  onError,
}: ShareDialogProps) {
  const [note, setNote] = useState<string | null>(null);
  const share = useShareLinks(client, item.id, onError ?? setNote);
  const [level, setLevel] = useState<Level>('view');
  const [tabId, setTabId] = useState<string | null>(null);
  const [expiry, setExpiry] = useState<ShareLinkExpiry>('never');
  const word = kindWords(item.app).lowerOne;
  return (
    <Dialog onClose={onClose} ariaLabel={`Share ${item.title}`} size="xl">
      <DialogHeader
        title={`Share “${item.title || 'Untitled'}”`}
        subtitle={`Anyone with a link can open this ${word} at its level.`}
      >
        <DialogCloseButton onClick={onClose} />
      </DialogHeader>
      <div className="flex flex-col gap-5 px-6 py-4">
        <section aria-label="New link">
          <div role="radiogroup" aria-label="Level" className="grid grid-cols-3 gap-2">
            {LEVEL_ORDER.map((l) => {
              const pass = LEVEL_PASS[l];
              const on = level === l;
              return (
                <button
                  key={l}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setLevel(l)}
                  className={`flex flex-col items-start gap-1 rounded-lg border p-2.5 text-left transition ${
                    on
                      ? 'border-brand-500 bg-brand-50/70 dark:border-brand-400 dark:bg-brand-500/10'
                      : 'border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800'
                  }`}
                >
                  <span className="flex items-center gap-1.5 text-sm font-semibold text-slate-900 dark:text-slate-100">
                    <pass.Icon />
                    {pass.title}
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">{pass.blurb}</span>
                </button>
              );
            })}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {tabs.length > 0 ? (
              <label className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
                Opens
                <select
                  className={SELECT}
                  value={tabId ?? ''}
                  onChange={(e) => setTabId(e.target.value || null)}
                >
                  <option value="">Every tab</option>
                  {tabs.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <label className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
              Lasts
              <select
                className={SELECT}
                value={expiry}
                onChange={(e) => setExpiry(e.target.value as ShareLinkExpiry)}
              >
                {SHARE_LINK_EXPIRIES.map((x) => (
                  <option key={x} value={x}>
                    {LIFETIMES[x]}
                  </option>
                ))}
              </select>
            </label>
            <span className="flex-1" />
            <Button
              size="sm"
              disabled={share.busy}
              onClick={async () => {
                const link = await share.create({ level, tabId, expiry });
                if (link) void copy(shareUrl(link, item));
              }}
            >
              <LinkIcon />
              Create and Copy Link
            </Button>
          </div>
        </section>

        <section aria-label="Links">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Links
          </h3>
          {share.loading ? (
            <p className="text-sm text-slate-500">Loading links…</p>
          ) : share.error ? (
            <p className="text-sm text-rose-700 dark:text-rose-300">Couldn’t load the links.</p>
          ) : share.links.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">No links yet.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {share.links.map((link) => (
                <LinkRow
                  key={link.code}
                  link={link}
                  tabs={tabs}
                  url={shareUrl(link, item)}
                  onLevel={(l) => void share.update(link.code, { level: l })}
                  onTab={(t) => void share.update(link.code, { tabId: t })}
                  onExtend={() => void share.extend(link.code)}
                  onRevoke={() => void share.revoke(link.code)}
                />
              ))}
            </ul>
          )}
        </section>

        <PasswordSection
          passwordSet={share.passwordSet}
          busy={share.busy}
          onSet={(p) => share.setPassword(p)}
        />
        {note ? (
          <p role="alert" className="text-sm text-rose-700 dark:text-rose-300">
            {note}
          </p>
        ) : null}
      </div>
      <DialogFooter>
        <Button variant="secondary" size="sm" onClick={onClose}>
          Done
        </Button>
      </DialogFooter>
    </Dialog>
  );
}

function LinkRow({
  link,
  tabs,
  url,
  onLevel,
  onTab,
  onExtend,
  onRevoke,
}: {
  link: ShareLink;
  tabs: ShareTab[];
  url: string;
  onLevel: (level: Level) => void;
  onTab: (tabId: string | null) => void;
  onExtend: () => void;
  onRevoke: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const expired = link.expiresAt !== null && link.expiresAt <= Date.now();
  return (
    <li
      data-share-link={link.code}
      className={`flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 ${
        expired
          ? 'border-dashed border-slate-300 opacity-70 dark:border-slate-600'
          : 'border-slate-200 dark:border-slate-700'
      }`}
    >
      <span
        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ring-1 ${LEVEL_PASS[link.level].chip}`}
      >
        {LEVEL_PASS[link.level].title}
      </span>
      <span className="min-w-0 flex-1 truncate font-mono text-xs text-slate-600 dark:text-slate-300">
        {url}
      </span>
      <select
        aria-label="Level"
        className={SELECT}
        value={link.level}
        onChange={(e) => onLevel(e.target.value as Level)}
      >
        {LEVEL_ORDER.map((l) => (
          <option key={l} value={l}>
            {LEVEL_PASS[l].title}
          </option>
        ))}
      </select>
      {tabs.length > 0 ? (
        <select
          aria-label="Opens"
          className={SELECT}
          value={link.tabId ?? ''}
          onChange={(e) => onTab(e.target.value || null)}
        >
          <option value="">Every tab</option>
          {tabs.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      ) : null}
      <span className="text-[11px] text-slate-500 dark:text-slate-400">
        {link.expiresAt === null
          ? 'Forever'
          : expired
            ? 'Expired'
            : `${timeLeftCompact(link.expiresAt - Date.now())} left`}
      </span>
      {link.expiresAt !== null ? (
        <Button variant="ghost" size="xs" onClick={onExtend}>
          Extend
        </Button>
      ) : null}
      <Button
        variant="secondary"
        size="xs"
        onClick={async () => {
          if (await copy(url)) {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }
        }}
        aria-label="Copy link"
      >
        <CopyIcon />
        {copied ? 'Copied' : 'Copy'}
      </Button>
      <button
        type="button"
        onClick={onRevoke}
        aria-label="Turn off link"
        className="inline-flex items-center rounded-md border border-slate-200 px-1.5 py-1 text-slate-500 transition hover:border-rose-300 hover:text-rose-600 dark:border-slate-600 dark:text-slate-300 dark:hover:border-rose-400/60 dark:hover:text-rose-300"
      >
        <TrashIcon />
      </button>
    </li>
  );
}

function PasswordSection({
  passwordSet,
  busy,
  onSet,
}: {
  passwordSet: boolean;
  busy: boolean;
  onSet: (password: string | null) => Promise<boolean>;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState('');
  return (
    <section
      aria-label="Password"
      className="rounded-lg border border-slate-200 px-3 py-2.5 dark:border-slate-700"
    >
      <div className="flex items-center gap-2">
        <span className="text-slate-400">
          <LockIcon />
        </span>
        <span className="flex-1 text-sm text-slate-700 dark:text-slate-200">
          {passwordSet ? 'Links need a password.' : 'No password: a link alone opens it.'}
        </span>
        {passwordSet ? (
          <Button variant="ghost" size="xs" disabled={busy} onClick={() => void onSet(null)}>
            Remove
          </Button>
        ) : null}
        <Button variant="secondary" size="xs" onClick={() => setEditing((e) => !e)}>
          {passwordSet ? 'Change' : 'Set Password'}
        </Button>
      </div>
      {editing ? (
        <form
          className="mt-2 flex items-center gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!value) return;
            if (await onSet(value)) {
              setValue('');
              setEditing(false);
            }
          }}
        >
          <input
            type="password"
            autoComplete="new-password"
            value={value}
            maxLength={SHARE_PASSWORD_MAX}
            onChange={(e) => setValue(e.target.value)}
            aria-label="Password"
            placeholder="Password"
            className="min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-900"
          />
          <Button type="submit" size="xs" disabled={busy || !value}>
            Save
          </Button>
        </form>
      ) : null}
    </section>
  );
}

async function copy(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
