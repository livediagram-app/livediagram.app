'use client';

// The editor's Explorer sections that are views of their own (docs/specs/013-workspace/explorer-structure.md "The
// pane"): Home, the Inbox, the Timeline, the Library and the Trash, each drawn for the pane from the Explorer page's
// own data hooks. Loaded only when a section is first shown (ExplorerPanelPane's dynamic imports), and each read
// starts only while its section is mounted, so opening the editor costs nothing more.
import { useState } from 'react';
import { dateKey, pickRenderer, timeLabel } from '@livedesign/ui';
import { ActivityPane } from '@/components/panels/ActivityPane';
import { GalleryPane } from '@/components/panels/GalleryPane';
import { ThemesPane } from '@/components/panels/ThemesPane';
import { DesignThumbnail } from '@/components/panels/DesignThumbnail';
import { AvatarStack } from '@/components/panels/home/HomeAvatar';
import { ConfirmPopover } from '@/components/primitives/ConfirmPopover';
import { ThisBrowserPill } from '@/components/primitives/ThisBrowserPill';
import { ClockIcon, DesignIcon, TrashIcon } from '@/components/primitives/explorer-icons';
import { useActivityFeed } from '@/app/explorer/useActivityFeed';
import { useTimelineFeed } from '@/app/explorer/useTimelineFeed';
import { useHome } from '@/app/explorer/home/useHome';
import {
  HOME_COPY,
  clockTime,
  locationLabel,
  summarySentence,
} from '@/app/explorer/home/home-copy';
import { dayHeading, groupsByDay, paneJumpBackIn } from '@/app/explorer/home/home-model';
import { TIMELINE_RENDERERS } from '@/app/explorer/timeline/renderers';
import { useTrash } from '@/hooks/persistence/useTrash';
import { useToast } from '@/hooks/ui/useToast';
import { explorerPathFor } from '@/app/explorer/routes';
import { LIBRARY_PAGES } from '@/app/explorer/sidebar/library-pages';
import { trackSidebar } from '@/app/explorer/sidebar/sidebar-telemetry';
import { daysLeftLabel, trashGroups, trashedOnLabel, type TrashGroup } from '@/lib/trash-groups';
import { relativeSince, useRelativeNow } from '@/lib/relative-time';
import {
  PANE_LINK,
  PANE_PREVIEW_BOX,
  PaneCard,
  PaneEmpty,
  PaneFailed,
  PaneGrid,
  PaneIconButton,
  PaneList,
  PaneRow,
  PaneSection,
  PaneSkeleton,
  PaneTile,
  type PaneTone,
} from './pane-parts';
import { usePaneDesignMenu } from '../explorer-tree/usePaneDesignMenu';
import { usePanelTree } from '../explorer-tree/PanelTreeContext';
import type { JumpBackInItem } from '@/app/explorer/home/home-model';
import type { HomeGroup, TimelineEvent } from '@livedesign/api-schema';
import { lucideGlyph } from '@livedesign/ui';
import { lucideRotateCcw, lucideTrash2 } from '@livedesign/icons/lucide';

const RestoreGlyph = lucideGlyph(lucideRotateCcw, 16);
const DeleteGlyph = lucideGlyph(lucideTrash2, 16);

// One of Jump Back In's designs as a preview card, with the design menu when the reader can reach it.
function JumpBackInCard({
  item,
  ownerId,
  onOpen,
  now,
}: {
  item: JumpBackInItem;
  ownerId: string;
  onOpen: () => void;
  now: number;
}) {
  const doc = usePanelTree().designById?.(item.designId);
  const menu = usePaneDesignMenu(doc);
  return (
    <PaneCard
      preview={
        <DesignThumbnail
          ownerId={ownerId}
          designId={item.designId}
          version={item.savedAt}
          empty={item.empty}
          shareCode={item.shareCode}
          offline={item.localOnly}
          className={PANE_PREVIEW_BOX}
        />
      }
      title={item.name || 'Untitled design'}
      meta={
        <span className="flex items-center gap-1.5">
          {/* Inside the row's button: a label, not a link (a link in a button is a control nested in a control). */}
          {item.localOnly ? <ThisBrowserPill asLabel /> : null}
          <span className="truncate">Opened {relativeSince(item.lastUsedAt, now)}</span>
        </span>
      }
      onActivate={onOpen}
      rowProps={{ onContextMenu: menu.onContextMenu }}
      trailing={menu.trailing}
    />
  );
}

