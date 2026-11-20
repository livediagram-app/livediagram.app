'use client';

// A page's menu in the tree (docs/specs/030-knowledgebase/knowledgebases-and-pages.md "Row menu"): icon-left verb
// rows under the page's name. Rename, Add Subpage, Duplicate, Copy Link, Verify, Always in Context (a checkmark
// row), Move Up, Move Down, Indent, Outdent, then Delete last. A verb that cannot run stays, greyed, and says why in its hover card. A Viewer or a Participant has
// Copy Link alone.
import type { ReactNode } from 'react';
import {
  pageAddRefusal,
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
  MenuActionRow,
  MenuGroupSeparator,
  MenuHeader,
  PortalMenu,
} from '@liveworkspace/workbench/components/primitives/PortalMenu';
import { pageTreeRefusalText } from '@/hooks/persistence/page-tree-edits';
import {
  AddIcon,
  DeleteIcon,
  DuplicateIcon,
  IndentIcon,
  LinkIcon,
  MoveDownIcon,
  MoveUpIcon,
  OutdentIcon,
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
  | 'context'
  | 'up'
  | 'down'
  | 'indent'
  | 'outdent'
  | 'delete';

/** Why each verb cannot run on a page right now; a verb that can is absent. Pure, for the menu and its tests. */
export function pageMenuRefusals(
  tabs: readonly TreeTab[],
  id: string,
): Partial<Record<PageMenuVerb, string>> {
  const out: Partial<Record<PageMenuVerb, string>> = {};
  const parent = pageParents(tabs).get(id);
  const subpage = pageAddRefusal(tabs, id);
  if (subpage) out.add = pageTreeRefusalText(subpage);
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
  if (subtree.size >= tabs.length) out.delete = 'A knowledgebase always has a page.';
  else if (tabs.some((t) => subtree.has(t.id) && t.locked === true))
    out.delete = 'Unlock the page before deleting it.';
  return out;
}

export function PageTreeRowMenu({
  anchor,
  tabs,
  id,
  canEdit,
  knowledge,
  onVerb,
  onClose,
}: {
  anchor: HTMLElement | null;
  tabs: readonly TreeTab[];
  id: string;
  canEdit: boolean;
  // Verify and Always in Context (docs/specs/030-knowledgebase/verification.md, ai-knowledge.md): an Editor's.
  knowledge?: Pick<PageTreeKnowledge, 'canVerify' | 'canEditFields' | 'inContext'> | undefined;
  onVerb: (verb: PageMenuVerb, id: string) => void;
  onClose: () => void;
}) {
  const page = tabs.find((t) => t.id === id);
  if (!page || pageDepth(tabs, id) === 0) return null;
  const refusals = canEdit ? pageMenuRefusals(tabs, id) : {};
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
  return (
    <PortalMenu anchor={anchor} placement="below" onClose={onClose} label="Page Options">
      <MenuHeader title={page.name || 'Untitled Page'} />
      {canEdit ? row('rename', 'Rename', <RenameIcon />) : null}
      {canEdit ? row('add', 'Add Subpage', <AddIcon />) : null}
      {canEdit ? row('duplicate', 'Duplicate', <DuplicateIcon />) : null}
      {row('copy-link', 'Copy Link', <LinkIcon />)}
      {knowledge?.canVerify ? row('verify', 'Verify', <TickIcon />) : null}
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
        <>
          {row('up', 'Move Up', <MoveUpIcon />)}
          {row('down', 'Move Down', <MoveDownIcon />)}
          {row('indent', 'Indent', <IndentIcon />)}
          {row('outdent', 'Outdent', <OutdentIcon />)}
          <MenuGroupSeparator />
          {row('delete', 'Delete', <DeleteIcon />)}
        </>
      ) : null}
    </PortalMenu>
  );
}
