'use client';

// A connected file's menu in the page tree (docs/specs/030-knowledgebase/links-and-embeds.md "Connected files in the
// sidebar"): icon-left verb rows under the file's name and app. Open and Copy Link are everyone's; Move Up, Move Down,
// Indent and Outdent place it as a page is placed; Connect Again mends a row whose link was removed or that came with
// a copy; Remove from Sidebar takes the row away and leaves the file as it is. A move that cannot run stays, greyed,
// and says why in its hover card. A Viewer has Open and Copy Link alone.
import type { ReactNode } from 'react';
import {
  isConnectedRow,
  pageParents,
  withPageIndented,
  withPageOutdented,
  withPageStepped,
  MAX_PAGE_DEPTH,
} from '@liveknowledge/document';
import type { App } from '@liveworkspace/index-client';
import { AppMark, HoverCard } from '@liveknowledge/ui';
import { appName } from '@liveworkspace/workbench/components/connect/connect-words';
import {
  MenuActionRow,
  MenuGroupSeparator,
  MenuHeader,
  PortalMenu,
} from '@liveworkspace/workbench/components/primitives/PortalMenu';
import type { ConnectedRowState } from '@/lib/knowledge/connected-row-store';
import { canConnectAgain, cantOpenWords } from './connected-rows';
import {
  ConnectAgainIcon,
  IndentIcon,
  LinkIcon,
  MoveDownIcon,
  MoveUpIcon,
  OpenIcon,
  OutdentIcon,
  RemoveFromSidebarIcon,
} from './page-tree-icons';
import type { TreeTab } from './page-tree-view';

export type ConnectedMenuVerb =
  'open' | 'copy-link' | 'up' | 'down' | 'indent' | 'outdent' | 'connect-again' | 'remove';

/** Why each move cannot run on a connected row right now; a move that can is absent. Pure, for the menu's tests. */
export function connectedMenuRefusals(
  tabs: readonly TreeTab[],
  id: string,
): Partial<Record<ConnectedMenuVerb, string>> {
  const out: Partial<Record<ConnectedMenuVerb, string>> = {};
  if (!withPageStepped(tabs, id, -1)) out.up = 'This is the first row here.';
  if (!withPageStepped(tabs, id, 1)) out.down = 'This is the last row here.';
  if (!withPageIndented(tabs, id)) {
    const parents = pageParents(tabs);
    const parent = parents.get(id);
    const siblings = tabs.filter((t) => parents.get(t.id) === parent);
    const above = siblings[siblings.findIndex((t) => t.id === id) - 1];
    out.indent = !above
      ? 'There is no page above to move this file under.'
      : isConnectedRow(above)
        ? 'The row above is a connected file, which holds nothing: only a page holds rows.'
        : `Pages nest ${MAX_PAGE_DEPTH} levels deep at most.`;
  }
  if (!withPageOutdented(tabs, id)) out.outdent = 'This file is already at the top level.';
  return out;
}

export function ConnectedRowMenu({
  anchor,
  tabs,
  id,
  app,
  state,
  canEdit,
  onVerb,
  onClose,
}: {
  anchor: HTMLElement | null;
  tabs: readonly TreeTab[];
  id: string;
  app: App;
  state: ConnectedRowState;
  canEdit: boolean;
  onVerb: (verb: ConnectedMenuVerb, id: string) => void;
  onClose: () => void;
}) {
  const row = tabs.find((t) => t.id === id);
  if (!row) return null;
  const refusals = canEdit ? connectedMenuRefusals(tabs, id) : {};
  const broken = state.kind === 'broken';
  const item = (verb: ConnectedMenuVerb, label: string, icon: ReactNode) => {
    const why = refusals[verb];
    const action = (
      <MenuActionRow
        plain
        label={label}
        icon={icon}
        disabled={why !== undefined}
        onClick={() => {
          onClose();
          onVerb(verb, id);
        }}
      />
    );
    return why ? (
      <HoverCard key={verb} block title={label} description={why}>
        {action}
      </HoverCard>
    ) : (
      <div key={verb}>{action}</div>
    );
  };
  return (
    <PortalMenu anchor={anchor} placement="below" onClose={onClose} label="File Options">
      <MenuHeader
        title={row.name || 'Untitled File'}
        aside={<AppMark app={app} className="size-4" />}
      />
      {state.kind === 'broken' ? (
        <p
          data-cant-open-why=""
          className="max-w-64 px-3 pb-2 text-xs leading-4 text-amber-800 dark:text-amber-200"
        >
          {cantOpenWords(state.reason, app, canEdit)}
        </p>
      ) : (
        <p className="px-3 pb-1 text-xs leading-4 text-slate-500 dark:text-slate-400">
          Opens in {appName(app)}, in a new tab.
        </p>
      )}
      {broken ? null : item('open', 'Open', <OpenIcon />)}
      {broken ? null : item('copy-link', 'Copy Link', <LinkIcon />)}
      {canEdit ? (
        <>
          {state.kind === 'broken' && canConnectAgain(state.reason)
            ? item('connect-again', 'Connect Again', <ConnectAgainIcon />)
            : null}
          {item('up', 'Move Up', <MoveUpIcon />)}
          {item('down', 'Move Down', <MoveDownIcon />)}
          {item('indent', 'Indent', <IndentIcon />)}
          {item('outdent', 'Outdent', <OutdentIcon />)}
          <MenuGroupSeparator />
          {item('remove', 'Remove from Sidebar', <RemoveFromSidebarIcon />)}
        </>
      ) : null}
    </PortalMenu>
  );
}