// One of What Happened's groups: the people, what they did and where, with the design's menu.
function WhatHappenedRow({ group, onOpen }: { group: HomeGroup; onOpen: () => void }) {
  const doc = usePanelTree().designById?.(group.designId);
  const menu = usePaneDesignMenu(doc);
  const s = summarySentence(group);
  const sentence = `${s.people} ${s.verbs}${s.preposition ? ` ${s.preposition}` : ''} ${s.design}`;
  return (
    <PaneRow
      leading={
        <span className="flex w-[60px] justify-center">
          <AvatarStack people={group.people} size={28} />
        </span>
      }
      title={
        <span className="font-normal text-slate-600 dark:text-slate-300">
          <span className="font-semibold text-slate-800 dark:text-slate-100">{s.people}</span>{' '}
          {s.verbs}
          {s.preposition ? ` ${s.preposition}` : ''}{' '}
          <span className="font-semibold text-slate-800 dark:text-slate-100">{s.design}</span>
        </span>
      }
      label={sentence}
      meta={`${clockTime(group.latestAt)} · ${locationLabel(group)}`}
      onActivate={onOpen}
      rowProps={{ onContextMenu: menu.onContextMenu }}
      trailing={menu.trailing}
    />
  );
}

// An event's tile colour, by what happened: made, talked about, shared, moved, removed, or changed.
function eventTone(e: TimelineEvent): PaneTone {
  const t = e.eventType;
  if (/created|joined|accepted/.test(t)) return 'emerald';
  if (/comment|mention|reply/.test(t)) return 'sky';
  if (/share|invite|link|role/.test(t)) return 'violet';
  if (/moved|folder|renamed/.test(t)) return 'amber';
  if (/deleted|removed|trash|left|declined/.test(t)) return 'rose';
  return 'brand';
}

function TimelineRow({ event, ownerId }: { event: TimelineEvent; ownerId: string }) {
  const r = pickRenderer(event, TIMELINE_RENDERERS)(event, { viewerId: ownerId });
  const doc = usePanelTree().designById?.(event.sourceType === 'design' ? event.sourceId : '');
  const menu = usePaneDesignMenu(event.sourceType === 'design' ? doc : undefined);
  return (
    <PaneRow
      leading={<PaneTile tone={eventTone(event)}>{r.icon}</PaneTile>}
      title={r.subject ?? event.title}
      meta={
        <>
          {r.label ?? event.title} · {timeLabel(event.occurredAt)}
        </>
      }
      onActivate={r.onClick}
      rowProps={{ onContextMenu: menu.onContextMenu }}
      trailing={menu.trailing}
    />
  );
}

type Open = (id: string, shareCode?: string) => void;

// How many designs Home's Jump Back In lists in the pane.
const JUMP_BACK_IN_ROWS = 6;

