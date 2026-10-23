'use client';

// The Explorer's sidebar (liveplanner's ExplorerSidebar): Overview (Home, Inbox, Shared With Me), Spaces
// (My Work and its folders, each team and its folders), and More (the Library's Recent, Favourites,
// Unsorted and Tags, then the Trash). Rows carry toned tiles and the current row is a raised pill, in the
// host app's brand colour. The tree reads the folder store, so it costs no request of its own.

import { useCallback, useEffect, useId, useState, type ReactNode } from 'react';
import type { Folder } from '@liveworkspace/index-client';
import { CountBadge } from '../ui/CountBadge';
import {
  ClockIcon,
  FolderSolidIcon,
  HomeIcon,
  InboxIcon,
  LibraryIcon,
  MyWorkIcon,
  PlusIcon,
  ShareIcon,
  StarIcon,
  TagIcon,
  TeamIcon,
  TrashIcon,
  TreeChevronIcon,
  UnsortedIcon,
} from '../ui/icons';
import { inboxCount } from '../data/useInbox';
import { sameView, SIDEBAR_LABELS, type ExplorerView } from '../views';
import { TagDot } from './badges';
import { useExplorer } from './context';

type Tone = 'sky' | 'violet' | 'amber' | 'emerald' | 'indigo' | 'rose';

const TONES: Record<Tone, string> = {
  sky: 'bg-sky-100 text-sky-700 dark:bg-sky-400/15 dark:text-sky-300',
  violet: 'bg-violet-100 text-violet-700 dark:bg-violet-400/15 dark:text-violet-300',
  amber: 'bg-amber-100 text-amber-700 dark:bg-amber-400/15 dark:text-amber-300',
  emerald: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300',
  indigo: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-400/15 dark:text-indigo-300',
  rose: 'bg-rose-100 text-rose-700 dark:bg-rose-400/15 dark:text-rose-300',
};
// liveplanner's current row and tile are violet, its brand; here they are each app's brand.
const TILE_CURRENT = 'bg-brand-600 text-white dark:bg-brand-500';
const TILE = 'grid size-6 shrink-0 place-items-center rounded-lg [&>svg]:block [&>svg]:size-3.5';
const CURRENT =
  'border-brand-200 bg-white shadow-[0_6px_18px_-8px_color-mix(in_srgb,var(--color-brand-600)_35%,transparent)] dark:border-transparent dark:bg-transparent dark:bg-gradient-to-r dark:from-brand-400/[0.18] dark:to-brand-400/[0.04] dark:shadow-none dark:ring-1 dark:ring-inset dark:ring-brand-400/35';
const RESTING = 'border-transparent hover:bg-slate-100 dark:hover:bg-slate-800';
const INDENT_STEP = 16;

const EXPANDED_KEY = 'liveworkspace:explorer-expanded';
const MY_WORK = 'my-work';
const LIBRARY = 'library';

function useExpanded() {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set([LIBRARY]));
  useEffect(() => {
    try {
      const saved = localStorage.getItem(EXPANDED_KEY);
      if (saved) setExpanded(new Set(JSON.parse(saved) as string[]));
    } catch {
      // Private mode or no storage: start folded.
    }
  }, []);
  const toggle = useCallback((key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      try {
        localStorage.setItem(EXPANDED_KEY, JSON.stringify([...next]));
      } catch {
        // Ignored: expansion is a convenience.
      }
      return next;
    });
  }, []);
  return { expanded, toggle };
}

