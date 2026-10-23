'use client';

// The editor's Explorer sections that are views of their own (docs/specs/013-workspace/explorer-structure.md "The
// pane"): Home, the Inbox, the Library and the Trash, each drawn for the pane from the Explorer page's
// own data hooks. Loaded only when a section is first shown (ExplorerPanelPane's dynamic imports), and each read
// starts only while its section is mounted, so opening the editor costs nothing more.
import { useState } from 'react';
import { ActivityPane } from '@/components/panels/ActivityPane';
import { ThemesPane } from '@/components/panels/ThemesPane';
import { ProjectThumbnail } from '@/components/panels/ProjectThumbnail';
import { AvatarStack } from '@/components/panels/home/HomeAvatar';
import { ConfirmPopover } from '@/components/primitives/ConfirmPopover';
import { ThisBrowserPill } from '@/components/primitives/ThisBrowserPill';
import { ClockIcon, ProjectIcon, TrashIcon } from '@/components/primitives/explorer-icons';
import { useActivityFeed } from '@/app/explorer/useActivityFeed';
import { useHome } from '@/app/explorer/home/useHome';
import {
  HOME_COPY,
  clockTime,
  locationLabel,
  summarySentence,
} from '@/app/explorer/home/home-copy';
import { groupsByDay, paneJumpBackIn } from '@/app/explorer/home/home-model';
import { useTrash } from '@/hooks/persistence/useTrash';
import { useToast } from '@/hooks/ui/useToast';
import { explorerPathFor } from '@/app/explorer/routes';
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
} from './pane-parts';
import { usePaneProjectMenu } from '../explorer-tree/usePaneProjectMenu';
import { usePanelTree } from '../explorer-tree/PanelTreeContext';
import type { JumpBackInItem } from '@/app/explorer/home/home-model';
import type { HomeGroup } from '@liveplanner/api-schema';
import { lucideGlyph } from '@liveplanner/ui';
import { lucideRotateCcw, lucideTrash2 } from '@liveplanner/icons/lucide';

const RestoreGlyph = lucideGlyph(lucideRotateCcw, 16);
const DeleteGlyph = lucideGlyph(lucideTrash2, 16);

// One of Jump Back In's projects as a preview card, with the project menu when the reader can reach it.
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
  const doc = usePanelTree().projectById?.(item.projectId);
  const menu = usePaneProjectMenu(doc);
  return (
    <PaneCard
      preview={
        <ProjectThumbnail
          ownerId={ownerId}
          projectId={item.projectId}
          version={item.savedAt}
          empty={item.empty}
          shareCode={item.shareCode}
          offline={item.localOnly}
          className={PANE_PREVIEW_BOX}
        />
      }
      title={item.name || 'Untitled plan'}
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

// One of What Happened's groups: the people, what they did and where, with the project's menu.
function WhatHappenedRow({ group, onOpen }: { group: HomeGroup; onOpen: () => void }) {
  const doc = usePanelTree().projectById?.(group.projectId);
  const menu = usePaneProjectMenu(doc);
  const s = summarySentence(group);
  const sentence = `${s.people} ${s.verbs}${s.preposition ? ` ${s.preposition}` : ''} ${s.project}`;
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
          <span className="font-semibold text-slate-800 dark:text-slate-100">{s.project}</span>
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

type Open = (id: string, shareCode?: string) => void;

// How many projects Home's Jump Back In lists in the pane.
const JUMP_BACK_IN_ROWS = 6;

export function HomeSection({
  ownerId,
  currentProjectId,
  onOpenProject,
}: {
  ownerId: string;
  currentProjectId: string | null;
  onOpenProject: Open;
}) {
  const home = useHome(ownerId, () => {});
  const now = useRelativeNow();
  if (home.status === 'error')
    return <PaneFailed message={HOME_COPY.readFailed} onRetry={home.retry} />;
  if (home.status === 'loading') return <PaneSkeleton rows={6} />;
  const recent = paneJumpBackIn(home.jumpBackIn, currentProjectId, JUMP_BACK_IN_ROWS);
  // Empty only because the open project is left out: the person has a project, so "No projects yet" would be
  // wrong (explorer-structure.md "Home").
  const onlyOpen =
    recent.length === 0 &&
    [...home.jumpBackIn.mostUsed, ...home.jumpBackIn.recent].some(
      (d) => d.projectId === currentProjectId,
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
                key={d.projectId}
                item={d}
                ownerId={ownerId}
                now={now}
                onOpen={() => onOpenProject(d.projectId, d.shareCode ?? undefined)}
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
        <PaneSection title={HOME_COPY.whatHappened}>
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
                      onOpen={() => onOpenProject(g.projectId, g.shareCode ?? undefined)}
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

// The Trash as rows: what was deleted and how long it has left, each with Restore and Delete (asked first).
export function TrashSection({
  ownerId,
  onChanged,
}: {
  ownerId: string;
  // A restore or a permanent delete: the panel's lists refresh so a restored project shows in its place.
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
        description="Delete a plan and it is kept here for 30 days, so you can restore it."
      />
    );
  return (
    <div className="flex flex-col gap-5">
      <p className="px-2 text-[11px] leading-4 text-slate-500 dark:text-slate-400">
        Deleted plans wait here for 30 days. Restoring one puts it back where it was.
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
                      <ProjectIcon />
                    </PaneTile>
                  }
                  title={row.name || 'Untitled plan'}
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

// The Library's page (its Themes), drawn for the pane.
export function LibrarySection() {
  return <ThemesPane compact />;
}