export function HomeSection({
  ownerId,
  currentDesignId,
  onOpenDesign,
  onSeeTimeline,
}: {
  ownerId: string;
  currentDesignId: string | null;
  onOpenDesign: Open;
  // Home's See Timeline shows the Timeline in the pane, as the rail would.
  onSeeTimeline: () => void;
}) {
  const home = useHome(ownerId, () => {});
  const now = useRelativeNow();
  if (home.status === 'error')
    return <PaneFailed message={HOME_COPY.readFailed} onRetry={home.retry} />;
  if (home.status === 'loading') return <PaneSkeleton rows={6} />;
  const recent = paneJumpBackIn(home.jumpBackIn, currentDesignId, JUMP_BACK_IN_ROWS);
  // Empty only because the open design is left out: the person has a design, so "No designs yet" would be
  // wrong (explorer-structure.md "Home").
  const onlyOpen =
    recent.length === 0 &&
    [...home.jumpBackIn.mostUsed, ...home.jumpBackIn.recent].some(
      (d) => d.designId === currentDesignId,
    );
  return (
    <div className="flex flex-col gap-6">
      <PaneSection
        title={HOME_COPY.jumpBackIn}
        action={
          <a href={explorerPathFor({ kind: 'recent' })} className={PANE_LINK}>
            See all
          </a>
        }
      >
        {recent.length ? (
          <PaneGrid label={HOME_COPY.jumpBackIn}>
            {recent.map((d) => (
              <JumpBackInCard
                key={d.designId}
                item={d}
                ownerId={ownerId}
                now={now}
                onOpen={() => onOpenDesign(d.designId, d.shareCode ?? undefined)}
              />
            ))}
          </PaneGrid>
        ) : (
          <PaneEmpty
            icon={<ClockIcon />}
            title={onlyOpen ? HOME_COPY.jumpBackInOnlyOpenTitle : HOME_COPY.jumpBackInEmptyTitle}
            description={onlyOpen ? HOME_COPY.jumpBackInOnlyOpen : HOME_COPY.jumpBackInEmpty}
          />
        )}
      </PaneSection>
      {/* Only when someone else did something: an empty "What Happened" says nothing worth the room. */}
      {home.whatHappened.length ? (
        <PaneSection
          title={HOME_COPY.whatHappened}
          action={
            <button type="button" onClick={onSeeTimeline} className={PANE_LINK}>
              See Timeline
            </button>
          }
        >
          <div className="flex flex-col gap-3">
            {groupsByDay(home.whatHappened, now).map((day) => (
              <div key={day.day} className="flex flex-col gap-0.5">
                <p className="px-2 pb-0.5 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  {day.label}
                </p>
                <PaneList label={day.label}>
                  {day.groups.map((g) => (
                    <WhatHappenedRow
                      key={g.id}
                      group={g}
                      onOpen={() => onOpenDesign(g.designId, g.shareCode ?? undefined)}
                    />
                  ))}
                </PaneList>
              </div>
            ))}
          </div>
        </PaneSection>
      ) : null}
    </div>
  );
}

export function InboxSection({ ownerId }: { ownerId: string }) {
  return <ActivityPane compact feed={useActivityFeed(ownerId)} />;
}

// The Timeline as a list for the pane: each event one row under its day, the newest first. Its card menus and the
// calendar are the Explorer page's (Open Page).
export function TimelineSection({ ownerId }: { ownerId: string }) {
  const feed = useTimelineFeed(ownerId, true);
  const now = useRelativeNow();
  if (feed.error) return <PaneFailed message="The Timeline could not load." onRetry={feed.retry} />;
  if (feed.loading) return <PaneSkeleton rows={6} />;
  if (!feed.events.length)
    return (
      <PaneEmpty
        icon={<ClockIcon />}
        title="No activity yet"
        description="Create a design, comment on one, or join a team, and it will show up here."
      />
    );
  const days: { day: string; events: typeof feed.events }[] = [];
  for (const e of feed.events) {
    const day = dateKey(e.occurredAt);
    const last = days.at(-1);
    if (last?.day === day) last.events.push(e);
    else days.push({ day, events: [e] });
  }
  return (
    <div className="flex flex-col gap-5">
      {days.map(({ day, events }) => (
        <PaneSection key={day} title={dayHeading(day, now)}>
          <PaneList label={dayHeading(day, now)}>
            {events.map((e) => (
              <TimelineRow key={e.id} event={e} ownerId={ownerId} />
            ))}
          </PaneList>
        </PaneSection>
      ))}
      {feed.hasMore ? (
        <button
          type="button"
          onClick={feed.loadMore}
          disabled={feed.loadingMore}
          className="mx-auto cursor-pointer rounded-md px-3 py-1.5 text-xs font-medium text-slate-600 ring-1 ring-slate-200 transition hover:bg-slate-50 disabled:cursor-wait disabled:opacity-60 dark:text-slate-300 dark:ring-slate-700 dark:hover:bg-slate-800"
        >
          {feed.loadingMore ? 'Loading…' : 'Show Earlier'}
        </button>
      ) : null}
    </div>
  );
}