export function SidebarRow({
  icon,
  tone,
  label,
  selected,
  onActivate,
  depth,
  badge,
  expandable = false,
  expanded = false,
  onToggleExpand,
  children,
}: {
  icon: ReactNode;
  tone?: Tone;
  label: string;
  selected: boolean;
  onActivate: () => void;
  depth: number;
  badge?: number;
  expandable?: boolean;
  expanded?: boolean;
  onToggleExpand?: () => void;
  children?: ReactNode;
}) {
  return (
    <li
      role="treeitem"
      aria-label={badge !== undefined ? `${label} (${badge})` : label}
      aria-level={depth + 1}
      aria-selected={selected}
      aria-expanded={expandable ? expanded : undefined}
    >
      <div
        className={`group flex items-center gap-1 rounded-xl border px-1 transition-colors ${selected ? CURRENT : RESTING}`}
        style={{ paddingLeft: depth * INDENT_STEP + 4 }}
      >
        <button
          type="button"
          tabIndex={-1}
          aria-hidden
          onClick={() => expandable && onToggleExpand?.()}
          className={`flex h-5 w-5 shrink-0 items-center justify-center text-slate-400 transition ${
            expandable
              ? 'cursor-pointer hover:text-slate-700 dark:hover:text-slate-200'
              : 'pointer-events-none'
          }`}
        >
          {expandable ? <TreeChevronIcon open={expanded} /> : null}
        </button>
        <button
          type="button"
          onClick={onActivate}
          aria-current={selected ? 'page' : undefined}
          className={`flex min-w-0 flex-1 items-center gap-2.5 rounded text-left text-sm leading-5 outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
            tone ? 'py-1.5' : 'py-2'
          } ${
            selected
              ? 'font-semibold text-brand-900 dark:text-white'
              : 'font-medium text-slate-700 dark:text-slate-200'
          }`}
        >
          {tone ? (
            <span className={`${TILE} ${selected ? TILE_CURRENT : TONES[tone]}`}>{icon}</span>
          ) : (
            <span
              className={`shrink-0 ${selected ? 'text-brand-700 dark:text-brand-300' : 'text-slate-400'}`}
            >
              {icon}
            </span>
          )}
          <span className="min-w-0 flex-1 truncate">{label}</span>
          {badge !== undefined ? <CountBadge count={badge} className="ml-1" /> : null}
        </button>
      </div>
      {expandable && expanded && children ? <ul role="group">{children}</ul> : null}
    </li>
  );
}

function SidebarGroup({
  title,
  first = false,
  children,
}: {
  title: string;
  first?: boolean;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <section>
      <h2
        id={id}
        className={`box-content h-4 px-2.5 pb-2 text-[11px] font-semibold uppercase leading-4 tracking-[0.1em] text-slate-500 dark:text-slate-400 ${
          first ? '' : 'mt-6 pt-1'
        }`}
      >
        {title}
      </h2>
      <ul role="tree" aria-labelledby={id}>
        {children}
      </ul>
    </section>
  );
}

function FolderSubtree({
  folder,
  depth,
  expanded,
  toggle,
}: {
  folder: Folder;
  depth: number;
  expanded: Set<string>;
  toggle: (key: string) => void;
}) {
  const { folders, view, navigate } = useExplorer();
  const kids = folders.childrenOf(folder.id, folder.teamId);
  const target: ExplorerView = folder.teamId
    ? { kind: 'team', id: folder.teamId, folderId: folder.id }
    : { kind: 'folder', id: folder.id };
  return (
    <SidebarRow
      icon={<FolderSolidIcon open={expanded.has(folder.id)} />}
      label={folder.name}
      selected={sameView(view, target)}
      onActivate={() => navigate(target)}
      depth={depth}
      expandable={kids.length > 0}
      expanded={expanded.has(folder.id)}
      onToggleExpand={() => toggle(folder.id)}
    >
      {kids.map((f) => (
        <FolderSubtree
          key={f.id}
          folder={f}
          depth={depth + 1}
          expanded={expanded}
          toggle={toggle}
        />
      ))}
    </SidebarRow>
  );
}

