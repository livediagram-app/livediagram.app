'use client';

// A link's place, as a step inside the Resources dialog (each product's docs/specs/008-canvas/
// element-menu-quick-bar.md "Resources"): the web address field, the tabs, or the app's own files. The dialog draws
// it under a back bar that leads back to Link's places; picking or saving here sets the link and the dialog returns
// to its list. It is the link picker's three modes, one at a time, so a link never opens a second dialog.
import { useState } from 'react';
import type { IndexClient } from '@liveworkspace/index-client';
import { APP_ITEMS, type AppName } from '@liveworkspace/sites';
import {
  Button,
  CompactEmptyState,
  Glyph,
  NoMatches,
  TextInput,
  lucideGlyph,
} from '@liveworkspace/ui';
import { lucideFileText, lucideSearch } from '@liveworkspace/icons/lucide';
import { matches } from '@liveworkspace/icons';
import { indexClient } from '../../lib/index-client';
import { normaliseUrl } from '../../lib/url-safety';
import { useRecentFiles } from '../connect/useRecentFiles';

const FileGlyph = lucideGlyph(lucideFileText, 20);
const SearchGlyph = lucideGlyph(lucideSearch, 15);

export type ResourceLinkPick =
  | { kind: 'url'; url: string }
  | { kind: 'tab'; tabId: string }
  // A file of a product: this app's own, or another's.
  | { kind: 'file'; app: AppName; id: string; name: string };

type Named = { id: string; name: string };

const ROW =
  'group flex w-full cursor-pointer items-center gap-3 rounded-xl border px-3.5 py-3 text-left text-sm transition-[border-color,background-color] duration-micro motion-reduce:transition-none outline-none focus-visible:ring-2 focus-visible:ring-brand-500';
const ROW_OFF =
  'border-slate-200 bg-white text-slate-800 hover:border-brand-300 hover:bg-brand-50/40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:border-brand-500/60 dark:hover:bg-slate-800/70';
const ROW_ON =
  'border-brand-300 bg-brand-50 font-semibold text-brand-800 dark:border-brand-500/50 dark:bg-brand-500/15 dark:text-brand-100';

function CheckGlyph() {
  return (
    <Glyph size={16} units={16}>
      <path d="m3.5 8.5 3 3 6-7" />
    </Glyph>
  );
}

function PickList({
  items,
  picked,
  note,
  empty,
  onPick,
}: {
  items: readonly Named[];
  // The one the link goes to now.
  picked: string | null;
  // A chip on one row: the tab the element is on.
  note?: { id: string; label: string };
  empty: { title: string; line: string };
  onPick: (item: Named) => void;
}) {
  if (items.length === 0)
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-1 px-6 text-center">
        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{empty.title}</p>
        <p className="text-[13px] text-slate-500 dark:text-slate-400">{empty.line}</p>
      </div>
    );
  return (
    <ul className="flex flex-col gap-2" data-resource-link-list="">
      {items.map((item) => (
        <li key={item.id}>
          <button
            type="button"
            data-row=""
            aria-current={picked === item.id ? 'true' : undefined}
            onClick={() => onPick(item)}
            className={`${ROW} ${picked === item.id ? ROW_ON : ROW_OFF}`}
          >
            <span className="min-w-0 flex-1 truncate">{item.name}</span>
            {note?.id === item.id ? (
              <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                <span className="text-optical-line">{note.label}</span>
              </span>
            ) : null}
            {picked === item.id ? (
              <span aria-hidden className="shrink-0 text-brand-700 dark:text-brand-200">
                <CheckGlyph />
              </span>
            ) : null}
          </button>
        </li>
      ))}
    </ul>
  );
}