// The Trash as rows: what was deleted and how long it has left, each with Restore and Delete (asked first).
export function TrashSection({
  ownerId,
  onChanged,
}: {
  ownerId: string;
  // A restore or a permanent delete: the panel's lists refresh so a restored design shows in its place.
  onChanged: () => void;
}) {
  const toast = useToast();
  const trash = useTrash(ownerId, toast, onChanged);
  const [now] = useState(() => Date.now());
  const [confirming, setConfirming] = useState<{
    id: string;
    name: string;
    group: TrashGroup;
    anchor: HTMLElement;
  } | null>(null);
  if (!trash.listing) return <PaneSkeleton rows={4} />;
  const groups = trashGroups(trash.listing);
  if (!groups.some((g) => g.rows.length))
    return (
      <PaneEmpty
        icon={<TrashIcon />}
        title="Nothing in the Trash right now"
        description="Delete a design and it is kept here for 30 days, so you can restore it."
      />
    );
  return (
    <div className="flex flex-col gap-5">
      <p className="px-2 text-[11px] leading-4 text-slate-500 dark:text-slate-400">
        Deleted designs wait here for 30 days. Restoring one puts it back where it was.
      </p>
      {groups.map((group) =>
        group.rows.length ? (
          <PaneSection key={group.key} title={group.title}>
            <PaneList label={group.title}>
              {group.rows.map((row) => (
                <PaneRow
                  key={row.id}
                  leading={
                    <PaneTile tone="rose">
                      <DesignIcon />
                    </PaneTile>
                  }
                  title={row.name || 'Untitled design'}
                  meta={`${trashedOnLabel(row)} · ${daysLeftLabel(row.trashedAt, now)}`}
                  trailing={
                    <>
                      <PaneIconButton
                        label="Restore"
                        onClick={() => void trash.restore(row.id, group)}
                      >
                        <RestoreGlyph />
                      </PaneIconButton>
                      <PaneIconButton
                        label="Delete for Good"
                        tone="danger"
                        onClick={(e) =>
                          setConfirming({
                            id: row.id,
                            name: row.name,
                            group,
                            anchor: e.currentTarget,
                          })
                        }
                      >
                        <DeleteGlyph />
                      </PaneIconButton>
                    </>
                  }
                />
              ))}
            </PaneList>
          </PaneSection>
        ) : null,
      )}
      {confirming ? (
        <ConfirmPopover
          anchor={confirming.anchor}
          message={`Delete "${confirming.name}" for good? This cannot be undone.`}
          confirmLabel="Delete permanently"
          onConfirm={() => {
            void trash.purge(confirming.id, confirming.group);
            setConfirming(null);
          }}
          onCancel={() => setConfirming(null)}
        />
      ) : null}
    </div>
  );
}

export type LibraryKind = (typeof LIBRARY_PAGES)[number]['kind'];

// The Library's two pages as tabs over one view (Image gallery first), each drawn for the pane. The pane holds the
// tab, so its Open Page goes to the page shown.
export function LibrarySection({
  ownerId,
  tab,
  setTab,
}: {
  ownerId: string;
  tab: LibraryKind;
  setTab: (tab: LibraryKind) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div
        role="tablist"
        aria-label="Library"
        className="flex gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800"
      >
        {LIBRARY_PAGES.map(({ kind, label, Icon, row }) => (
          <button
            key={kind}
            type="button"
            role="tab"
            aria-selected={tab === kind}
            onClick={() => {
              trackSidebar(row, 'panel');
              setTab(kind);
            }}
            className={`flex h-8 flex-1 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-2 text-xs font-medium transition pointer-coarse:h-11 ${
              tab === kind
                ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-slate-50'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
            }`}
          >
            <Icon />
            {label}
          </button>
        ))}
      </div>
      <div role="tabpanel">
        {tab === 'gallery' ? <GalleryPane compact ownerId={ownerId} /> : <ThemesPane compact />}
      </div>
    </div>
  );
}