export function Sidebar() {
  const { view, navigate, folders, teams, tags, inbox, viewerId, manageTeamsUrl } = useExplorer();
  const { expanded, toggle } = useExpanded();
  const is = (v: ExplorerView) => sameView(view, v);
  const myRoots = folders.childrenOf(null, null);
  return (
    <nav aria-label="Sections" className="text-sm">
      <SidebarGroup title="Overview" first>
        <SidebarRow
          icon={<HomeIcon />}
          tone="sky"
          label={SIDEBAR_LABELS.home}
          selected={view.kind === 'home'}
          onActivate={() => navigate({ kind: 'home' })}
          depth={0}
        />
        <SidebarRow
          icon={<InboxIcon />}
          tone="violet"
          label={SIDEBAR_LABELS.inbox}
          selected={view.kind === 'inbox'}
          onActivate={() => navigate({ kind: 'inbox' })}
          depth={0}
          badge={inboxCount(inbox.data, viewerId)}
        />
        <SidebarRow
          icon={<ShareIcon />}
          tone="emerald"
          label={SIDEBAR_LABELS.shared}
          selected={view.kind === 'shared'}
          onActivate={() => navigate({ kind: 'shared' })}
          depth={0}
        />
      </SidebarGroup>
      <SidebarGroup title="Spaces">
        <SidebarRow
          icon={<MyWorkIcon />}
          tone="sky"
          label={SIDEBAR_LABELS.myWork}
          selected={view.kind === 'all'}
          onActivate={() => navigate({ kind: 'all' })}
          depth={0}
          expandable={myRoots.length > 0}
          expanded={expanded.has(MY_WORK)}
          onToggleExpand={() => toggle(MY_WORK)}
        >
          {myRoots.map((f) => (
            <FolderSubtree key={f.id} folder={f} depth={1} expanded={expanded} toggle={toggle} />
          ))}
        </SidebarRow>
        {teams.map((t) => {
          const roots = folders.childrenOf(null, t.id);
          const key = `team:${t.id}`;
          return (
            <SidebarRow
              key={t.id}
              icon={<TeamIcon />}
              tone="indigo"
              label={t.name}
              selected={view.kind === 'team' && view.id === t.id && !view.folderId}
              onActivate={() => navigate({ kind: 'team', id: t.id })}
              depth={0}
              expandable={roots.length > 0}
              expanded={expanded.has(key)}
              onToggleExpand={() => toggle(key)}
            >
              {roots.map((f) => (
                <FolderSubtree
                  key={f.id}
                  folder={f}
                  depth={1}
                  expanded={expanded}
                  toggle={toggle}
                />
              ))}
            </SidebarRow>
          );
        })}
        {manageTeamsUrl ? (
          <SidebarRow
            icon={<PlusIcon />}
            label={SIDEBAR_LABELS.manageTeams}
            selected={false}
            onActivate={() => window.location.assign(manageTeamsUrl)}
            depth={0}
          />
        ) : null}
      </SidebarGroup>
      <SidebarGroup title="More">
        <SidebarRow
          icon={<LibraryIcon />}
          label={SIDEBAR_LABELS.library}
          selected={false}
          onActivate={() => toggle(LIBRARY)}
          depth={0}
          expandable
          expanded={expanded.has(LIBRARY)}
          onToggleExpand={() => toggle(LIBRARY)}
        >
          <SidebarRow
            icon={<ClockIcon />}
            label="Recent"
            selected={is({ kind: 'recent' })}
            onActivate={() => navigate({ kind: 'recent' })}
            depth={1}
          />
          <SidebarRow
            icon={<StarIcon />}
            label="Favourites"
            selected={is({ kind: 'favourites' })}
            onActivate={() => navigate({ kind: 'favourites' })}
            depth={1}
          />
          <SidebarRow
            icon={<UnsortedIcon />}
            label={SIDEBAR_LABELS.unsorted}
            selected={is({ kind: 'unsorted' })}
            onActivate={() => navigate({ kind: 'unsorted' })}
            depth={1}
          />
          <SidebarRow
            icon={<TagIcon />}
            label={SIDEBAR_LABELS.tags}
            selected={view.kind === 'tags' && !view.id}
            onActivate={() => navigate({ kind: 'tags' })}
            depth={1}
            expandable={tags.tags.length > 0}
            expanded={expanded.has('tags')}
            onToggleExpand={() => toggle('tags')}
          >
            {tags.tags.map((t) => (
              <SidebarRow
                key={t.id}
                icon={<TagDot colour={t.colour} />}
                label={t.name}
                selected={view.kind === 'tags' && view.id === t.id}
                onActivate={() => navigate({ kind: 'tags', id: t.id })}
                depth={2}
              />
            ))}
          </SidebarRow>
        </SidebarRow>
        <SidebarRow
          icon={<TrashIcon />}
          label={SIDEBAR_LABELS.trash}
          selected={view.kind === 'trash'}
          onActivate={() => navigate({ kind: 'trash' })}
          depth={0}
        />
      </SidebarGroup>
    </nav>
  );
}