// A product's files: the person's recent ones of that app (the central index's Recent, across every app), with a
// search over their names. Every product's list reads the same: Loading, the list, "No <files> yet", no matches
// with a way to clear the search, and Try Again when the list could not be read.
function FilePanel({
  app,
  hostId,
  picked,
  client,
  onPick,
}: {
  app: AppName;
  // The file the element is in: never offered as its own link.
  hostId: string;
  picked: string | null;
  client: Pick<IndexClient, 'listItems'>;
  onPick: (pick: ResourceLinkPick) => void;
}) {
  const files = useRecentFiles(client, hostId);
  const [query, setQuery] = useState('');
  const { noun, nouns } = APP_ITEMS[app];
  // The product's own words for its files, capitalised as it writes them: "Knowledgebases", "Plans".
  const one = noun;
  const many = nouns;
  if (files.state === 'loading')
    return (
      <p role="status" className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">
        Loading {many}…
      </p>
    );
  if (files.state === 'failed')
    return (
      <CompactEmptyState
        className="py-8"
        icon={<FileGlyph />}
        title={`Couldn\u2019t Load Your ${many}`}
        description="Check your connection and try again."
        action={
          <Button variant="secondary" size="xs" onClick={files.retry}>
            Try Again
          </Button>
        }
      />
    );
  const mine = files.items
    .filter((item) => item.app === app)
    .map((item) => ({ id: item.id, name: item.title.trim() || `Untitled ${one}` }));
  if (mine.length === 0)
    return (
      <CompactEmptyState
        className="py-8"
        icon={<FileGlyph />}
        title={`No ${many} Yet`}
        description={`Make a ${one} in ${app} to link to it.`}
      />
    );
  const shown = query.trim() ? mine.filter((f) => matches(query, f.name)) : mine;
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3" data-resource-link-files={app}>
      <label className="relative block">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
          <SearchGlyph />
        </span>
        <TextInput
          type="search"
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Search ${many}`}
          aria-label={`Search ${many}`}
          className="pl-9"
        />
      </label>
      {shown.length === 0 ? (
        <NoMatches
          size="regular"
          className="py-6"
          things={many}
          query={query}
          onClear={() => setQuery('')}
        />
      ) : (
        <PickList
          items={shown}
          picked={picked}
          empty={{ title: `No ${many} Yet`, line: '' }}
          onPick={(f) => onPick({ kind: 'file', app, id: f.id, name: f.name })}
        />
      )}
    </div>
  );
}

export function ResourceLinkPanel({
  mode,
  current,
  tabs,
  currentTabId,
  hostId,
  client = indexClient,
  onPick,
}: {
  // A web address, a tab, or a file of the product named.
  mode: 'url' | 'tab' | { app: AppName };
  // Where the link goes now, so the step opens on it: its address typed in, its tab or file marked.
  current: { url?: string; tabId?: string; fileId?: string };
  tabs: readonly Named[];
  currentTabId: string;
  // The file the element is in.
  hostId: string;
  client?: Pick<IndexClient, 'listItems'>;
  onPick: (pick: ResourceLinkPick) => void;
}) {
  const [typed, setTyped] = useState(current.url ?? '');
  if (mode === 'tab')
    return (
      <PickList
        items={tabs}
        picked={current.tabId ?? null}
        note={{ id: currentTabId, label: 'This tab' }}
        empty={{ title: 'No Tabs Yet', line: 'Add a Tab to link to it.' }}
        onPick={(t) => onPick({ kind: 'tab', tabId: t.id })}
      />
    );
  if (mode !== 'url')
    return (
      <FilePanel
        app={mode.app}
        hostId={hostId}
        picked={current.fileId ?? null}
        client={client}
        onPick={onPick}
      />
    );
  const save = () => {
    const url = normaliseUrl(typed);
    if (url) onPick({ kind: 'url', url });
  };
  return (
    <div className="flex flex-col gap-2" data-resource-link-url="">
      <label
        htmlFor="resource-link-url"
        className="text-[13px] font-medium text-slate-700 dark:text-slate-200"
      >
        Web address
      </label>
      <TextInput
        id="resource-link-url"
        type="url"
        inputMode="url"
        autoFocus
        value={typed}
        placeholder="https://example.com"
        onChange={(e) => setTyped(e.target.value)}
        onKeyDown={(e) => {
          if (e.key !== 'Enter') return;
          e.preventDefault();
          save();
        }}
      />
      <p className="text-[13px] text-slate-500 dark:text-slate-400">
        Opens in a new tab. We&apos;ll add https:// if you leave off the scheme.
      </p>
      <Button onClick={save} disabled={!typed.trim()} className="mt-2 self-start">
        Save Link
      </Button>
    </div>
  );
}
