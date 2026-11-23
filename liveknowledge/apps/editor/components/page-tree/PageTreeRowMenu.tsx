'use client';

// A page's menu in the tree (docs/specs/030-knowledgebase/knowledgebases-and-pages.md "Row menu"; owner 2026-11-21:
// "some items should be a toolbar, some should be sub items of a category"): a toolbar of Rename, Duplicate, Copy Link
// and Delete under the page's name, then rows: Add Subpage, Connect File Here, Verify, Request Approval, Require
// Reading (while the page is not Required Reading), Always in Context (a checkmark row), Watch (watching.md, every
// signed-in reader's) and a closed Move section (Move Up, Move Down, Indent, Outdent). A verb that cannot run stays, greyed, and says why in its hover card. A Viewer or a
// Participant has Copy Link and Watch alone.
import { useState, type ReactNode } from 'react';
import {
  pageAddRefusal,
  pageCount,
  pageDepth,
  pageParents,
  pageSubtreeIds,
  withPageIndented,
  withPageOutdented,
  withPageStepped,
  MAX_PAGE_DEPTH,
} from '@liveknowledge/document';
import { HoverCard } from '@liveknowledge/ui';
import {
  MenuAccordionSection,
  MenuActionRow,
  MenuGroupSeparator,
  MenuHeader,
  PortalMenu,
} from '@liveworkspace/workbench/components/primitives/PortalMenu';
import type { MenuPoint } from '@liveworkspace/workbench/components/primitives/usePortalMenuPlacement';
import {
  MenuToolButton,
  MenuToolbar,
} from '@liveworkspace/workbench/components/primitives/MenuTiles';
import { RequestIcon } from '@/components/knowledge/approval/feedback-icons';
import { RequireReadingIcon } from '@/components/required-reading/reading-icons';
import { pageTreeRefusalText } from '@/hooks/persistence/page-tree-edits';
import {
  AddIcon,
  ConnectFileIcon,
  DeleteIcon,
  DuplicateIcon,
  IndentIcon,
  LinkIcon,
  MoveDownIcon,
  MoveUpIcon,
  OutdentIcon,
  MoveIcon,
  RenameIcon,
} from './page-tree-icons';
import { CheckIcon, ContextIcon, TickIcon } from '@/components/knowledge/knowledge-icons';
import type { PageTreeKnowledge } from './PageTree';
import type { TreeTab } from './page-tree-view';

export type PageMenuVerb =
  | 'rename'
  | 'add'
  | 'duplicate'
  | 'copy-link'
  | 'verify'
  | 'approval'
  // Require Reading (required-reading.md "Where it shows"): while the page is not Required Reading.
  | 'reading'
  | 'context'
  | 'up'
  | 'down'
  | 'indent'
  | 'outdent'
  | 'delete'
  // Connect File Here (links-and-embeds.md "Connected files in the sidebar"): a file as this page's last row.
  | 'connect-here';

/** Why each verb cannot run on a page right now; a verb that can is absent. Pure, for the menu and its tests. */
export function pageMenuRefusals(
  tabs: readonly TreeTab[],
  id: string,
): Partial<Record<PageMenuVerb, string>> {
  const out: Partial<Record<PageMenuVerb, string>> = {};
  const parent = pageParents(tabs).get(id);
  const subpage = pageAddRefusal(tabs, id);
  if (subpage) out.add = pageTreeRefusalText(subpage);
  // A connected row goes in wherever a subpage would, but never meets the page limit.
  if (pageDepth(tabs, id) >= MAX_PAGE_DEPTH)
    out['connect-here'] = pageTreeRefusalText('depth_limit');
  const copy = pageAddRefusal(tabs, parent);
  if (copy) out.duplicate = pageTreeRefusalText(copy);
  if (!withPageStepped(tabs, id, -1)) out.up = 'This is the first page here.';
  if (!withPageStepped(tabs, id, 1)) out.down = 'This is the last page here.';
  if (!withPageIndented(tabs, id)) {
    const siblings = tabs.filter((t) => pageParents(tabs).get(t.id) === parent);
    out.indent =
      siblings[0]?.id === id
        ? 'There is no page above to move this one under.'
        : `Pages nest ${MAX_PAGE_DEPTH} levels deep at most.`;
  }
  if (!withPageOutdented(tabs, id)) out.outdent = 'This page is already at the top level.';
  const subtree = new Set(pageSubtreeIds(tabs, id));
  if (pageCount(tabs.filter((t) => !subtree.has(t.id))) === 0)
    out.delete = 'A knowledgebase always has a page.';
  else if (tabs.some((t) => subtree.has(t.id) && t.locked === true))
    out.delete = 'Unlock the page before deleting it.';
  return out;
}

