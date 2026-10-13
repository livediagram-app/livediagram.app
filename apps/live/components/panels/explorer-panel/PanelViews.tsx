'use client';

// The editor's Explorer sections that are views of their own (docs/specs/013-workspace/explorer-structure.md "The
// pane"): Home, the Inbox, the Timeline, the Library and the Trash, each drawn for the pane from the Explorer page's
// own data hooks. Loaded only when a section is first shown (ExplorerPanelPane's dynamic imports), and each read
// starts only while its section is mounted, so opening the editor costs nothing more.
import { useState } from 'react';
import { dateKey, pickRenderer, timeLabel } from '@livediagram/ui';
import { ActivityPane } from '@/components/panels/ActivityPane';
import { GalleryPane } from '@/components/panels/GalleryPane';
import { ThemesPane } from '@/components/panels/ThemesPane';
import { ShapeLibrariesPane } from '@/components/panels/ShapeLibrariesPane';
import { DocumentThumbnail } from '@/components/panels/DocumentThumbnail';
import { AvatarStack } from '@/components/panels/home/HomeAvatar';
import { ConfirmPopover } from '@/components/primitives/ConfirmPopover';
import { LocalOnlyPill } from '@/components/primitives/LocalOnlyPill';
import { ClockIcon, DocumentIcon, TrashIcon } from '@/components/primitives/explorer-icons';
import { useActivityFeed } from '@/app/explorer/useActivityFeed';
import { useTimelineFeed } from '@/app/explorer/useTimelineFeed';
import { useHome } from '@/app/explorer/home/useHome';
import {
  HOME_COPY,
  clockTime,
  locationLabel,
  summarySentence,
} from '@/app/explorer/home/home-copy';
import { dayHeading, groupsByDay } from '@/app/explorer/home/home-model';
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
  PANE_THUMB_BOX,
  PaneEmpty,
  PaneFailed,
  PaneList,
  PaneRow,
  PaneSection,
  PaneSkeleton,
  PaneTile,
} from './pane-parts';

type Open = (id: string, shareCode?: string) => void;

// How many documents Home's Jump back in lists in the pane.
const JUMP_BACK_IN_ROWS = 6;

export function HomeSection({
  ownerId,
  currentDocumentId,
  onOpenDocument,
  onSeeTimeline,
}: {
  ownerId: string;
  currentDocumentId: string | null;
  onOpenDocument: Open;
  // Home's See timeline shows the Timeline in the pane, as the rail would.
  onSeeTimeline: () => void;
}) {
  const home = useHome(ownerId, () => {});
  const now = useRelativeNow();
  if (home.status === 'error')
    return <PaneFailed message={HOME_COPY.readFailed} onRetry={home.retry} />;
  if (home.status === 'loading') return <PaneSkeleton rows={6} />;
  const seen = new Set<string>();
  const recent = [...home.jumpBackIn.mostUsed, ...home.jumpBackIn.recent]
    .filter((d) => (seen.has(d.documentId) ? false : (seen.add(d.documentId), true)))
    .slice(0, JUMP_BACK_IN_ROWS);
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
          <PaneList label={HOME_COPY.jumpBackIn}>
            {recent.map((d) => (
              <PaneRow
                key={d.documentId}
                leading={
                  <DocumentThumbnail
                    ownerId={ownerId}
                    documentId={d.documentId}
                    version={d.savedAt}
                    empty={d.empty}
                    shareCode={d.shareCode}
                    offline={d.localOnly}
                    className={PANE_THUMB_BOX}
                  />
                }
                title={d.name || 'Untitled document'}
                meta={`Opened ${relativeSince(d.lastUsedAt, now)}`}
                current={d.documentId === currentDocumentId}
                onActivate={() => onOpenDocument(d.documentId, d.shareCode ?? undefined)}
                trailing={d.localOnly ? <LocalOnlyPill tabbable={false} /> : null}
              />
            ))}
          </PaneList>
        ) : (
          <PaneEmpty
            icon={<ClockIcon />}
            title="Nothing to jump back into yet"
            description={HOME_COPY.jumpBackInEmpty}
          />
        )}
      </PaneSection>
      {/* Only when someone else did something: an empty "What happened" says nothing worth the room. */}
      {home.whatHappened.length ? (
        <PaneSection
          title={HOME_COPY.whatHappened}
          action={
            <button type="button" onClick={onSeeTimeline} className={PANE_LINK}>
              See timeline
            </button>
          }
        >
          <div className="flex flex-col gap-3">
            {groupsByDay(home.whatHappened, now).map((day) => (
              <div key={day.day} className="flex flex-col gap-0.5">
                <p className="px-2 pb-0.5 text-[11px] font-medium text-slate-400 dark:text-slate-400">
                  {day.label}
                </p>
                <PaneList label={day.label}>
                  {day.groups.map((g) => {
                    const s = summarySentence(g);
                    const sentence = `${s.people} ${s.verbs}${s.preposition ? ` ${s.preposition}` : ''} ${s.document}`;
                    return (
                      <PaneRow
                        key={g.id}
                        leading={
                          <span className="flex w-12 justify-center">
                            <AvatarStack people={g.people} size={26} />
                          </span>
                        }
                        title={
                          <span className="font-normal text-slate-600 dark:text-slate-300">
                            <span className="font-semibold text-slate-800 dark:text-slate-100">
                              {s.people}
                            </span>{' '}
                            {s.verbs}
                            {s.preposition ? ` ${s.preposition}` : ''}{' '}
                            <span className="font-semibold text-slate-800 dark:text-slate-100">
                              {s.document}
                            </span>
                          </span>
                        }
                        label={sentence}
                        meta={`${clockTime(g.latestAt)} · ${locationLabel(g)}`}
                        onActivate={() => onOpenDocument(g.documentId, g.shareCode ?? undefined)}
                      />
                    );
                  })}
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
        description="Create a document, comment on one, or join a team, and it will show up here."
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
            {events.map((e) => {
              const r = pickRenderer(e, TIMELINE_RENDERERS)(e, { viewerId: ownerId });
              return (
                <PaneRow
                  key={e.id}
                  leading={<PaneTile tone="brand">{r.icon}</PaneTile>}
                  title={r.subject ?? e.title}
                  meta={
                    <>
                      {r.label ?? e.title} · {timeLabel(e.occurredAt)}
                    </>
                  }
                  onActivate={r.onClick}
                />
              );
            })}
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
  // A restore or a permanent delete: the panel's lists refresh so a restored document shows in its place.
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
        description="Delete a document and it is kept here for 30 days, so you can restore it."
      />
    );
  const button =
    'cursor-pointer rounded-md px-2 py-1 text-[11px] font-medium transition focus-visible:outline-2 focus-visible:outline-brand-500';
  return (
    <div className="flex flex-col gap-5">
      <p className="px-2 text-[11px] leading-4 text-slate-500 dark:text-slate-400">
        Deleted documents wait here for 30 days. Restoring one puts it back where it was.
      </p>
      {groups.map((group) =>
        group.rows.length ? (
          <PaneSection key={group.key} title={group.title}>
            <PaneList label={group.title}>
              {group.rows.map((row) => (
                <PaneRow
                  key={row.id}
                  leading={
                    <PaneTile>
                      <DocumentIcon />
                    </PaneTile>
                  }
                  title={row.name || 'Untitled document'}
                  meta={`${trashedOnLabel(row)} · ${daysLeftLabel(row.trashedAt, now)}`}
                  trailing={
                    <>
                      <button
                        type="button"
                        onClick={() => void trash.restore(row.id, group)}
                        className={`${button} text-brand-700 hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-brand-500/15`}
                      >
                        Restore
                      </button>
                      <button
                        type="button"
                        aria-label={`Delete ${row.name || 'Untitled document'} for good`}
                        onClick={(e) =>
                          setConfirming({
                            id: row.id,
                            name: row.name,
                            group,
                            anchor: e.currentTarget,
                          })
                        }
                        className={`${button} text-slate-500 hover:bg-rose-50 hover:text-rose-700 dark:text-slate-400 dark:hover:bg-rose-500/15 dark:hover:text-rose-300`}
                      >
                        Delete
                      </button>
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

type LibraryKind = (typeof LIBRARY_PAGES)[number]['kind'];

// The Library's three pages as tabs over one view (Image gallery first), each drawn for the pane.
export function LibrarySection({ ownerId }: { ownerId: string }) {
  const [tab, setTab] = useState<LibraryKind>('gallery');
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
        {tab === 'gallery' ? (
          <GalleryPane compact ownerId={ownerId} />
        ) : tab === 'themes' ? (
          <ThemesPane compact />
        ) : (
          <ShapeLibrariesPane compact />
        )}
      </div>
    </div>
  );
}