export function PageTreeRowMenu({
  anchor,
  point = null,
  tabs,
  id,
  canEdit,
  knowledge,
  canConnect = false,
  onVerb,
  onClose,
}: {
  anchor: HTMLElement | null;
  // Where a right-click or a long press was: the menu opens there.
  point?: MenuPoint | null;
  tabs: readonly TreeTab[];
  id: string;
  canEdit: boolean;
  // Verify and Always in Context (docs/specs/030-knowledgebase/verification.md, ai-knowledge.md): an Editor's.
  knowledge?:
    | Pick<
        PageTreeKnowledge,
        | 'canVerify'
        | 'canEditFields'
        | 'inContext'
        | 'canRequestApproval'
        | 'canRequireReading'
        | 'watchRows'
      >
    | undefined;
  // Connect File Here is offered (signed in, on the server, a session that may change the tree).
  canConnect?: boolean;
  onVerb: (verb: PageMenuVerb, id: string) => void;
  onClose: () => void;
}) {
  const [moveOpen, setMoveOpen] = useState(false);
  const page = tabs.find((t) => t.id === id);
  if (!page || pageDepth(tabs, id) === 0) return null;
  const refusals = canEdit ? pageMenuRefusals(tabs, id) : {};
  const separated = canEdit || !!knowledge?.canVerify || !!knowledge?.canEditFields;
  const row = (verb: PageMenuVerb, label: string, icon: ReactNode, aside?: ReactNode) => {
    const why = refusals[verb];
    const item = (
      <MenuActionRow
        plain
        label={label}
        icon={icon}
        aside={aside}
        disabled={why !== undefined}
        onClick={() => {
          onClose();
          onVerb(verb, id);
        }}
      />
    );
    // A verb that cannot run says why.
    return why ? (
      <HoverCard key={verb} block title={label} description={why}>
        {item}
      </HoverCard>
    ) : (
      <div key={verb}>{item}</div>
    );
  };
  const tool = (verb: PageMenuVerb, label: string, icon: ReactNode, description: string) => {
    const why = refusals[verb];
    return (
      <MenuToolButton
        key={verb}
        icon={icon}
        label={label}
        description={why ?? description}
        disabled={why !== undefined}
        onClick={() => {
          onClose();
          onVerb(verb, id);
        }}
      />
    );
  };
  return (
    <PortalMenu
      anchor={anchor}
      // A right-click or a long press opens it at the pointer (menus.md "Opening at the pointer").
      point={point}
      placement={point ? 'below-start' : 'below'}
      onClose={onClose}
      label="Page Options"
    >
      <MenuHeader title={page.name || 'Untitled Page'} />
      <MenuToolbar>
        {canEdit ? tool('rename', 'Rename', <RenameIcon />, 'Rename this page.') : null}
        {canEdit
          ? tool('duplicate', 'Duplicate', <DuplicateIcon />, 'A copy of this page below it.')
          : null}
        {tool('copy-link', 'Copy Link', <LinkIcon />, 'Copy a link to this page.')}
        {canEdit
          ? tool('delete', 'Delete', <DeleteIcon />, 'Delete this page and its subpages.')
          : null}
      </MenuToolbar>
      {separated ? <MenuGroupSeparator /> : null}
      {canEdit ? row('add', 'Add Subpage', <AddIcon />) : null}
      {canEdit && canConnect ? row('connect-here', 'Connect File Here', <ConnectFileIcon />) : null}
      {knowledge?.canVerify ? row('verify', 'Verify', <TickIcon />) : null}
      {knowledge?.canRequestApproval?.(id)
        ? row('approval', 'Request Approval', <RequestIcon />)
        : null}
      {knowledge?.canRequireReading?.(id)
        ? row('reading', 'Require Reading', <RequireReadingIcon />)
        : null}
      {/* Watch, Watch This Section, Unwatch: every role that reads the page (watching.md "Where it shows"). */}
      {knowledge?.watchRows?.(id, onClose, !separated)}
      {knowledge?.canEditFields
        ? row(
            'context',
            'Always in Context',
            <ContextIcon />,
            // A checkmark row: ticked while every agent is handed this page.
            knowledge.inContext.has(id) ? <CheckIcon data-checked="" /> : undefined,
          )
        : null}
      {canEdit ? (
        <MenuAccordionSection
          title="Move"
          icon={<MoveIcon />}
          open={moveOpen}
          onToggle={() => setMoveOpen((o) => !o)}
        >
          {row('up', 'Move Up', <MoveUpIcon />)}
          {row('down', 'Move Down', <MoveDownIcon />)}
          {row('indent', 'Indent', <IndentIcon />)}
          {row('outdent', 'Outdent', <OutdentIcon />)}
        </MenuAccordionSection>
      ) : null}
    </PortalMenu>
  );
}
